# Live Broadcast View Design

**Date:** 2026-02-15
**Status:** Approved

## Problem

The EventLiveView currently shows tournament structure and final results, but has no visibility into active matches. The match tracker on players' phones tracks rich game state (life totals, eliminations, commander damage, timers) but this data never leaves the device. Spectators watching on a TV/projector at the table can't see what's happening in games.

## Goal

Add live game state syncing so the broadcast view shows life totals, elimination status, and game progress for all active pods — like a real tournament broadcast on a shared screen at the table.

## Approach

**Backend Game State Sync:** The match host's phone periodically POSTs a compact game state snapshot to a new backend endpoint. The broadcast screen polls the existing `/events/{id}/live` endpoint (no auth) and gets enriched data including live game states per pod.

```
Player phone (match host) -> PUT /events/{id}/rounds/{r}/pods/{p}/game-state -> MongoDB
                                                                                  |
Broadcast screen <- GET /events/{id}/live (polls every 3s) <----------------------+
```

## Data Model

### New embedded models (in `event.py`)

```python
class LivePlayerState(BaseModel):
    player_id: str
    life: int = 40
    eliminated: bool = False
    eliminated_by_player_id: Optional[str] = None
    elimination_type: Optional[str] = None  # "kill" | "scoop"

class LiveGameState(BaseModel):
    elapsed_seconds: int = 0
    player_states: dict[str, LivePlayerState] = {}  # keyed by player_id
    updated_at: datetime
```

### Modified model

`PodAssignment` gains one optional field:

```python
live_game_state: Optional[LiveGameState] = None
```

### Why embedded, not a separate collection

- Game state is tied to a pod match lifecycle
- The `/live` endpoint already returns full event with pods — no extra query
- Auto-cleaned when match completes (set to None)
- Keeps data model simple

## Backend Changes

### New endpoint

`PUT /events/{event_id}/rounds/{round}/pods/{pod}/game-state`

- **No auth** (matches the `/live` endpoint pattern — broadcast-friendly)
- Accepts `LiveGameState` payload (~200 bytes)
- Uses atomic `$set` on nested path (same pattern as existing `set-deck`)
- Validates event is active and pod is in_progress

### Modified endpoint

`POST /.../complete-match` — clears `live_game_state` on the pod when match completes.

### Modified serializer

`serialize_event` includes `live_game_state` in each pod object when present.

## Frontend Sync (EventMatchTracker)

### Hook location

`EventMatchTracker` already wraps `ActiveGame` and handles `onUpdateGameState`. Add sync logic here.

### Sync strategy

- Debounced POST: 1.5 second debounce on game state changes
- Immediate POST on eliminations (high-value events)
- Map position-keyed `playerStates` to player-ID-keyed `player_states`
- Only sync when in an event match (not standalone/quick-play)

### What syncs

- `life`, `eliminated`, `eliminated_by_player_id`, `elimination_type`, `elapsed_seconds`

### What does NOT sync

- Commander damage (out of scope)
- UI state (dice rolls, gestures, menu, visual deltas)
- `revived`, `forceEliminated` (internal tracker details)

## Frontend Broadcast (EventLiveView)

### Polling

3-second interval when event is active and any pods are `in_progress`. Stops when all pods complete or event is not active.

### LivePodCard layout

Per pod with live state:

```
+-------------------------------------+
| Pod 1                     timer 12:34|
|                                      |
| [green] Nick        life 38          |
|   Atraxa, Grand Unifier             |
|                                      |
| [green] Sarah       life 31          |
|   Kenrith, the Returned King        |
|                                      |
| [skull] Mike        life 0   by Nick |
|   Korvold, Fae-Cursed King          |
|                                      |
| [green] Jake        life 22          |
|   Tymna / Thrasios                  |
+-------------------------------------+
```

### Display elements per player

- Status: green dot (alive) or skull (eliminated)
- Player name + avatar
- Life total (large) with color coding: green > 30, yellow 15-30, red < 15
- Commander name (from existing `player_decks` data)
- If eliminated: "by {killer}" or "scooped" in muted text
- Eliminated players visually dimmed

### Pod grid layout

- 1 pod: full width
- 2 pods: side by side
- 3 pods: 3 columns or 2+1

### Fallback states

- `match_status: "pending"` — "Waiting to start"
- `match_status: "in_progress"` + no game state — "Match in progress"
- `match_status: "completed"` — winner with trophy icon

## Files to modify

| File | Change |
|------|--------|
| `backend/app/models/event.py` | Add `LivePlayerState`, `LiveGameState`. Add `live_game_state` to `PodAssignment` |
| `backend/app/routers/events.py` | Add game-state endpoint, update serializer, clear on match complete |
| `frontend/src/services/api.ts` | Add interfaces and `updateGameState` method, update `PodAssignment` |
| `frontend/src/pages/EventMatchTracker.tsx` | Add debounced sync hook |
| `frontend/src/pages/EventLiveView.tsx` | Add polling, add `LivePodCard` component |

## Out of scope

- Commander damage display
- Event feed / play-by-play log
- WebSocket / SSE real-time push
- Changes to standalone MatchTracker (only EventMatchTracker syncs)
