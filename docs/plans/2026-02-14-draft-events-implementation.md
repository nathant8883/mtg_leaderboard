# Draft Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Draft" event type with Swiss pairing, 1v1 matches, temporary draft decks, Scryfall set integration, and limited/commander game modes.

**Architecture:** Extend the existing Event model with draft-specific fields (`game_mode`, `sets`, `draft_decks`). Reuse event lifecycle endpoints with type-aware branching for pairing (Swiss vs pod-based) and scoring (W/L vs points). Add a new `SetPicker` component and draft deck creation flow on the frontend.

**Tech Stack:** FastAPI + Beanie (backend), React + TypeScript + Tailwind (frontend), Scryfall REST API (set search), httpx (HTTP client)

---

### Task 1: Extend Event Data Model

**Files:**
- Modify: `backend/app/models/event.py`

**Step 1: Add DraftSet and DraftDeck sub-models**

Add after the `StandingsEntry` class (line 49):

```python
class DraftSet(BaseModel):
    """An MTG set used in the draft"""
    code: str          # e.g. "MKM"
    name: str          # e.g. "Murders at Karlov Manor"
    icon_svg_uri: str  # Scryfall set icon URL


class DraftDeck(BaseModel):
    """A temporary deck built during a draft event"""
    player_id: str
    name: str
    colors: list[str] = Field(default_factory=list)  # W/U/B/R/G
    commander: Optional[str] = None
    commander_image_url: Optional[str] = None
```

**Step 2: Add draft fields to Event document**

Add these fields to the `Event` class after `custom_image` (around line 57):

```python
# Draft-specific config (None for tournaments)
game_mode: Optional[str] = None      # "commander" | "limited"
sets: list[DraftSet] = Field(default_factory=list)
draft_decks: list[DraftDeck] = Field(default_factory=list)
```

**Step 3: Update player_count validator**

Replace the `validate_player_count` method to support both event types:

```python
@field_validator('player_count')
@classmethod
def validate_player_count(cls, v, info):
    # Validation depends on event_type, but event_type may not be set yet during
    # construction. Accept any even number 4-12 at the model level.
    # Router-level validation enforces tournament=4/8/12, draft=even 4-12.
    if v < 4 or v > 12:
        raise ValueError('Player count must be between 4 and 12')
    return v
```

**Step 4: Update serialize_event helper in events router**

Add the new fields to `backend/app/routers/events.py` `serialize_event()`:

```python
"game_mode": event.game_mode,
"sets": [
    {"code": s.code, "name": s.name, "icon_svg_uri": s.icon_svg_uri}
    for s in event.sets
],
"draft_decks": [
    {
        "player_id": dd.player_id,
        "name": dd.name,
        "colors": dd.colors,
        "commander": dd.commander,
        "commander_image_url": dd.commander_image_url,
    }
    for dd in event.draft_decks
],
```

**Step 5: Commit**

```bash
git add backend/app/models/event.py backend/app/routers/events.py
git commit -m "feat(draft): extend Event model with draft-specific fields"
```

---

### Task 2: Add game_mode to Match Model

**Files:**
- Modify: `backend/app/models/match.py`

**Step 1: Add game_mode field**

Add after `event_round` (line 31):

```python
game_mode: Optional[str] = None  # "commander" | "limited" | None (regular match)
```

**Step 2: Commit**

```bash
git add backend/app/models/match.py
git commit -m "feat(draft): add game_mode field to Match model"
```

---

### Task 3: Add Scryfall Set Search Endpoint

**Files:**
- Modify: `backend/app/services/scryfall.py`
- Modify: `backend/app/routers/events.py`

**Step 1: Add set search method to ScryfallService**

Add to `ScryfallService` class in `backend/app/services/scryfall.py`:

```python
@staticmethod
async def search_sets(query: str, limit: int = 15) -> list[dict]:
    """
    Search for MTG sets by name.
    Scryfall /sets endpoint returns all sets; we filter client-side.
    """
    if not query or len(query) < 2:
        return []

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SCRYFALL_API_BASE}/sets",
            timeout=10.0,
        )

        if response.status_code != 200:
            return []

        data = response.json()
        all_sets = data.get("data", [])

        query_lower = query.lower()
        results = []
        for s in all_sets:
            # Only include released, playable set types
            if s.get("set_type") not in ("core", "expansion", "draft_innovation", "masters", "funny"):
                continue
            if query_lower in s.get("name", "").lower() or query_lower == s.get("code", "").lower():
                results.append({
                    "code": s["code"],
                    "name": s["name"],
                    "icon_svg_uri": s.get("icon_svg_uri", ""),
                    "released_at": s.get("released_at", ""),
                })
            if len(results) >= limit:
                break

        return results

@staticmethod
async def get_set_by_code(code: str) -> dict | None:
    """Get a single set by its code."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SCRYFALL_API_BASE}/sets/{code}",
            timeout=10.0,
        )
        if response.status_code != 200:
            return None
        s = response.json()
        return {
            "code": s["code"],
            "name": s["name"],
            "icon_svg_uri": s.get("icon_svg_uri", ""),
        }
```

**Step 2: Add set search endpoint to events router**

Add before the CRUD endpoints section in `backend/app/routers/events.py`:

```python
from app.services.scryfall import scryfall_service

@router.get("/sets/search")
async def search_sets(q: str = ""):
    """Search for MTG sets via Scryfall (authenticated)"""
    results = await scryfall_service.search_sets(q)
    return results
```

**Important:** This endpoint MUST be defined before `/{event_id}` routes, otherwise FastAPI will try to match "sets" as an event_id.

**Step 3: Commit**

```bash
git add backend/app/services/scryfall.py backend/app/routers/events.py
git commit -m "feat(draft): add Scryfall set search endpoint"
```

---

### Task 4: Modify Create Event for Draft Support

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Update CreateEventRequest**

```python
class CreateEventRequest(BaseModel):
    """Request body for creating an event"""
    name: str
    pod_id: str
    player_ids: list[str]
    round_count: int
    event_date: Optional[date] = None
    custom_image: Optional[str] = None
    # Draft-specific fields
    event_type: str = "tournament"  # "tournament" | "draft"
    game_mode: Optional[str] = None  # "commander" | "limited" (required for draft)
    set_codes: list[str] = Field(default_factory=list)  # Up to 4 set codes
```

**Step 2: Update create_event endpoint**

Modify the `create_event` function to handle draft validation and set fetching. Key changes:

- If `event_type == "draft"`:
  - Validate `game_mode` is provided and is "commander" or "limited"
  - Validate player count is even (2-12) instead of 4/8/12
  - Validate `set_codes` has 0-4 entries
  - Fetch set details from Scryfall for each code
- If `event_type == "tournament"`:
  - Existing validation (4/8/12 player count)

Replace the player count validation block:

```python
player_count = len(request.player_ids)

if request.event_type == "draft":
    # Draft: even number 4-12
    if player_count < 4 or player_count > 12 or player_count % 2 != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft requires an even number of players (4-12)",
        )
    if not request.game_mode or request.game_mode not in ("commander", "limited"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft requires game_mode: 'commander' or 'limited'",
        )
    if len(request.set_codes) > 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 4 sets allowed",
        )
else:
    # Tournament: 4, 8, or 12
    if player_count not in (4, 8, 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player count must be 4, 8, or 12",
        )
```

After player snapshot building, fetch sets:

```python
# Fetch set details from Scryfall (draft only)
draft_sets = []
if request.event_type == "draft" and request.set_codes:
    for code in request.set_codes:
        set_data = await scryfall_service.get_set_by_code(code)
        if set_data:
            draft_sets.append(DraftSet(**set_data))
```

Update Event construction to include new fields:

```python
event = Event(
    name=request.name,
    event_type=request.event_type,
    pod_id=request.pod_id,
    creator_id=player_id_str,
    custom_image=request.custom_image,
    player_count=player_count,
    round_count=request.round_count,
    players=event_players,
    status="setup",
    current_round=0,
    rounds=rounds,
    standings=standings,
    event_date=request.event_date or date.today(),
    game_mode=request.game_mode,
    sets=draft_sets,
)
```

**Step 3: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(draft): support draft event creation with sets and game mode"
```

---

### Task 5: Modify Start Tournament for Draft (1v1 Pairings)

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Add 1v1 pairing helper**

Add near the existing `_create_pods_from_player_list`:

```python
def _create_1v1_pairings(player_ids: list[str]) -> list[PodAssignment]:
    """Create 1v1 pairings from a list of player IDs"""
    pods = []
    for i in range(0, len(player_ids) - 1, 2):
        pods.append(PodAssignment(
            pod_index=i // 2,
            player_ids=[player_ids[i], player_ids[i + 1]],
            match_status="pending",
        ))
    return pods
```

**Step 2: Update start_tournament endpoint**

After the shuffle, branch on event type:

```python
# Create pairings based on event type
if event.event_type == "draft":
    round1_pods = _create_1v1_pairings(player_ids)
else:
    round1_pods = _create_pods_from_player_list(player_ids, 1)
```

**Step 3: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(draft): create 1v1 pairings on draft start"
```

---

### Task 6: Swiss Pairing for Advance Round

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Add Swiss pairing helper**

```python
def _swiss_pair(standings: list[StandingsEntry], previous_rounds: list[Round]) -> list[PodAssignment]:
    """
    Swiss pairing: group by wins, pair within groups, avoid rematches.
    """
    # Collect previous pairings as frozensets for rematch checking
    previous_pairings: set[frozenset[str]] = set()
    for r in previous_rounds:
        for pod in r.pods:
            if len(pod.player_ids) == 2:
                previous_pairings.add(frozenset(pod.player_ids))

    # Sort by total_points descending (tiebreak random)
    sorted_players = sorted(
        standings,
        key=lambda s: (s.total_points, random.random()),
        reverse=True,
    )

    paired: list[tuple[str, str]] = []
    remaining = [s.player_id for s in sorted_players]

    while len(remaining) >= 2:
        p1 = remaining.pop(0)
        # Try to find a partner not already paired against p1
        partner_idx = None
        for i, p2 in enumerate(remaining):
            if frozenset([p1, p2]) not in previous_pairings:
                partner_idx = i
                break
        # If no non-rematch partner found, take the first available
        if partner_idx is None:
            partner_idx = 0
        p2 = remaining.pop(partner_idx)
        paired.append((p1, p2))

    pods = []
    for i, (p1, p2) in enumerate(paired):
        pods.append(PodAssignment(
            pod_index=i,
            player_ids=[p1, p2],
            match_status="pending",
        ))
    return pods
```

**Step 2: Update advance_round endpoint**

Replace the pod creation logic with a branch:

```python
if event.event_type == "draft":
    # Swiss pairing: pair by record, avoid rematches
    completed_rounds = [r for r in event.rounds if r.status == "completed"]
    next_round_pods = _swiss_pair(event.standings, completed_rounds)
else:
    # Tournament: sort by standings, create pods of 4
    sorted_standings = sorted(
        event.standings,
        key=lambda s: (s.total_points, random.random()),
        reverse=True,
    )
    sorted_player_ids = [s.player_id for s in sorted_standings]
    next_round_pods = _create_pods_from_player_list(sorted_player_ids, next_round_num)
```

**Step 3: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(draft): add Swiss pairing for draft round advancement"
```

---

### Task 7: Draft Scoring in Complete Match

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Update complete_pod_match for draft scoring**

After fetching the match, set game_mode on it:

```python
# Link match to event
match.event_id = str(event.id)
match.event_round = round_num
match.game_mode = event.game_mode
await match.save()
```

Replace the scoring section with a branch:

```python
# Calculate points
if event.event_type == "draft":
    # Simple W/L: winner gets 1 point, loser gets 0
    round_results = []
    for mp in match.players:
        total = 1 if mp.player_id == match.winner_player_id else 0
        round_results.append(RoundResult(
            player_id=mp.player_id,
            placement_points=total,
            total=total,
        ))
else:
    round_results = _calculate_match_points(match, request.is_alt_win)
```

**Step 2: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(draft): add simple W/L scoring for draft matches"
```

---

### Task 8: Draft Deck Registration Endpoint

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Add request model and endpoint**

Add request model:

```python
class RegisterDraftDeckRequest(BaseModel):
    """Request body for registering/updating a draft deck"""
    player_id: str
    name: str
    colors: list[str] = Field(default_factory=list)
    commander: Optional[str] = None
    commander_image_url: Optional[str] = None
```

Add endpoint (in the tournament flow section):

```python
@router.post("/{event_id}/draft-decks")
async def register_draft_deck(
    event_id: PydanticObjectId,
    request: RegisterDraftDeckRequest,
    current_player: Player = Depends(get_current_player),
):
    """Register or update a draft deck for a player in this event"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.event_type != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft decks can only be registered for draft events",
        )

    # Validate the player is in this event
    player_in_event = any(ep.player_id == request.player_id for ep in event.players)
    if not player_in_event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is not in this event",
        )

    # If commander mode and commander provided, validate via Scryfall
    colors = request.colors
    commander_image_url = request.commander_image_url
    if event.game_mode == "commander" and request.commander:
        details = await scryfall_service.get_commander_details(request.commander)
        if details:
            colors = details["color_identity"]
            commander_image_url = details.get("image_art_crop") or details.get("image_normal")

    # Upsert: remove existing deck for this player, add new one
    event.draft_decks = [dd for dd in event.draft_decks if dd.player_id != request.player_id]
    event.draft_decks.append(DraftDeck(
        player_id=request.player_id,
        name=request.name,
        colors=colors,
        commander=request.commander,
        commander_image_url=commander_image_url,
    ))

    await event.save()
    return serialize_event(event)
```

**Step 2: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat(draft): add draft deck registration endpoint"
```

---

### Task 9: Frontend TypeScript Types & API Client

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: Add new types**

Add after the `StandingsEntry` interface:

```typescript
export interface DraftSet {
  code: string;
  name: string;
  icon_svg_uri: string;
}

export interface DraftDeck {
  player_id: string;
  name: string;
  colors: string[];
  commander?: string;
  commander_image_url?: string;
}
```

**Step 2: Update TournamentEvent interface**

Add new fields:

```typescript
export interface TournamentEvent {
  // ... existing fields ...
  game_mode?: 'commander' | 'limited';
  sets: DraftSet[];
  draft_decks: DraftDeck[];
}
```

**Step 3: Update CreateEventRequest**

```typescript
export interface CreateEventRequest {
  name: string;
  pod_id: string;
  player_ids: string[];
  round_count: number;
  event_date?: string;
  custom_image?: string;
  event_type?: 'tournament' | 'draft';
  game_mode?: 'commander' | 'limited';
  set_codes?: string[];
}
```

**Step 4: Add new API methods to eventApi**

```typescript
searchSets: async (query: string): Promise<DraftSet[]> => {
  const response = await api.get('/events/sets/search', { params: { q: query } });
  return response.data;
},

registerDraftDeck: async (
  eventId: string,
  deck: { player_id: string; name: string; colors: string[]; commander?: string; commander_image_url?: string }
): Promise<TournamentEvent> => {
  const response = await api.post(`/events/${eventId}/draft-decks`, deck);
  return response.data;
},
```

**Step 5: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(draft): add draft types and API client methods"
```

---

### Task 10: SetPicker Component

**Files:**
- Create: `frontend/src/components/events/SetPicker.tsx`

**Step 1: Create the component**

Build a search-and-select component for MTG sets. Pattern follows the existing `CommanderAutocomplete.tsx`:

- Text input with 300ms debounce
- Dropdown shows set name + icon + release year
- Selected sets render as removable chips with set icon
- Max 4 sets
- Props: `selectedSets: DraftSet[]`, `onChange: (sets: DraftSet[]) => void`

Use `eventApi.searchSets(query)` for search. Render set icons via `<img src={set.icon_svg_uri} />` (Scryfall SVGs).

**Step 2: Commit**

```bash
git add frontend/src/components/events/SetPicker.tsx
git commit -m "feat(draft): add SetPicker component with Scryfall search"
```

---

### Task 11: Update Event Create Page for Draft

**Files:**
- Modify: `frontend/src/pages/EventCreate.tsx`

**Step 1: Add event type toggle**

Add state for `eventType`, `gameMode`, `selectedSets`. At the top of the form, add a "Tournament" / "Draft" toggle using two styled buttons (same pattern as existing UI).

**Step 2: Add draft-specific form sections**

When `eventType === 'draft'`:
- Show game mode picker ("Commander" / "Limited" — two card-style buttons)
- Show `SetPicker` component
- Change player count validation from 4/8/12 to "even number 4-12"
- Update the helper text from "Must be 4, 8, or 12 players" to "Must be an even number (4-12)"

**Step 3: Update submit handler**

Pass `event_type`, `game_mode`, and `set_codes` in the `CreateEventRequest`:

```typescript
const request: CreateEventRequest = {
  name: eventName.trim(),
  pod_id: currentPod.id!,
  player_ids: Array.from(selectedPlayerIds),
  round_count: roundCount,
  custom_image: customImage || undefined,
  event_type: eventType,
  game_mode: eventType === 'draft' ? gameMode : undefined,
  set_codes: eventType === 'draft' ? selectedSets.map(s => s.code) : undefined,
};
```

**Step 4: Commit**

```bash
git add frontend/src/pages/EventCreate.tsx
git commit -m "feat(draft): add draft mode to event creation page"
```

---

### Task 12: Update EventsList for Draft Display

**Files:**
- Modify: `frontend/src/pages/EventsList.tsx`

**Step 1: Show set icons for draft events**

In the event card rendering, when `event.event_type === 'draft'` and `event.sets.length > 0`:
- Show set icon(s) instead of trophy icon (use `<img src={event.sets[0].icon_svg_uri} />`)
- For multiple sets, stack/overlap the icons

**Step 2: Update sub-text**

Show game mode: "Commander Draft" or "Limited Draft" instead of generic "tournament".

**Step 3: Commit**

```bash
git add frontend/src/pages/EventsList.tsx
git commit -m "feat(draft): show set icons and draft mode in events list"
```

---

### Task 13: Update EventDashboard for Draft

**Files:**
- Modify: `frontend/src/pages/EventDashboard.tsx`

**Step 1: Update SetupView**

- Show "Draft Setup" or "Tournament Setup" based on event type
- Show set icon(s) and game mode badge in the info card
- Change "Pods per Round" to "Matches per Round" for drafts

**Step 2: Update ActiveView standings**

For draft events, simplify the standings table:
- Columns: Rank, Player, W-L (instead of Pts/W/K)
- Replace points display with `{wins}-{totalGames - wins}` W-L record
- Hide kills column

**Step 3: Update ActiveView pod display**

For draft events, show pods as "Match N" with "Player A vs Player B" instead of the 4-player pod layout.

For completed 1v1 matches, show winner with "Won" instead of "+N pts".

**Step 4: Update CompletedView**

Same standings simplification. In champion banner, show "W-L record" instead of "points · W · K".

**Step 5: Commit**

```bash
git add frontend/src/pages/EventDashboard.tsx
git commit -m "feat(draft): adapt event dashboard for draft display"
```

---

### Task 14: Draft Deck Flow in EventMatchTracker

**Files:**
- Modify: `frontend/src/pages/EventMatchTracker.tsx`

**Step 1: Set starting life based on game_mode**

In the match state initialization (around line 136), use the event's game mode:

```typescript
const startingLife = eventData.game_mode === 'limited' ? 20 : 40;

setMatchState({
  playerCount: podSize,
  players: emptyPlayers,
  layout: 'table' as LayoutType,
  startingLife,
  currentStep: 'assignment',
});
```

**Step 2: Pass game_mode to ActiveGame**

Add a `gameMode` prop to `ActiveGame` (see Task 15). Pass it from EventMatchTracker:

```tsx
<ActiveGame
  // ... existing props ...
  gameMode={event?.game_mode}
/>
```

**Step 3: Commit**

```bash
git add frontend/src/pages/EventMatchTracker.tsx
git commit -m "feat(draft): set starting life and game mode in event match tracker"
```

---

### Task 15: Limited Mode in ActiveGame — Disable Commander Damage

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Step 1: Add gameMode prop**

Update `ActiveGameProps` interface:

```typescript
interface ActiveGameProps {
  // ... existing props ...
  gameMode?: 'commander' | 'limited';
}
```

Update the function signature to destructure `gameMode`.

**Step 2: Disable commander damage entry in limited mode**

The commander damage mode is toggled by tapping a player's commander image (line ~1099-1100). When `gameMode === 'limited'`, prevent entering commander damage mode.

Find the commander image click handler (around line 1099):

```typescript
// Replace:
if (!commanderDamageMode && !playerState.eliminated) {
  setCommanderDamageMode(true);
// With:
if (!commanderDamageMode && !playerState.eliminated && gameMode !== 'limited') {
  setCommanderDamageMode(true);
```

**Step 3: Hide commander image in limited mode**

The commander image is displayed on each player card. When `gameMode === 'limited'`, hide it. Find the commander image rendering section (around line 1090-1120) and wrap it:

```tsx
{gameMode !== 'limited' && (
  // existing commander image block
)}
```

**Step 4: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "feat(draft): disable commander damage and hide commander image in limited mode"
```

---

### Task 16: Draft Deck Selection in PlayerAssignment

**Files:**
- Modify: `frontend/src/components/match-tracker/PlayerAssignment.tsx`

This is the most complex frontend task. When in a draft event, instead of selecting from existing permanent decks, players create/select a temporary draft deck.

**Step 1: Add draft deck props**

Add to `PlayerAssignment` props:

```typescript
interface PlayerAssignmentProps {
  // ... existing props ...
  isDraft?: boolean;
  gameMode?: 'commander' | 'limited';
  eventId?: string;
  draftDecks?: DraftDeck[];
  onDraftDeckRegistered?: (deck: DraftDeck) => void;
}
```

**Step 2: Add draft deck form**

When `isDraft` is true, replace the normal deck dropdown for each player slot with:
- A text input for deck name
- For limited mode: color picker (W/U/B/R/G checkboxes rendered as mana pips)
- For commander mode: commander autocomplete (reuse `CommanderAutocomplete`), colors auto-populated

If the player already has a draft deck in `draftDecks`, pre-fill the form.

**Step 3: Submit draft deck on assignment**

Before transitioning to the game step, call `eventApi.registerDraftDeck()` for each player's deck.

When building the `PlayerSlot`, use a synthetic deck ID (e.g., `draft-{player_id}`) and the draft deck name/commander info.

**Step 4: Pass draft props from EventMatchTracker**

In `EventMatchTracker.tsx`, pass the new props:

```tsx
<PlayerAssignment
  // ... existing props ...
  isDraft={event?.event_type === 'draft'}
  gameMode={event?.game_mode}
  eventId={eventId}
  draftDecks={event?.draft_decks}
  onDraftDeckRegistered={(deck) => {
    // Update local event state with new deck
    if (event) {
      const updatedDecks = [...event.draft_decks.filter(d => d.player_id !== deck.player_id), deck];
      setEvent({ ...event, draft_decks: updatedDecks });
    }
  }}
/>
```

**Step 5: Commit**

```bash
git add frontend/src/components/match-tracker/PlayerAssignment.tsx frontend/src/pages/EventMatchTracker.tsx
git commit -m "feat(draft): add draft deck creation flow in player assignment"
```

---

### Task 17: Update EventLiveView for Draft

**Files:**
- Modify: `frontend/src/pages/EventLiveView.tsx`

**Step 1: Read current file and adapt**

Apply the same changes as EventDashboard:
- Show 1v1 matchup cards for draft events
- Simplified standings (W-L record)
- Set icons in header
- Game mode badge

**Step 2: Commit**

```bash
git add frontend/src/pages/EventLiveView.tsx
git commit -m "feat(draft): adapt live view for draft events"
```

---

### Task 18: Integration Testing & Polish

**Step 1: Start dev servers**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777 &
cd frontend && npm run dev &
```

**Step 2: Test the full draft flow end-to-end**

1. Create a draft event (pick sets, game mode, even player count)
2. Verify set icons appear on event card in list
3. Start the draft (verify 1v1 pairings)
4. Start a match in a pod
5. Verify draft deck creation form appears
6. For limited: verify 20 starting life, no commander damage
7. For commander: verify 40 life, commander damage enabled
8. Complete match, verify W/L scoring
9. Advance round, verify Swiss pairing (players paired by record, no rematches)
10. Complete event, verify final standings show W-L

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(draft): polish and integration fixes"
```
