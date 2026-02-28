# Deck Borrowing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow players to borrow a pod-mate's deck during a game, display it clearly in match history, and exclude the borrower from all stat calculations while other players in the same match count normally.

**Architecture:** Add `borrowed_from_player_id` to the `MatchPlayer` model (backend) and `PlayerSlot` interface (frontend). The SmashDeckSelect screen gets a "Borrow Deck" tile that opens a grouped deck browser. All five stat endpoints add per-player guards to skip borrowed entries. The field is nullable and backward-compatible.

**Tech Stack:** FastAPI (Python), Beanie ODM, React + TypeScript, Tailwind CSS v4

**Design doc:** `docs/plans/2026-02-28-deck-borrowing-design.md`

---

### Task 1: Backend — Add `borrowed_from_player_id` to MatchPlayer model

**Files:**
- Modify: `backend/app/models/match.py` (line 18, end of MatchPlayer fields)

**Step 1: Add the field to MatchPlayer**

After line 18 (`is_alt_win: bool = False`), add:

```python
    borrowed_from_player_id: Optional[str] = None  # If set, deck was borrowed from this player
    borrowed_from_player_name: Optional[str] = None  # Snapshot of lender's name at match creation
```

**Step 2: Verify backend starts**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
```

Expected: Server starts without errors. Existing matches are unaffected (new fields default to `None`).

**Step 3: Commit**

```bash
git add backend/app/models/match.py
git commit -m "feat: add borrowed_from_player_id to MatchPlayer model"
```

---

### Task 2: Backend — Accept borrowed_from_player_id in match creation

**Files:**
- Modify: `backend/app/routers/matches.py` (lines 16-25 CreateMatchRequest, lines 140-189 create_match)

**Step 1: Update CreateMatchRequest docstring**

The `player_deck_pairs` field already accepts `list[dict[str, str]]`. Since dicts are flexible, no schema change is needed — the endpoint just needs to read the optional key. Add a comment to the field:

At line 18, update the comment:
```python
    player_deck_pairs: list[dict[str, str]]  # [{"player_id": "...", "deck_id": "...", "borrowed_from_player_id"?: "..."}, ...]
```

**Step 2: Read borrowed_from_player_id in the match creation loop**

In the `create_match` function, inside the `for pair in request.player_deck_pairs:` loop (line 144), after `deck_id = pair["deck_id"]` (line 146), add:

```python
        borrowed_from_player_id = pair.get("borrowed_from_player_id")
```

**Step 3: Snapshot the lender's name**

After the player/deck fetching block (after line 170), add:

```python
        # If borrowing, snapshot the lender's name
        borrowed_from_player_name = None
        if borrowed_from_player_id:
            lender = await Player.get(PydanticObjectId(borrowed_from_player_id))
            borrowed_from_player_name = lender.name if lender else "Unknown"
```

**Step 4: Pass borrowed fields to MatchPlayer constructor**

In the `MatchPlayer(...)` constructor (line 179), add the two new fields:

```python
        match_players.append(MatchPlayer(
            player_id=player_id,
            player_name=player.name,
            deck_id=deck_id,
            deck_name=deck_name,
            deck_colors=deck_colors,
            elimination_order=elimination_order,
            is_winner=is_winner,
            eliminated_by_player_id=elim_detail.get('eliminated_by_player_id'),
            elimination_type=elim_detail.get('elimination_type'),
            borrowed_from_player_id=borrowed_from_player_id,
            borrowed_from_player_name=borrowed_from_player_name,
        ))
```

**Step 5: Update serialize_match to include borrowed fields**

In `serialize_match` (line 40), add to the player dict comprehension (after `"elimination_type": p.elimination_type` at line 54):

```python
                "borrowed_from_player_id": p.borrowed_from_player_id,
                "borrowed_from_player_name": p.borrowed_from_player_name,
```

**Step 6: Verify**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
```

Hit `GET /api/matches/recent` and verify existing matches now include `borrowed_from_player_id: null` in each player.

**Step 7: Commit**

```bash
git add backend/app/routers/matches.py
git commit -m "feat: accept and store borrowed_from_player_id in match creation"
```

---

### Task 3: Backend — Add stat exclusion guards to leaderboard.py

**Files:**
- Modify: `backend/app/routers/leaderboard.py`

**Context:** There are 6 places in this file where match players are iterated for stats. Each needs a guard to skip borrowed players. The tricky part is the `winner_player_id` fast-path checks — these don't iterate `match.players`, so we need a helper.

**Step 1: Add a helper function at the top of the file (after line 16)**

```python
def _player_borrowed_in_match(match: Match, player_id: str) -> bool:
    """Check if a player was borrowing a deck in a given match."""
    for p in match.players:
        if p.player_id == player_id and p.borrowed_from_player_id:
            return True
    return False


def _deck_borrowed_in_match(match: Match, deck_id: str) -> bool:
    """Check if a deck was being borrowed (played by someone other than owner) in a match."""
    for p in match.players:
        if p.deck_id == deck_id and p.borrowed_from_player_id:
            return True
    return False
```

**Step 2: Update get_player_leaderboard (lines 66, 69)**

Replace line 66:
```python
        games_played = sum(1 for match in matches if any(p.player_id == player_id and not p.borrowed_from_player_id for p in match.players))
```

Replace line 69:
```python
        wins = sum(1 for match in matches if match.winner_player_id == player_id and not _player_borrowed_in_match(match, player_id))
```

**Step 3: Update get_deck_leaderboard (lines 171, 174)**

Replace line 171:
```python
        games_played = sum(1 for match in matches if any(p.deck_id == deck_id and not p.borrowed_from_player_id for p in match.players))
```

Replace line 174:
```python
        wins = sum(1 for match in matches if match.winner_deck_id == deck_id and not _deck_borrowed_in_match(match, deck_id))
```

**Step 4: Update get_dashboard_stats (lines 267, 291)**

Replace line 267:
```python
            games_played = sum(1 for match in matches if any(p.player_id == player_id and not p.borrowed_from_player_id for p in match.players))
```

Replace line 291:
```python
            games_played = sum(1 for match in matches if any(p.deck_id == deck_id and not p.borrowed_from_player_id for p in match.players))
```

**Step 5: Update pod_balance winner counting (line 387)**

Replace line 387:
```python
        win_counts = Counter(
            match.winner_player_id for match in recent_matches
            if not _player_borrowed_in_match(match, match.winner_player_id)
        )
```

**Step 6: Verify**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
```

Hit `GET /api/leaderboard/players` and `GET /api/leaderboard/decks` — should return same results as before (no borrowed matches exist yet).

**Step 7: Commit**

```bash
git add backend/app/routers/leaderboard.py
git commit -m "feat: exclude borrowed deck players from leaderboard stats"
```

---

### Task 4: Backend — Add stat exclusion guards to player detail

**Files:**
- Modify: `backend/app/routers/players.py` (lines 132-133, 141-143, 160-161)

**Step 1: Add the same helper import or inline helper**

At the top of the file, after imports, add:

```python
def _player_borrowed_in_match(match: Match, player_id: str) -> bool:
    """Check if a player was borrowing a deck in a given match."""
    for p in match.players:
        if p.player_id == player_id and p.borrowed_from_player_id:
            return True
    return False


def _deck_borrowed_in_match(match: Match, deck_id: str) -> bool:
    """Check if a deck was being borrowed in a match."""
    for p in match.players:
        if p.deck_id == deck_id and p.borrowed_from_player_id:
            return True
    return False
```

**Step 2: Update player stats (lines 132-133)**

Replace line 132:
```python
    games_played = sum(1 for match in all_matches if any(p.player_id == player_id_str and not p.borrowed_from_player_id for p in match.players))
```

Replace line 133:
```python
    wins = sum(1 for match in all_matches if match.winner_player_id == player_id_str and not _player_borrowed_in_match(match, player_id_str))
```

**Step 3: Update rank calculation loop (lines 141-143)**

Replace lines 141-143:
```python
        p_games = sum(1 for match in all_matches if any(mp.player_id == p_id and not mp.borrowed_from_player_id for mp in match.players))
        p_wins = sum(1 for match in all_matches if match.winner_player_id == p_id and not _player_borrowed_in_match(match, p_id))
```

**Step 4: Update per-deck stats (lines 160-161)**

Replace line 160:
```python
        deck_games = sum(1 for match in all_matches if any(p.deck_id == deck_id and not p.borrowed_from_player_id for p in match.players))
```

Replace line 161:
```python
        deck_wins = sum(1 for match in all_matches if match.winner_deck_id == deck_id and not _deck_borrowed_in_match(match, deck_id))
```

**Step 5: Verify and commit**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
git add backend/app/routers/players.py
git commit -m "feat: exclude borrowed deck players from player detail stats"
```

---

### Task 5: Backend — Add stat exclusion guard to Elo service

**Files:**
- Modify: `backend/app/services/elo_service.py` (line 57)

**Step 1: Add guard inside process_match_elo**

At line 57, inside the `for mp in match.players:` loop, add as the first line:

```python
        if mp.borrowed_from_player_id:
            continue  # Borrowed deck players don't affect Elo
```

The full loop becomes:
```python
    for mp in match.players:
        if mp.borrowed_from_player_id:
            continue
        rating = await get_or_create_player_elo(mp.player_id, match.pod_id)
        player_elos.append((mp.player_id, rating.current_elo))
```

**Step 2: Guard the winner check**

At line 62, the winner_player_id is passed to `calculate_multiplayer_elo_changes`. If the winner was borrowing, they're not in `player_elos` and the function would get an unknown winner. Add a guard:

```python
    # If the winner was borrowing, they're excluded - use None as winner
    actual_winner = match.winner_player_id
    if _player_borrowed_in_match(match, actual_winner):
        actual_winner = None

    changes = calculate_multiplayer_elo_changes(player_elos, actual_winner)
```

Add the helper function (or import from a shared module):
```python
def _player_borrowed_in_match(match, player_id):
    for p in match.players:
        if p.player_id == player_id and p.borrowed_from_player_id:
            return True
    return False
```

**Step 3: Check if `calculate_multiplayer_elo_changes` handles None winner**

Read the function to see if it handles `winner_player_id=None`. If not, add a guard at the top of that function:
```python
if winner_player_id is None:
    return {}  # No Elo changes if winner was borrowing
```

**Step 4: Verify and commit**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
git add backend/app/services/elo_service.py
git commit -m "feat: exclude borrowed deck players from Elo calculations"
```

---

### Task 6: Backend — Add stat exclusion guard to pod dynamics

**Files:**
- Modify: `backend/app/routers/pod_dynamics.py` (inside `get_elimination_stats`)

**Context:** This is a large function (~250 lines) that iterates matches and accumulates kill stats, scoops, placements, kill_pairs, etc. The main per-player loop is inside a `for match in matches_with_data:` loop.

**Step 1: Find the per-player inner loop**

Inside the match loop, there's a `for player in match.players:` (or similar) loop that accumulates per-player stats. Add as the first line inside that loop:

```python
            if player.borrowed_from_player_id:
                continue  # Skip borrowed deck players from combat stats
```

**Step 2: Guard the winner detection**

Wherever the match winner is identified for stats (e.g., `winner = next((p for p in match.players if p.is_winner), None)`), add a check:

```python
            # Don't credit wins to borrowed players
            if winner and winner.borrowed_from_player_id:
                winner = None
```

**Step 3: Guard kill_pairs tracking**

In the kill pairs accumulation, make sure borrowed players don't contribute kills or deaths. The `eliminated_by_player_id` tracking should skip if either the killer or victim was borrowing:

```python
            if player.eliminated_by_player_id and not player.borrowed_from_player_id:
                killer_id = player.eliminated_by_player_id
                # Also check if the killer was borrowing
                killer_mp = next((p for p in match.players if p.player_id == killer_id), None)
                if killer_mp and not killer_mp.borrowed_from_player_id:
                    kill_pairs[(killer_id, player.player_id)] = kill_pairs.get((killer_id, player.player_id), 0) + 1
```

**Step 4: Verify and commit**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
git add backend/app/routers/pod_dynamics.py
git commit -m "feat: exclude borrowed deck players from pod dynamics stats"
```

---

### Task 7: Frontend — Update TypeScript interfaces

**Files:**
- Modify: `frontend/src/services/api.ts` (lines 152-162 MatchPlayer, lines 297-309 CreateMatchRequest)

**Step 1: Add borrowed fields to MatchPlayer interface (after line 161)**

```typescript
export interface MatchPlayer {
  player_id: string;
  player_name: string;
  deck_id: string;
  deck_name: string;
  deck_colors: string[];
  elimination_order?: number;
  is_winner: boolean;
  eliminated_by_player_id?: string;
  elimination_type?: 'kill' | 'scoop';
  borrowed_from_player_id?: string;    // NEW
  borrowed_from_player_name?: string;  // NEW
}
```

**Step 2: Update CreateMatchRequest player_deck_pairs type (line 298)**

```typescript
export interface CreateMatchRequest {
  player_deck_pairs: Array<{
    player_id: string;
    deck_id: string;
    borrowed_from_player_id?: string;  // NEW
  }>;
  winner_player_id: string;
  winner_deck_id: string;
  match_date: string;
  duration_seconds?: number;
  first_player_position?: number;
  elimination_orders?: Record<string, number>;
  elimination_details?: Record<string, {
    eliminated_by_player_id?: string;
    elimination_type: 'kill' | 'scoop';
  }>;
}
```

**Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add borrowed deck fields to TypeScript interfaces"
```

---

### Task 8: Frontend — Add borrowed fields to PlayerSlot and thread through match save

**Files:**
- Modify: `frontend/src/pages/MatchTracker.tsx` (lines 20-30 PlayerSlot, lines 291-296 playerDeckPairs)

**Step 1: Add fields to PlayerSlot interface (line 20-30)**

Add before the closing `}`:

```typescript
export interface PlayerSlot {
  position: number;
  playerId: string | null;
  playerName: string;
  deckId: string | null;
  deckName: string;
  commanderName: string;
  commanderImageUrl: string;
  isGuest: boolean;
  killMessages?: string[];
  borrowedFromPlayerId?: string | null;    // NEW
  borrowedFromPlayerName?: string | null;  // NEW
}
```

**Step 2: Thread borrowed field through playerDeckPairs (lines 291-296)**

Replace the `playerDeckPairs` construction:

```typescript
    const playerDeckPairs = matchState.players
      .filter(p => p.playerId && p.deckId)
      .map(p => ({
        player_id: p.playerId!,
        deck_id: p.deckId!,
        ...(p.borrowedFromPlayerId ? { borrowed_from_player_id: p.borrowedFromPlayerId } : {}),
      }));
```

**Step 3: Commit**

```bash
git add frontend/src/pages/MatchTracker.tsx
git commit -m "feat: add borrowed fields to PlayerSlot and match save"
```

---

### Task 9: Frontend — Create BorrowDeckSelect component

**Files:**
- Create: `frontend/src/components/match-tracker/smash-select/BorrowDeckSelect.tsx`

**Context:** Full-screen overlay showing all other pod members' decks grouped by owner. Uses same styling patterns as SmashDeckSelect. Uses existing DeckTile component.

**Step 1: Create the component**

```tsx
import { useState, useEffect, useMemo } from 'react';
import { deckApi, playerApi, type Deck, type Player } from '../../../services/api';
import SmashHeader from './SmashHeader';
import DeckTile from './DeckTile';

interface BorrowDeckSelectProps {
  seatNumber: number;
  playerCount: number;
  currentPlayerId: string;
  assignedDeckIds: string[];  // Decks already in use this game
  onSelect: (deck: Deck, ownerId: string, ownerName: string) => void;
  onBack: () => void;
}

interface DeckGroup {
  playerId: string;
  playerName: string;
  avatar?: string | null;
  decks: Deck[];
}

function BorrowDeckSelect({
  seatNumber,
  playerCount,
  currentPlayerId,
  assignedDeckIds,
  onSelect,
  onBack,
}: BorrowDeckSelectProps) {
  const [deckGroups, setDeckGroups] = useState<DeckGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const shouldRotate = (() => {
    if (playerCount === 2) return seatNumber === 1;
    if (playerCount === 3 || playerCount === 4) return seatNumber <= 2;
    if (playerCount === 5 || playerCount === 6) return seatNumber <= 3;
    return false;
  })();

  useEffect(() => {
    loadDecks();
  }, [currentPlayerId]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const [allDecks, allPlayers] = await Promise.all([
        deckApi.getAll(),
        playerApi.getAll(),
      ]);

      // Filter to other players' enabled decks
      const otherDecks = allDecks.filter(
        d => d.player_id !== currentPlayerId && !d.disabled
      );

      // Group by owner
      const playerMap = new Map(allPlayers.map(p => [p.id, p]));
      const grouped = new Map<string, DeckGroup>();

      for (const deck of otherDecks) {
        if (!grouped.has(deck.player_id)) {
          const owner = playerMap.get(deck.player_id);
          grouped.set(deck.player_id, {
            playerId: deck.player_id,
            playerName: owner?.name || 'Unknown',
            avatar: owner?.picture || owner?.custom_avatar || owner?.avatar,
            decks: [],
          });
        }
        grouped.get(deck.player_id)!.decks.push(deck);
      }

      setDeckGroups(Array.from(grouped.values()).sort((a, b) => a.playerName.localeCompare(b.playerName)));
    } catch (err) {
      console.error('[BorrowDeckSelect] Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (deck: Deck, group: DeckGroup) => {
    onSelect(deck, group.playerId, group.playerName);
  };

  return (
    <div className="smash-screen smash-slide-in">
      <div
        className="smash-screen-content"
        style={shouldRotate ? { transform: 'rotate(180deg)' } : undefined}
      >
        <SmashHeader
          seatNumber={seatNumber}
          title="Borrow a Deck"
          subtitle="Pick from another player"
          onBack={onBack}
        />

        <div className="smash-deck-grid-container" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="smash-loading">
              <div className="smash-loading-spinner" />
              <div className="smash-loading-text">Loading decks...</div>
            </div>
          ) : deckGroups.length === 0 ? (
            <div className="smash-empty">
              <div className="smash-empty-icon">🤝</div>
              <div className="smash-empty-title">No decks available</div>
              <div className="smash-empty-subtitle">
                No other players have decks to borrow
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-3">
              {deckGroups.map(group => (
                <div key={group.playerId}>
                  {/* Owner header */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <img
                      src={group.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${group.playerName}`}
                      alt={group.playerName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-white/70 text-sm font-medium">
                      {group.playerName}'s Decks
                    </span>
                  </div>
                  {/* Deck grid for this owner */}
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(group.decks.length, 3)}, 1fr)`,
                    }}
                  >
                    {group.decks.map((deck, index) => {
                      const isAssigned = assignedDeckIds.includes(deck.id!);
                      return (
                        <div
                          key={deck.id}
                          style={{ opacity: isAssigned ? 0.3 : 1, pointerEvents: isAssigned ? 'none' : 'auto' }}
                        >
                          <DeckTile
                            deck={deck}
                            onSelect={() => handleSelect(deck, group)}
                            animationDelay={index * 50}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BorrowDeckSelect;
```

**Step 2: Commit**

```bash
git add frontend/src/components/match-tracker/smash-select/BorrowDeckSelect.tsx
git commit -m "feat: create BorrowDeckSelect component for borrowing pod decks"
```

---

### Task 10: Frontend — Add "Borrow Deck" tile to SmashDeckSelect

**Files:**
- Modify: `frontend/src/components/match-tracker/smash-select/SmashDeckSelect.tsx`

**Step 1: Update props to accept callbacks and state for borrowing**

Update the interface (line 7) to add:

```typescript
interface SmashDeckSelectProps {
  seatNumber: number;
  playerCount: number;
  playerId: string;
  playerName: string;
  assignedDeckIds: string[];  // NEW - decks already in use
  onSelect: (deck: Deck) => void;
  onBorrowSelect: (deck: Deck, ownerId: string, ownerName: string) => void;  // NEW
  onBack: () => void;
}
```

**Step 2: Add state and import for BorrowDeckSelect**

At the top:
```typescript
import BorrowDeckSelect from './BorrowDeckSelect';
```

Inside the component, add state:
```typescript
const [showBorrowSelect, setShowBorrowSelect] = useState(false);
```

**Step 3: Update grid layout to account for borrow tile**

Replace line 79:
```typescript
const gridLayout = useMemo(() => getGridLayout(decks.length + 2), [decks.length]); // +2 for Quick Add and Borrow
```

**Step 4: Add the Borrow Deck tile next to the Quick Add tile**

After the Quick Add `<button>` (line 148), add:

```tsx
              {/* Borrow Deck tile */}
              <button
                className="smash-deck-tile smash-quick-add-tile"
                style={{ animationDelay: `${(decks.length + 1) * 50}ms` }}
                onClick={() => setShowBorrowSelect(true)}
              >
                <div className="smash-quick-add-content">
                  <span className="smash-quick-add-icon">🤝</span>
                  <span className="smash-quick-add-label">Borrow</span>
                </div>
              </button>
```

**Step 5: Render BorrowDeckSelect overlay when active**

After the QuickDeckForm modal block (line 162), add:

```tsx
      {showBorrowSelect && (
        <BorrowDeckSelect
          seatNumber={seatNumber}
          playerCount={playerCount}
          currentPlayerId={playerId}
          assignedDeckIds={assignedDeckIds}
          onSelect={(deck, ownerId, ownerName) => {
            setShowBorrowSelect(false);
            onBorrowSelect(deck, ownerId, ownerName);
          }}
          onBack={() => setShowBorrowSelect(false)}
        />
      )}
```

**Step 6: Commit**

```bash
git add frontend/src/components/match-tracker/smash-select/SmashDeckSelect.tsx
git commit -m "feat: add Borrow Deck tile to SmashDeckSelect"
```

---

### Task 11: Frontend — Wire up borrowing in PlayerAssignment

**Files:**
- Modify: `frontend/src/components/match-tracker/PlayerAssignment.tsx` (lines 201-222 handleDeckSelect, lines 414-423 SmashDeckSelect render)

**Step 1: Compute assignedDeckIds**

Above the return statement, add:

```typescript
const assignedDeckIds = players
  .filter(p => p.deckId)
  .map(p => p.deckId!);
```

**Step 2: Add handleBorrowSelect callback**

After `handleDeckSelect` (line 222), add:

```typescript
const handleBorrowSelect = (deck: Deck, ownerId: string, ownerName: string) => {
  if (selectionPhase.type !== 'deck-select') return;

  const { position, playerId, playerName, killMessages } = selectionPhase;
  const updatedPlayers = [...players];
  updatedPlayers[position - 1] = {
    position,
    playerId,
    playerName,
    deckId: deck.id!,
    deckName: deck.name,
    commanderName: deck.commander,
    commanderImageUrl: deck.commander_image_url || '',
    isGuest: false,
    killMessages,
    borrowedFromPlayerId: ownerId,
    borrowedFromPlayerName: ownerName,
  };
  setPlayers(updatedPlayers);
  setSelectionPhase({ type: 'grid' });
  if (onDeckSelected && playerId && deck.id) {
    onDeckSelected(playerId, deck.id);
  }
};
```

**Step 3: Pass new props to SmashDeckSelect**

Where SmashDeckSelect is rendered (around line 414), add the new props:

```tsx
<SmashDeckSelect
  seatNumber={selectionPhase.position}
  playerCount={playerCount}
  playerId={selectionPhase.playerId}
  playerName={selectionPhase.playerName}
  assignedDeckIds={assignedDeckIds}
  onSelect={handleDeckSelect}
  onBorrowSelect={handleBorrowSelect}
  onBack={() => setSelectionPhase({ type: 'grid' })}
/>
```

**Step 4: Show "Borrowed" indicator on assigned slot card**

In the slot card rendering, after the deck name display, add a conditional badge:

```tsx
{player.borrowedFromPlayerName && (
  <div className="text-[10px] text-amber-400/80 truncate">
    Borrowed from {player.borrowedFromPlayerName}
  </div>
)}
```

**Step 5: Verify in browser**

Start frontend: `cd frontend && npm run dev`

Go to Match Tracker → assign a player → in deck select, tap "Borrow" → select a deck from another player → verify slot shows borrowed indicator.

**Step 6: Commit**

```bash
git add frontend/src/components/match-tracker/PlayerAssignment.tsx
git commit -m "feat: wire up deck borrowing in PlayerAssignment"
```

---

### Task 12: Frontend — Add borrowed badge to ActiveGame

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Context:** During the game, each player has a card showing their name, life total, deck name, and commander image. We need a subtle "Borrowed" badge.

**Step 1: Find where deck name is displayed on each player card**

Look for where `player.deckName` is rendered. Add below it:

```tsx
{player.borrowedFromPlayerName && (
  <span className="text-[9px] text-amber-400/70 font-medium">
    Borrowed
  </span>
)}
```

**Step 2: Verify in browser**

Start a game with a borrowed deck. The player card should show a small "Borrowed" indicator.

**Step 3: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "feat: show borrowed badge on player cards during game"
```

---

### Task 13: Frontend — Show "Borrowed from X" in RecentMatches

**Files:**
- Modify: `frontend/src/components/RecentMatches.tsx`

**Step 1: In the WinnerSection, add borrowed indicator**

After the deck name display (around line 231-232), add:

```tsx
{player.borrowed_from_player_name && (
  <div className="text-[10px] text-amber-400/80">
    Borrowed from {player.borrowed_from_player_name}
  </div>
)}
```

**Step 2: In the PlayerPlacement section, add borrowed indicator**

After the deck name display (around line 280-282), add:

```tsx
{player.borrowed_from_player_name && (
  <div className="text-[9px] text-amber-400/70">
    Borrowed from {player.borrowed_from_player_name}
  </div>
)}
```

**Step 3: Verify in browser**

Record a match with a borrowed deck. Check Recent Matches on the dashboard — the borrowed deck entry should show "Borrowed from {name}".

**Step 4: Commit**

```bash
git add frontend/src/components/RecentMatches.tsx
git commit -m "feat: show borrowed deck indicator in recent matches"
```

---

### Task 14: End-to-end verification

**Step 1: Start both servers**

```bash
# Terminal 1
cd backend && uv run uvicorn app.main:app --reload --port 7777

# Terminal 2
cd frontend && npm run dev
```

**Step 2: Test the full flow**

1. Open Match Tracker
2. Assign Player A with their own deck
3. Assign Player B — tap "Borrow" — pick one of Player A's other decks
4. Assign Player C and D with their own decks
5. Verify Player B's slot shows "Borrowed from Player A"
6. Start the game — verify "Borrowed" badge on Player B's card
7. Play through — eliminate players, select a winner
8. Save match
9. Check Recent Matches — verify "Borrowed from Player A" appears under Player B's deck

**Step 3: Test stat exclusion**

1. Check Player B's leaderboard entry — games_played should NOT include the borrowed game
2. Check the borrowed deck's leaderboard entry — should NOT include this game
3. Check other players (A, C, D) — their stats SHOULD include this game normally
4. Check pod dynamics — Player B should not appear in kill/death stats for this game

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: deck borrowing - end-to-end verified"
```
