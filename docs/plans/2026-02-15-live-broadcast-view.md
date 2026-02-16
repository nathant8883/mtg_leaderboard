# Live Broadcast View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync in-progress match game state (life totals, eliminations) from the match host's phone to the backend, so the EventLiveView broadcast screen can display live game progress for all active pods.

**Architecture:** The match host's phone debounce-POSTs compact game state snapshots to a new backend endpoint. The broadcast screen polls the existing `/events/{id}/live` endpoint (already public, no auth) every 3 seconds and renders live player cards with life totals and elimination status.

**Tech Stack:** FastAPI + Beanie (backend), React + TypeScript (frontend), MongoDB atomic `$set` for game state updates.

**Design doc:** `docs/plans/2026-02-15-live-broadcast-view-design.md`

---

### Task 1: Backend Models — Add LivePlayerState, LiveGameState, update PodAssignment

**Files:**
- Modify: `backend/app/models/event.py`

**Step 1: Add the new embedded models and update PodAssignment**

Add these two new Pydantic models above `PodAssignment` in `backend/app/models/event.py`:

```python
class LivePlayerState(BaseModel):
    """Live game state for a single player (synced from match host's phone)"""
    player_id: str
    life: int = 40
    eliminated: bool = False
    eliminated_by_player_id: Optional[str] = None
    elimination_type: Optional[str] = None  # "kill" | "scoop"

class LiveGameState(BaseModel):
    """Snapshot of an in-progress game (synced from match host's phone)"""
    elapsed_seconds: int = 0
    player_states: dict[str, LivePlayerState] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

Then add one field to `PodAssignment`:

```python
class PodAssignment(BaseModel):
    """A single pod (table) within a tournament round"""
    pod_index: int
    player_ids: list[str] = Field(default_factory=list)
    match_id: Optional[str] = None
    match_status: str = "pending"
    player_decks: dict[str, PlayerDeckInfo] = Field(default_factory=dict)
    live_game_state: Optional[LiveGameState] = None  # NEW
```

**Step 2: Verify backend starts**

Run: `cd backend && uv run python -c "from app.models.event import LiveGameState, LivePlayerState, PodAssignment; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/models/event.py
git commit -m "feat: add LiveGameState and LivePlayerState models to event"
```

---

### Task 2: Backend — Update serialize_event to include live_game_state

**Files:**
- Modify: `backend/app/routers/events.py` (the `serialize_event` function, lines 55-140)

**Step 1: Add live_game_state to pod serialization**

In `serialize_event`, find the pod serialization block (around line 94-108). Add `live_game_state` to each pod dict:

```python
"player_decks": {
    pid: {
        "deck_name": info.deck_name,
        "commander_image_url": info.commander_image_url,
        "colors": info.colors,
    } if isinstance(info, PlayerDeckInfo) else {"deck_name": info, "commander_image_url": "", "colors": []}
    for pid, info in pa.player_decks.items()
},
"live_game_state": (
    {
        "elapsed_seconds": pa.live_game_state.elapsed_seconds,
        "updated_at": pa.live_game_state.updated_at.isoformat(),
        "player_states": {
            pid: {
                "player_id": ps.player_id,
                "life": ps.life,
                "eliminated": ps.eliminated,
                "eliminated_by_player_id": ps.eliminated_by_player_id,
                "elimination_type": ps.elimination_type,
            }
            for pid, ps in pa.live_game_state.player_states.items()
        },
    }
    if pa.live_game_state
    else None
),
```

**Step 2: Verify the import**

Make sure `LiveGameState` is imported at the top of `events.py` (it should already come from the event model import).

Check existing import line — it likely imports from `app.models.event`. Add `LiveGameState, LivePlayerState` if not already imported.

**Step 3: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat: include live_game_state in event serialization"
```

---

### Task 3: Backend — Add PUT game-state endpoint

**Files:**
- Modify: `backend/app/routers/events.py`

**Step 1: Add the request model**

Near the top of `events.py` with the other request models (around line 25-50), add:

```python
class UpdateGameStateRequest(BaseModel):
    """Game state update from match host's phone"""
    elapsed_seconds: int = 0
    player_states: dict[str, dict] = Field(default_factory=dict)
    # Each player_states value: { life: int, eliminated: bool, eliminated_by_player_id?: str, elimination_type?: str }
```

**Step 2: Add the endpoint**

Add this endpoint in the PUBLIC ENDPOINT section (after the existing `/live` endpoint, around line 1068):

```python
@router.put("/{event_id}/rounds/{round_num}/pods/{pod_index}/game-state")
async def update_game_state(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    request: UpdateGameStateRequest,
):
    """Update live game state for a pod (NO AUTH — called by match host's phone)"""
    # Build the LiveGameState document
    player_states = {}
    for pid, state in request.player_states.items():
        player_states[pid] = {
            "player_id": pid,
            "life": state.get("life", 40),
            "eliminated": state.get("eliminated", False),
            "eliminated_by_player_id": state.get("eliminated_by_player_id"),
            "elimination_type": state.get("elimination_type"),
        }

    game_state_doc = {
        "elapsed_seconds": request.elapsed_seconds,
        "player_states": player_states,
        "updated_at": datetime.utcnow(),
    }

    # Atomic update targeting the exact nested path
    collection = Event.get_settings().pymongo_collection
    result = await collection.update_one(
        {"_id": event_id, "status": "active"},
        {"$set": {
            f"rounds.$[r].pods.$[p].live_game_state": game_state_doc,
        }},
        array_filters=[
            {"r.round_number": round_num},
            {"p.pod_index": pod_index},
        ],
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event, round, or pod not found (or event not active)",
        )

    return {"status": "ok"}
```

**Step 3: Verify backend starts**

Run: `cd backend && uv run uvicorn app.main:app --port 7777` — confirm it starts without import errors, then stop it.

**Step 4: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat: add PUT game-state endpoint for live broadcast sync"
```

---

### Task 4: Backend — Clear live_game_state on match complete

**Files:**
- Modify: `backend/app/routers/events.py` (the `complete_pod_match` function, around line 860)

**Step 1: Clear the live game state**

In `complete_pod_match`, right after `target_pod.match_status = "completed"` (around line 862), add:

```python
target_pod.live_game_state = None
```

This ensures the live state is cleaned up when a match finishes — the broadcast view will then show the completed match result instead.

**Step 2: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "fix: clear live_game_state when match completes"
```

---

### Task 5: Frontend Types — Add LiveGameState interfaces and API method

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: Add TypeScript interfaces**

Near the other event-related interfaces (around `PodAssignment`, line 183), add:

```typescript
export interface LivePlayerState {
  player_id: string;
  life: number;
  eliminated: boolean;
  eliminated_by_player_id?: string;
  elimination_type?: 'kill' | 'scoop';
}

export interface LiveGameState {
  elapsed_seconds: number;
  player_states: Record<string, LivePlayerState>;
  updated_at: string;
}
```

**Step 2: Update PodAssignment interface**

Add the optional field to the existing `PodAssignment` interface:

```typescript
export interface PodAssignment {
  pod_index: number;
  player_ids: string[];
  match_id?: string;
  match_status: 'pending' | 'in_progress' | 'completed';
  player_decks: Record<string, PlayerDeckInfo>;
  live_game_state?: LiveGameState | null;  // NEW
}
```

**Step 3: Add updateGameState to eventApi**

In the `eventApi` object, add this method (near the `getLive` method):

```typescript
updateGameState: async (
  eventId: string,
  round: number,
  podIndex: number,
  state: { elapsed_seconds: number; player_states: Record<string, Omit<LivePlayerState, 'player_id'> & { player_id?: string }> },
): Promise<void> => {
  await axios.put(`/api/events/${eventId}/rounds/${round}/pods/${podIndex}/game-state`, state);
},
```

Note: Uses `axios` directly (not `api`) because this is a public endpoint — same pattern as `getLive`.

**Step 4: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors (or only pre-existing ones).

**Step 5: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add LiveGameState types and updateGameState API method"
```

---

### Task 6: Frontend Sync — Add debounced game state sync to EventMatchTracker

**Files:**
- Modify: `frontend/src/pages/EventMatchTracker.tsx`

**Step 1: Add the sync hook**

Add a new `useEffect` in `EventMatchTracker` (after the existing localStorage auto-save effect around line 171). This watches `matchState.gameState` and debounce-syncs to the backend:

```typescript
// Sync game state to backend for live broadcast view
const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastSyncedEliminationCount = useRef<number>(0);

useEffect(() => {
  if (!eventId || !event || !matchState?.gameState || matchState.currentStep !== 'game') return;

  const gameState = matchState.gameState;
  const players = matchState.players;

  // Build player-ID-keyed state from position-keyed state
  const playerStates: Record<string, { player_id: string; life: number; eliminated: boolean; eliminated_by_player_id?: string; elimination_type?: string }> = {};
  for (const player of players) {
    if (!player.playerId) continue;
    const ps = gameState.playerStates[player.position];
    if (!ps) continue;
    playerStates[player.playerId] = {
      player_id: player.playerId,
      life: ps.life,
      eliminated: ps.eliminated,
      eliminated_by_player_id: ps.eliminatedByPlayerId,
      elimination_type: ps.eliminationType,
    };
  }

  const payload = {
    elapsed_seconds: gameState.elapsedSeconds,
    player_states: playerStates,
  };

  // Check if an elimination just happened (immediate sync)
  const currentEliminationCount = Object.values(gameState.playerStates).filter(ps => ps.eliminated).length;
  const isNewElimination = currentEliminationCount > lastSyncedEliminationCount.current;

  if (isNewElimination) {
    lastSyncedEliminationCount.current = currentEliminationCount;
    // Immediate sync for eliminations
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    eventApi.updateGameState(eventId, event.current_round, podIndex, payload).catch(err =>
      console.warn('[EventMatchTracker] Failed to sync game state:', err)
    );
    return;
  }

  // Debounced sync for regular updates (life changes, timer)
  if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
  syncTimeoutRef.current = setTimeout(() => {
    eventApi.updateGameState(eventId, event.current_round, podIndex, payload).catch(err =>
      console.warn('[EventMatchTracker] Failed to sync game state:', err)
    );
  }, 1500);

  return () => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
  };
}, [matchState?.gameState, matchState?.players, matchState?.currentStep, eventId, event, podIndex]);
```

**Step 2: Add import**

Make sure `useRef` is in the import at the top (line 1). It currently imports `useState, useEffect, useCallback, useMemo`. Add `useRef`:

```typescript
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
```

**Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/pages/EventMatchTracker.tsx
git commit -m "feat: add debounced game state sync to EventMatchTracker"
```

---

### Task 7: Frontend Broadcast — Add LivePodCard and polling to EventLiveView

**Files:**
- Modify: `frontend/src/pages/EventLiveView.tsx`

This is the largest task. It has three parts: (A) speed up polling, (B) add LivePodCard component, (C) integrate it into RoundCard.

**Step 1: Speed up polling when matches are in progress**

In `EventLiveView` (around line 1114), change the polling interval from 5 seconds to dynamic:

Replace:
```typescript
const interval = setInterval(fetchLive, 5000);
```

With logic that uses 3s when any pods are in_progress, 5s otherwise. The simplest approach: after each fetch, check if any current-round pods are in_progress.

Add a ref to track the interval:

```typescript
const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Then update the polling effect to adjust the interval:

```typescript
// Determine if we need fast polling (active matches)
const hasActivePods = event?.status === 'active' && event?.rounds.some(r =>
  r.round_number === event.current_round && r.pods.some(p => p.match_status === 'in_progress')
);
const pollInterval = hasActivePods ? 3000 : 5000;
```

The simplest implementation: just use 3000ms always when event is active, 5000ms otherwise. Add this above the polling `useEffect` and pass `pollInterval` to `setInterval`. Include `event?.status` in the dependency array so it re-creates the interval when status changes.

Actually, the cleanest approach is to keep it simple — just change 5000 to 3000 in the existing setInterval. The 2-second difference doesn't matter much and avoids complexity.

**Step 2: Add the LivePodCard component**

Add a new component function above `RoundCard` (around line 670). This renders the live game state for a single pod:

```typescript
function LivePodCard({
  event,
  pod,
}: {
  event: TournamentEvent;
  pod: PodAssignment;
}) {
  const gameState = pod.live_game_state;
  if (!gameState) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLifeColor = (life: number, eliminated: boolean) => {
    if (eliminated) return 'text-[#5C5F66]';
    if (life > 30) return 'text-[#51CF66]';
    if (life > 15) return 'text-[#FCC419]';
    return 'text-[#FF6B6B]';
  };

  return (
    <div className="space-y-1.5">
      {/* Timer */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <IconClock size={12} className="text-[#5C5F66]" />
        <span className="text-xs font-mono text-[#5C5F66]">
          {formatTime(gameState.elapsed_seconds)}
        </span>
      </div>

      {/* Player rows */}
      {pod.player_ids.map((pid) => {
        const ps = gameState.player_states[pid];
        if (!ps) return null;

        const playerName = findPlayerName(event, pid);
        const avatar = findPlayerAvatar(event, pid);
        const deckInfo = pod.player_decks[pid];
        const killerName = ps.eliminated_by_player_id
          ? findPlayerName(event, ps.eliminated_by_player_id)
          : null;

        return (
          <div
            key={pid}
            className={`flex items-center gap-3 px-3 py-2 rounded-[8px] transition-all ${
              ps.eliminated
                ? 'bg-[#1A1B1E]/30 opacity-50'
                : 'bg-[#1A1B1E]/60'
            }`}
          >
            {/* Status indicator */}
            <span className="text-sm flex-shrink-0">
              {ps.eliminated ? '💀' : '🟢'}
            </span>

            {/* Avatar */}
            <PlayerAvatar
              playerName={playerName}
              customAvatar={avatar}
              size="small"
              className={`!w-8 !h-8 !text-xs flex-shrink-0 ${
                ps.eliminated ? 'grayscale' : ''
              }`}
            />

            {/* Name + commander */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${
                ps.eliminated ? 'text-[#5C5F66] line-through' : 'text-white'
              }`}>
                {playerName}
              </div>
              {deckInfo && (
                <div className="text-[10px] text-[#5C5F66] truncate">
                  {deckInfo.deck_name}
                </div>
              )}
            </div>

            {/* Life total */}
            <span
              className={`text-xl font-bold tabular-nums flex-shrink-0 ${getLifeColor(ps.life, ps.eliminated)}`}
              style={{ fontFamily: "'Chakra Petch', sans-serif", minWidth: '2.5rem', textAlign: 'right' }}
            >
              {ps.life}
            </span>

            {/* Elimination info */}
            {ps.eliminated && (
              <span className="text-[10px] text-[#5C5F66] flex-shrink-0 w-20 text-right truncate">
                {ps.elimination_type === 'scoop'
                  ? 'scooped'
                  : killerName
                    ? `by ${killerName}`
                    : 'eliminated'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Integrate LivePodCard into RoundCard**

In `RoundCard`, find the section where pods render players (around line 786-840). When a pod is live AND has `live_game_state`, render `LivePodCard` instead of the default player list.

Replace the player rendering section for non-draft pods. Find the block starting at line 824:

```typescript
) : (
  <div className="space-y-2">
    {pod.player_ids.map((pid) => {
      const isWinner = winner?.playerId === pid;
      return (
        <PodPlayerCard ... />
      );
    })}
  </div>
)}
```

Change it to:

```typescript
) : isPodLive && pod.live_game_state ? (
  <LivePodCard event={event} pod={pod} />
) : (
  <div className="space-y-2">
    {pod.player_ids.map((pid) => {
      const isWinner = winner?.playerId === pid;
      return (
        <PodPlayerCard
          key={pid}
          playerId={pid}
          event={event}
          round={round}
          pod={pod}
          isWinner={isWinner}
        />
      );
    })}
  </div>
)}
```

Also handle the draft (1v1) case similarly. In the draft branch (around line 787-823), add a live state check:

```typescript
{event.event_type === 'draft' && pod.player_ids.length === 2 ? (
  isPodLive && pod.live_game_state ? (
    <LivePodCard event={event} pod={pod} />
  ) : (
    <div className="flex items-center justify-center gap-4">
      {/* existing 1v1 rendering */}
    </div>
  )
) : isPodLive && pod.live_game_state ? (
```

**Step 4: Update the import for LiveGameState type**

At the top of `EventLiveView.tsx` (line 4), make sure `LiveGameState` is included in the import if TypeScript needs it for type narrowing. It should already be available via `PodAssignment` since that interface now includes `live_game_state`.

**Step 5: Update polling interval**

Change the polling interval from 5000 to 3000 (line 1114):

```typescript
const interval = setInterval(fetchLive, 3000);
```

**Step 6: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

**Step 7: Commit**

```bash
git add frontend/src/pages/EventLiveView.tsx
git commit -m "feat: add LivePodCard and faster polling for live broadcast view"
```

---

### Task 8: Manual End-to-End Verification

**Step 1: Start backend and frontend**

Terminal 1: `cd backend && uv run uvicorn app.main:app --reload --port 7777`
Terminal 2: `cd frontend && npm run dev`

**Step 2: Create a test event and start a match**

1. Open the app at http://localhost:5173
2. Create a tournament event with 4 players
3. Start the tournament
4. Start a pod match — this opens the EventMatchTracker

**Step 3: Open the broadcast view**

In a separate browser tab/window, open http://localhost:5173/event/{eventId}/live

**Step 4: Verify live state sync**

1. In the match tracker, assign players and decks, then start the game
2. Change life totals — within ~2 seconds, the broadcast view should show updated life totals
3. Eliminate a player — should appear immediately on the broadcast view
4. Verify the timer increments on the broadcast

**Step 5: Verify cleanup on match complete**

1. Complete the match in the tracker
2. The broadcast view should clear the live state and show the completed match result

**Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during live broadcast testing"
```
