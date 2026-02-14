# Draft Events Design

## Overview

Add a "Draft" event type to the existing tournament events system. Drafts use Swiss pairing with 1v1 matches, temporary event-scoped decks, and support both Commander (40 life) and Limited (20 life, no commander damage) game modes. MTG sets are selected via Scryfall and used as event branding.

## Approach

Extend the existing `Event` model (Approach 1) rather than creating a separate model. The tournament and draft lifecycles are ~80% identical — the differences are pairing algorithm, scoring, deck handling, and match mode.

## Data Model

### New sub-models (`event.py`)

```python
class DraftSet(BaseModel):
    """An MTG set used in the draft"""
    code: str           # e.g. "MKM"
    name: str           # e.g. "Murders at Karlov Manor"
    icon_svg_uri: str   # Scryfall set icon URL

class DraftDeck(BaseModel):
    """A temporary deck built during a draft event"""
    player_id: str
    name: str
    colors: list[str]                        # W/U/B/R/G
    commander: Optional[str] = None          # Commander mode only
    commander_image_url: Optional[str] = None # Commander mode only
```

### New fields on `Event` document

```python
game_mode: Optional[str] = None      # "commander" | "limited" (draft only)
sets: list[DraftSet] = []            # 1-4 MTG sets (draft only)
draft_decks: list[DraftDeck] = []    # Temporary decks (draft only)
```

### Modified fields

- `player_count` validator: tournaments stay 4/8/12, drafts allow any even number 4-12
- `event_type`: accepts `"draft"` in addition to `"tournament"`

### Match model

- Add `game_mode: Optional[str] = None` so the match tracker knows starting life and whether commander damage is enabled.

### Pods/Pairings

`PodAssignment` works as-is — for drafts, `player_ids` has 2 entries (1v1) instead of 4.

### Standings

`StandingsEntry` already tracks `wins` and `total_points`. For drafts, `total_points` equals `wins` (1 per win, 0 per loss).

## Backend API

### Modified: Create Event (`POST /api/events/`)

`CreateEventRequest` gets new optional fields: `game_mode`, `set_codes` (list of strings). Backend validates event-type-specific rules:
- Draft: require `game_mode`, even player count 4-12
- Tournament: existing 4/8/12 validation

Backend fetches set details from Scryfall (`https://api.scryfall.com/sets/{code}`) for each set code, stores as `DraftSet` objects.

### Modified: Start Tournament (`POST /api/events/{id}/start`)

- Draft: random shuffle, create 1v1 pairings (pods of 2)
- Tournament: existing behavior (pods of 4)

### New: Register Draft Deck (`POST /api/events/{id}/draft-decks`)

```
Body: { player_id, name, colors, commander?, commander_image_url? }
```

Upserts a `DraftDeck` in the event's `draft_decks` list. If commander mode + commander provided, validate via Scryfall and auto-populate colors/image. Called before each match.

### Modified: Complete Pod Match

Draft scoring: winner gets 1 point, loser gets 0. No placement/kill/alt-win breakdown. Stores `game_mode` on the match document.

### Modified: Advance Round

Draft uses Swiss pairing:
1. Group players by win count (descending)
2. Within each group, pair randomly
3. Odd player in a group pushes down to next group
4. Avoid repeat pairings when possible (check previous rounds)

Tournament: existing standings-based pod seeding (unchanged).

### New: Scryfall Set Search (`GET /api/events/sets/search?q=`)

Proxies to Scryfall's `https://api.scryfall.com/sets`, filters by query. Returns matching sets with `code`, `name`, `icon_svg_uri`. Used by the frontend set picker.

### Unchanged endpoints

`GET /events/{id}`, `GET /events/{id}/live`, `GET /events/pod/{pod_id}`, `DELETE /events/{id}`, `POST /events/{id}/complete` — all work as-is.

## Frontend

### Event Creation (`EventCreate.tsx`)

- Event type selector at top: "Tournament" or "Draft" toggle
- Draft mode shows:
  - Player count: any even number 4-12 (dropdown/slider)
  - Game mode picker: "Commander" or "Limited"
  - Set picker (new component): autocomplete search, chips for selected sets (max 4)
  - Round count picker (same as tournament)
  - Player selection: same as tournament, validates even count

### New Component: `SetPicker.tsx`

- Text input with debounced Scryfall search (300ms)
- Dropdown shows set name + icon + release year
- Selected sets render as removable chips
- Max 4 sets

### Draft Deck Creation (before each match)

Inline form in match setup screen, replacing normal deck dropdown:
- **Limited mode**: deck name + color picker (W/U/B/R/G checkboxes as mana pips)
- **Commander mode**: deck name + commander autocomplete (reuse `CommanderAutocomplete`), colors auto-populated

Pre-filled if player already has a draft deck; editable.

### Event Cards (`EventsList.tsx`)

- Draft events show set icon(s) instead of generic trophy icon
- Badge: "Draft"
- Sub-text: "Commander Draft" or "Limited Draft"

### Event Dashboard (`EventDashboard.tsx`)

- Rounds display 1v1 matchup cards: "Player A vs Player B"
- Status: pending / in progress / completed (winner highlighted)
- Draft deck name + color pips on matchup cards
- Standings: simplified table — Rank, Player, W-L record (no points breakdown)

### Match Tracker

- **Limited mode**: starting life 20, commander damage panel hidden
- **Commander mode**: no changes, same as today
- 1v1 layout already supported

### Live View (`EventLiveView.tsx`)

Same adjustments as dashboard: 1v1 matchup cards, simplified standings.

## Key Decisions

- **Draft decks are event-scoped**: stored in `Event.draft_decks`, never in the `decks` collection
- **Draft results are event-only**: no impact on main leaderboard or player stats
- **Swiss pairing avoids rematches**: checks previous rounds when pairing
- **Sets are metadata + branding**: no gameplay impact, displayed on event cards/headers
