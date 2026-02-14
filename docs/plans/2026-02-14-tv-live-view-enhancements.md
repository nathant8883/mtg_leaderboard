# TV Live View Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the tournament TV live view with shuffle/re-seed animations, rich pod cards showing commander images as players select decks, and a scoring rules panel.

**Architecture:** Five tasks working leaf-to-root. First, update the backend model and serializer for enriched deck data. Second, add a set-deck endpoint. Third, update frontend types and wire up deck reporting from EventMatchTracker. Fourth, build the TV shuffle animation component. Fifth, refactor EventLiveView with rich pod cards, animation integration, and scoring rules panel.

**Tech Stack:** FastAPI, Beanie, React, TypeScript, CSS animations, Tailwind CSS v4

---

### Task 1: Enrich PodAssignment.player_decks model

**Files:**
- Modify: `backend/app/models/event.py:14-20`
- Modify: `backend/app/routers/events.py:37-100` (serialize_event)
- Modify: `backend/app/routers/events.py:648-652` (complete_pod_match player_decks build)

**Step 1: Add PlayerDeckInfo model to event.py**

After `EventPlayer` (line 12), before `PodAssignment` (line 14), add a new model. Then update `PodAssignment.player_decks` type:

```python
class PlayerDeckInfo(BaseModel):
    """Deck information for a player in a pod"""
    deck_name: str = ""
    commander_image_url: str = ""
    colors: list[str] = Field(default_factory=list)


class PodAssignment(BaseModel):
    """A single pod (table) within a tournament round"""
    pod_index: int  # 0-based pod number
    player_ids: list[str] = Field(default_factory=list)
    match_id: Optional[str] = None
    match_status: str = "pending"  # "pending" | "in_progress" | "completed"
    player_decks: dict[str, PlayerDeckInfo] = Field(default_factory=dict)
```

**Step 2: Update serialize_event to serialize PlayerDeckInfo**

In `backend/app/routers/events.py`, line 67, change `"player_decks": pa.player_decks,` to:

```python
                        "player_decks": {
                            pid: {
                                "deck_name": info.deck_name,
                                "commander_image_url": info.commander_image_url,
                                "colors": info.colors,
                            } if isinstance(info, PlayerDeckInfo) else {"deck_name": info, "commander_image_url": "", "colors": []}
                            for pid, info in pa.player_decks.items()
                        },
```

The `isinstance` check handles migration of old string-valued entries gracefully.

**Step 3: Update complete_pod_match to build PlayerDeckInfo**

In `backend/app/routers/events.py`, lines 648-652, change the player_decks building:

```python
    # Build player_decks map from match data (enrich with deck details)
    for mp in match.players:
        # Only overwrite if not already set (set-deck endpoint may have pre-populated)
        if mp.player_id not in target_pod.player_decks:
            target_pod.player_decks[mp.player_id] = PlayerDeckInfo(deck_name=mp.deck_name)
```

Add the import at the top of events.py if not already present:

```python
from app.models.event import Event, Round, PodAssignment, RoundResult, StandingsEntry, EventPlayer, PlayerDeckInfo
```

**Step 4: Verify backend starts**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/backend && uv run python -c "from app.models.event import PlayerDeckInfo, PodAssignment; print('OK')"`
Expected: `OK`

**Step 5: Commit**

```bash
git add backend/app/models/event.py backend/app/routers/events.py
git commit -m "feat: enrich PodAssignment.player_decks with PlayerDeckInfo model

Add commander_image_url and colors fields alongside deck_name.
Backward-compatible serialization handles old string values."
```

---

### Task 2: Add set-deck endpoint

**Files:**
- Modify: `backend/app/routers/events.py` (add endpoint after cancel-match, around line 576)
- Modify: `backend/app/routers/events.py` (add request model near top, around line 30)

**Step 1: Add request model**

Near the other request models at the top of `events.py` (around line 30, after the existing imports and before `serialize_event`), add:

```python
class SetDeckRequest(BaseModel):
    player_id: str
    deck_id: str
```

**Step 2: Add endpoint**

After the `cancel_pod_match` endpoint (after line 576), add:

```python
@router.post("/{event_id}/rounds/{round_num}/pods/{pod_index}/set-deck")
async def set_pod_deck(
    event_id: PydanticObjectId,
    round_num: int,
    pod_index: int,
    request: SetDeckRequest,
    current_player: Player = Depends(get_current_player),
):
    """Record a player's deck selection for a pod (called during PlayerAssignment)"""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event is not active")

    # Find the round
    current_round = None
    for r in event.rounds:
        if r.round_number == round_num:
            current_round = r
            break
    if current_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")

    # Find the pod
    target_pod = None
    for pa in current_round.pods:
        if pa.pod_index == pod_index:
            target_pod = pa
            break
    if target_pod is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    # Validate player is in the pod
    if request.player_id not in target_pod.player_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Player is not in this pod")

    # Fetch the deck
    deck = await Deck.get(PydanticObjectId(request.deck_id))
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    # Write deck info to pod
    target_pod.player_decks[request.player_id] = PlayerDeckInfo(
        deck_name=deck.name,
        commander_image_url=deck.commander_image_url or "",
        colors=deck.colors or [],
    )

    await event.save()
    return {"status": "ok", "player_id": request.player_id, "deck_name": deck.name}
```

Make sure `Deck` is imported at the top of events.py:

```python
from app.models.player import Player, Deck
```

(Check if `Deck` is already imported — if only `Player` is imported, add `Deck`.)

**Step 3: Verify backend starts**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/backend && uv run python -c "from app.routers.events import router; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add backend/app/routers/events.py
git commit -m "feat: add set-deck endpoint for progressive deck reveal on TV

POST /events/{id}/rounds/{round}/pods/{pod}/set-deck records a player's
deck selection with commander image and colors before the match starts."
```

---

### Task 3: Update frontend types and wire deck reporting

**Files:**
- Modify: `frontend/src/services/api.ts:178-184` (PodAssignment type)
- Modify: `frontend/src/services/api.ts:1023-1098` (eventApi)
- Modify: `frontend/src/pages/EventMatchTracker.tsx:171-206` (handlePlayerAssignment)

**Step 1: Add PlayerDeckInfo type and update PodAssignment**

In `frontend/src/services/api.ts`, before the `PodAssignment` interface (line 178), add:

```typescript
export interface PlayerDeckInfo {
  deck_name: string;
  commander_image_url: string;
  colors: string[];
}
```

Update `PodAssignment` (line 183) from:
```typescript
  player_decks: Record<string, string>;
```
to:
```typescript
  player_decks: Record<string, PlayerDeckInfo>;
```

**Step 2: Add setDeck to eventApi**

In `frontend/src/services/api.ts`, inside the `eventApi` object (before `getLive` around line 1095), add:

```typescript
  setDeck: async (
    eventId: string,
    round: number,
    podIndex: number,
    playerId: string,
    deckId: string,
  ): Promise<{ status: string; player_id: string; deck_name: string }> => {
    const response = await api.post(
      `/events/${eventId}/rounds/${round}/pods/${podIndex}/set-deck`,
      { player_id: playerId, deck_id: deckId },
    );
    return response.data;
  },
```

**Step 3: Wire deck reporting in EventMatchTracker**

In `frontend/src/pages/EventMatchTracker.tsx`, modify `handlePlayerAssignment` (line 172) to report each player's deck selection to the backend. After filtering empty slots (line 177) and before initializing gameState (line 180), add the deck reporting:

```typescript
  const handlePlayerAssignment = useCallback(
    (players: PlayerSlot[]) => {
      if (!matchState) return;

      // Filter out empty slots (for odd-number games where we create extra slots)
      const activePlayers = players.filter((p) => p.playerId !== null);

      // Report deck selections to backend for TV live view (fire-and-forget)
      if (eventId && currentRound > 0 && podIndex >= 0) {
        activePlayers.forEach((player) => {
          if (player.playerId && player.deckId) {
            eventApi.setDeck(eventId, currentRound, podIndex, player.playerId, player.deckId).catch((err) =>
              console.warn('[EventMatchTracker] Failed to report deck selection:', err)
            );
          }
        });
      }

      // Initialize game state
      const gameState: ActiveGameState = {
        startTime: new Date(),
        elapsedSeconds: 0,
        playerStates: {},
      };

      activePlayers.forEach((player) => {
        gameState.playerStates[player.position] = {
          life: matchState.startingLife,
          eliminated: false,
          eliminatedAt: null,
          revived: false,
          forceEliminated: false,
          commanderDamage: {},
          eliminationConfirmed: false,
        };
      });

      setMatchState({
        ...matchState,
        players: activePlayers,
        currentStep: 'game',
        gameState,
      });
    },
    [matchState, eventId, currentRound, podIndex]
  );
```

Note: `currentRound` and `podIndex` are already available in the component scope (parsed from params/state). Check the exact variable names — `podIndex` is `const podIndex = Number(podIndexStr);` (around line 37) and `currentRound` may need to be stored in state. If `currentRound` is not already in component state, extract it from the loaded event data and store it:

Add state near line 41:
```typescript
  const [currentRound, setCurrentRound] = useState<number>(0);
```

Set it in the `loadData` function when the event loads (after setting `setPodPlayerIds`):
```typescript
        setCurrentRound(eventData.current_round);
```

**Step 4: Verify frontend compiles**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/pages/EventMatchTracker.tsx
git commit -m "feat: wire deck selection reporting for progressive TV reveal

EventMatchTracker now calls set-deck endpoint when players complete
assignment, sending commander images and colors to the event pod."
```

---

### Task 4: Build TVShuffleAnimation component

**Files:**
- Create: `frontend/src/components/events/TVShuffleAnimation.tsx`

**Step 1: Create the component**

Create `frontend/src/components/events/TVShuffleAnimation.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import type { TournamentEvent, StandingsEntry } from '../../services/api';
import PlayerAvatar from '../PlayerAvatar';

type AnimationType = 'shuffle' | 'reseed';
type AnimationPhase = 'scatter' | 'sort' | 'form-pods' | 'reveal' | 'done';

interface TVShuffleAnimationProps {
  event: TournamentEvent;
  animationType: AnimationType;
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}

export function TVShuffleAnimation({
  event,
  animationType,
  previousStandings,
  onComplete,
}: TVShuffleAnimationProps) {
  const [phase, setPhase] = useState<AnimationPhase>('scatter');
  const completedRef = useRef(false);

  // Get the new round's pods
  const currentRound = event.rounds.find((r) => r.round_number === event.current_round);
  const pods = currentRound?.pods ?? [];

  // Phase timing
  useEffect(() => {
    const timers =
      animationType === 'shuffle'
        ? [
            setTimeout(() => setPhase('form-pods'), 2000),
            setTimeout(() => setPhase('reveal'), 3500),
            setTimeout(() => {
              setPhase('done');
              if (!completedRef.current) {
                completedRef.current = true;
                onComplete();
              }
            }, 5000),
          ]
        : [
            // reseed: scatter -> sort -> form-pods -> reveal -> done
            setTimeout(() => setPhase('sort'), 2000),
            setTimeout(() => setPhase('form-pods'), 3500),
            setTimeout(() => setPhase('reveal'), 5000),
            setTimeout(() => {
              setPhase('done');
              if (!completedRef.current) {
                completedRef.current = true;
                onComplete();
              }
            }, 6500),
          ];

    return () => timers.forEach(clearTimeout);
  }, [animationType, onComplete]);

  // Sort standings for re-seed display
  const sortedStandings = previousStandings
    ? [...previousStandings].sort((a, b) => b.total_points - a.total_points)
    : [];

  const rankColor = (idx: number) =>
    idx === 0 ? 'text-[#FFD700]' : idx === 1 ? 'text-[#C0C0C0]' : idx === 2 ? 'text-[#CD7F32]' : 'text-[#909296]';

  const findPlayer = (pid: string) => event.players.find((p) => p.player_id === pid);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full overflow-hidden">
      {/* Inline keyframes */}
      <style>{`
        @keyframes tv-shuffle-bounce {
          0%   { transform: translateY(0)     scale(1)    rotate(0deg);  opacity: 1;   }
          20%  { transform: translateY(-18px) scale(1.06) rotate(-3deg); opacity: 0.8; }
          40%  { transform: translateY(8px)   scale(0.94) rotate(2deg);  opacity: 1;   }
          60%  { transform: translateY(-12px) scale(1.03) rotate(-1.5deg); opacity: 0.85; }
          80%  { transform: translateY(5px)   scale(0.97) rotate(1deg);  opacity: 1;   }
          100% { transform: translateY(-4px)  scale(1.01) rotate(-0.5deg); opacity: 0.9; }
        }

        @keyframes tv-glow-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(102,126,234,0.3); }
          50%      { box-shadow: 0 0 24px rgba(102,126,234,0.6); }
        }

        @keyframes tv-fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes tv-title-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }

        @keyframes tv-slide-to-rank {
          from { opacity: 0.6; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .tv-shuffle-tile {
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tv-pod-container {
          animation: tv-fade-in-up 0.6s ease-out both;
        }
      `}</style>

      {/* Title */}
      <h2 className="text-3xl font-bold text-white mb-10 text-center">
        {animationType === 'shuffle' && phase === 'scatter' && (
          <span style={{ animation: 'tv-title-pulse 1.2s ease-in-out infinite' }} className="inline-block">
            Shuffling Players...
          </span>
        )}
        {animationType === 'reseed' && phase === 'scatter' && (
          <span style={{ animation: 'tv-title-pulse 1.2s ease-in-out infinite' }} className="inline-block">
            Re-seeding by Standings...
          </span>
        )}
        {animationType === 'reseed' && phase === 'sort' && (
          <span className="text-[#667eea]">Ranking Players...</span>
        )}
        {phase === 'form-pods' && (
          <span className="text-[#667eea]">Forming Pods...</span>
        )}
        {(phase === 'reveal' || phase === 'done') && (
          <span className="text-[#51CF66]">Pods Assigned!</span>
        )}
      </h2>

      {/* Animation container */}
      <div className="relative w-full max-w-4xl px-6">
        {/* Phase: Scatter (shuffle bounce grid) */}
        {phase === 'scatter' && (
          <div className={`grid ${event.players.length <= 4 ? 'grid-cols-2' : event.players.length <= 8 ? 'grid-cols-4' : 'grid-cols-4'} gap-6 justify-items-center`}>
            {event.players.map((player, i) => (
              <div
                key={player.player_id}
                className="tv-shuffle-tile"
                style={{
                  animation: `tv-shuffle-bounce ${0.5 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                  animationDelay: `${(i * 0.12) % 0.8}s`,
                }}
              >
                <TVPlayerTile player={player} />
              </div>
            ))}
          </div>
        )}

        {/* Phase: Sort (re-seed only) — ranked column */}
        {phase === 'sort' && animationType === 'reseed' && (
          <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
            {sortedStandings.map((entry, idx) => {
              const player = findPlayer(entry.player_id);
              if (!player) return null;
              return (
                <div
                  key={entry.player_id}
                  className="flex items-center gap-4 w-full px-4 py-2 rounded-[10px] bg-[#1A1B1E]/80 border border-[#2C2E33]"
                  style={{
                    animation: `tv-slide-to-rank 0.5s ease-out both`,
                    animationDelay: `${idx * 120}ms`,
                  }}
                >
                  <span className={`text-xl font-bold w-8 text-center ${rankColor(idx)}`}>
                    {idx + 1}
                  </span>
                  <PlayerAvatar
                    playerName={player.player_name}
                    customAvatar={player.avatar}
                    size="small"
                    className="!w-10 !h-10 !text-base border-2 border-[#2C2E33]"
                  />
                  <span className="text-base text-white font-semibold flex-1 truncate">
                    {player.player_name}
                  </span>
                  <span className="text-sm font-bold text-[#667eea]">{entry.total_points} pts</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Phase: Form pods / Reveal / Done — players grouped into pods */}
        {(phase === 'form-pods' || phase === 'reveal' || phase === 'done') && (
          <div className={`grid ${pods.length === 1 ? 'grid-cols-1' : pods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-6`}>
            {pods.map((pod, podIdx) => {
              const isRevealed = phase === 'reveal' || phase === 'done';

              return (
                <div
                  key={podIdx}
                  className="tv-pod-container rounded-[12px] border p-5 transition-all duration-700"
                  style={{
                    animationDelay: `${podIdx * 200}ms`,
                    background: isRevealed
                      ? 'linear-gradient(135deg, rgba(26,27,30,0.95) 0%, rgba(28,29,33,0.95) 100%)'
                      : 'rgba(26,27,30,0.5)',
                    borderColor: isRevealed
                      ? 'rgba(102,126,234,0.4)'
                      : 'rgba(44,46,51,0.5)',
                    ...(isRevealed
                      ? { animation: `tv-glow-pulse 2s ease-in-out infinite, tv-fade-in-up 0.6s ease-out both`, animationDelay: `${podIdx * 200}ms` }
                      : {}),
                  }}
                >
                  {/* Pod label */}
                  <div
                    className="transition-all duration-500 mb-4"
                    style={{
                      opacity: isRevealed ? 1 : 0.5,
                      transform: isRevealed ? 'translateY(0)' : 'translateY(-6px)',
                    }}
                  >
                    <span className="text-sm font-bold uppercase tracking-widest text-[#667eea]">
                      Pod {podIdx + 1}
                    </span>
                  </div>

                  {/* Player tiles */}
                  <div className="flex flex-col gap-3">
                    {pod.player_ids.map((pid, playerIdx) => {
                      const player = findPlayer(pid);
                      if (!player) return null;

                      // For re-seed, show points badge
                      const standingEntry = previousStandings?.find((s) => s.player_id === pid);

                      return (
                        <div
                          key={pid}
                          className="tv-shuffle-tile flex items-center gap-3"
                          style={{
                            opacity: phase === 'form-pods' ? 0.6 : 1,
                            transitionDelay: `${playerIdx * 100}ms`,
                          }}
                        >
                          <PlayerAvatar
                            playerName={player.player_name}
                            customAvatar={player.avatar}
                            size="small"
                            className="!w-10 !h-10 !text-base border-2 border-[#2C2E33]"
                          />
                          <span className="text-base text-white font-medium truncate flex-1">
                            {player.player_name}
                          </span>
                          {animationType === 'reseed' && standingEntry && (
                            <span className="text-xs font-bold text-[#667eea] bg-[#667eea]/10 px-2 py-0.5 rounded-full">
                              {standingEntry.total_points} pts
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ready indicator */}
      {phase === 'done' && (
        <div
          className="mt-10 px-8 py-3 rounded-full border border-[#51CF66]/40 bg-[#51CF66]/10"
          style={{ animation: 'tv-fade-in-up 0.4s ease-out both' }}
        >
          <span className="text-base font-semibold text-[#51CF66] tracking-wide">
            Ready!
          </span>
        </div>
      )}
    </div>
  );
}

// ─── TV Player Tile ─────────────────────────────────────────────

function TVPlayerTile({ player }: { player: { player_id: string; player_name: string; avatar?: string } }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <PlayerAvatar
        playerName={player.player_name}
        customAvatar={player.avatar}
        size="small"
        className="!w-14 !h-14 !text-xl border-2 border-[#2C2E33]"
      />
      <span className="text-sm text-white font-medium text-center truncate max-w-[100px]">
        {player.player_name}
      </span>
    </div>
  );
}
```

**Step 2: Verify frontend compiles**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/events/TVShuffleAnimation.tsx
git commit -m "feat: add TVShuffleAnimation component for live view

Round 1: random shuffle with bounce animation into pod groups.
Round 2+: ranked sort by standings then split into seeded pods."
```

---

### Task 5: Refactor EventLiveView — rich pod cards, animation, and scoring rules

This is the largest task. It modifies `EventLiveView.tsx` to add three features:
1. State transition detection + animation overlay
2. Rich pod player cards with commander images
3. Scoring rules panel in the bottom-left

**Files:**
- Modify: `frontend/src/pages/EventLiveView.tsx` (all sections)

**Step 1: Add imports**

At the top of `EventLiveView.tsx` (line 1-12), add new imports:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { eventApi } from '../services/api';
import type { TournamentEvent, EventRound, PodAssignment, StandingsEntry, PlayerDeckInfo } from '../services/api';
import { TVShuffleAnimation } from '../components/events/TVShuffleAnimation';
import ColorPips from '../components/ColorPips';
import { getColorIdentityStyle } from '../utils/manaColors';
import {
  IconTrophy,
  IconCrown,
  IconLoader2,
  IconClock,
  IconSwords,
  IconCalendar,
  IconScale,
} from '@tabler/icons-react';
```

**Step 2: Add ScoringRulesPanel component**

After the `StandingsPanel` component (after line 283), add:

```tsx
// ─── Scoring Rules ──────────────────────────────────────────────

function ScoringRulesPanel() {
  return (
    <div className="border-t border-[#2C2E33] px-5 py-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
        <IconScale size={16} className="text-[#667eea]" />
        Scoring
      </h3>

      {/* Placement */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-[#667eea] uppercase tracking-wider mb-1.5">Placement</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            ['1st', '3'],
            ['2nd', '2'],
            ['3rd', '1'],
            ['4th', '0'],
          ].map(([label, pts]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-[#909296]">{label}</span>
              <span className="text-xs font-bold text-white">{pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bonuses */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-[#667eea] uppercase tracking-wider mb-1.5">Bonuses</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#909296]">Kill</span>
            <span className="text-xs font-bold text-[#51CF66]">+1</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#909296]">Alt Win</span>
            <span className="text-xs font-bold text-[#51CF66]">+4</span>
          </div>
        </div>
      </div>

      {/* Penalties */}
      <div>
        <p className="text-[10px] font-semibold text-[#667eea] uppercase tracking-wider mb-1.5">Penalties</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#909296]">Scoop</span>
          <span className="text-xs font-bold text-[#E03131]">−1</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add PodPlayerCard component**

After the `ScoringRulesPanel`, add the rich player card component:

```tsx
// ─── Pod Player Card ────────────────────────────────────────────

function PodPlayerCard({
  playerId,
  event,
  round,
  pod,
  isWinner,
}: {
  playerId: string;
  event: TournamentEvent;
  round: EventRound;
  pod: PodAssignment;
  isWinner: boolean;
}) {
  const playerName = findPlayerName(event, playerId);
  const deckInfo: PlayerDeckInfo | undefined = pod.player_decks[playerId];
  const result = round.results.find((r) => r.player_id === playerId);
  const hasDeck = deckInfo && deckInfo.deck_name;
  const isPodCompleted = pod.match_status === 'completed';

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-[8px] transition-all duration-300 ${
        isWinner
          ? 'bg-[rgba(255,215,0,0.08)] border-l-[3px] border-[rgba(255,165,0,0.5)]'
          : 'bg-[rgba(37,38,43,0.3)]'
      }`}
    >
      {/* Commander artwork or placeholder */}
      <div className="flex-shrink-0">
        {hasDeck && deckInfo.commander_image_url ? (
          <div
            className="deck-color-border-wrapper p-[2px] rounded-[8px]"
            style={getColorIdentityStyle(deckInfo.colors || [])}
          >
            <div className="w-[40px] h-[40px] rounded-[6px] overflow-hidden">
              <img
                src={deckInfo.commander_image_url}
                alt=""
                className="w-full h-full object-cover object-[center_20%]"
              />
            </div>
          </div>
        ) : (
          <div className="w-[44px] h-[44px] rounded-[8px] bg-[#25262B] border border-[#2C2E33] flex items-center justify-center">
            <span className="text-[#3C3F44] text-lg">?</span>
          </div>
        )}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isWinner && <IconCrown size={13} className="text-[#FFD700] flex-shrink-0" />}
          <span
            className={`text-sm truncate ${
              isWinner ? 'text-[#FFD700] font-bold' : isPodCompleted ? 'text-[#909296] font-medium' : 'text-white font-medium'
            }`}
          >
            {playerName}
          </span>
        </div>
        {hasDeck ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-[#909296] truncate">{deckInfo.deck_name}</span>
            {deckInfo.colors && deckInfo.colors.length > 0 && (
              <div className="flex-shrink-0">
                <ColorPips colors={deckInfo.colors} size={10} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#3C3F44] italic mt-0.5 block">Selecting deck...</span>
        )}
      </div>

      {/* Points */}
      {result && (
        <span
          className={`text-xs font-bold flex-shrink-0 ${
            isWinner ? 'text-[#FFD700]' : 'text-[#51CF66]/70'
          }`}
        >
          +{result.total}
        </span>
      )}
    </div>
  );
}
```

**Step 4: Update RoundCard to use PodPlayerCard**

Replace the player list rendering inside `RoundCard` (lines 368-400). Replace the `<div className="space-y-1.5">` block with:

```tsx
              {/* Players in pod */}
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
```

**Step 5: Update StandingsPanel wrapper and add ScoringRulesPanel**

In the main `EventLiveView` component (line 546-556), modify the left column to include the scoring rules. Change the standings column div from:

```tsx
        <div className="border-b md:border-b-0 md:border-r border-[#2C2E33] bg-[#111214] overflow-y-auto scrollbar-hide">
          <StandingsPanel event={event} standings={sortedStandings} />
        </div>
```

To:

```tsx
        <div className="border-b md:border-b-0 md:border-r border-[#2C2E33] bg-[#111214] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <StandingsPanel event={event} standings={sortedStandings} />
          </div>
          <ScoringRulesPanel />
        </div>
```

**Step 6: Add animation state to main EventLiveView component**

In the main `EventLiveView` component (around line 470-504), add animation state tracking. After the existing state declarations (line 474), add:

```tsx
  const [animationState, setAnimationState] = useState<'none' | 'shuffle' | 'reseed'>('none');
  const [previousStandings, setPreviousStandings] = useState<StandingsEntry[] | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number>(0);
```

**Step 7: Add transition detection in the polling callback**

Modify the `fetchLive` function (line 483-497). Before `setEvent(data)` (line 486), add transition detection:

```tsx
    const fetchLive = async () => {
      try {
        const data = await eventApi.getLive(eventId);

        // Detect state transitions for animation
        if (prevStatusRef.current !== null) {
          // Tournament just started
          if (prevStatusRef.current === 'setup' && data.status === 'active') {
            setAnimationState('shuffle');
          }
          // Round advanced
          else if (data.current_round > prevRoundRef.current && prevRoundRef.current > 0) {
            // Save current standings before updating for the re-seed animation
            if (event) {
              setPreviousStandings([...event.standings].sort((a, b) => b.total_points - a.total_points));
            }
            setAnimationState('reseed');
          }
        }

        prevStatusRef.current = data.status;
        prevRoundRef.current = data.current_round;
        setEvent(data);
        setError(null);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Live view polling error:', err);
        if (!hasLoadedRef.current) {
          setError('Tournament not found or unavailable');
        }
      } finally {
        setInitialLoad(false);
      }
    };
```

**Step 8: Render animation overlay in the right column**

In the main render (around line 552-555), wrap the round timeline with conditional animation rendering:

```tsx
        {/* Round Timeline / Animation */}
        <div className="overflow-y-auto scrollbar-hide">
          {animationState !== 'none' ? (
            <TVShuffleAnimation
              event={event}
              animationType={animationState}
              previousStandings={previousStandings ?? undefined}
              onComplete={() => setAnimationState('none')}
            />
          ) : (
            <RoundTimeline event={event} />
          )}
        </div>
```

**Step 9: Verify frontend compiles**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npx tsc --noEmit`
Expected: No errors

**Step 10: Commit**

```bash
git add frontend/src/pages/EventLiveView.tsx
git commit -m "feat: enhance TV live view with animations, rich cards, and scoring rules

- Shuffle animation on tournament start, re-seed animation on round advance
- Pod player cards show commander images, deck names, and color pips
- Scoring rules panel pinned to bottom-left of standings column"
```

---

### Task 6: Manual Verification

**Step 1: Start dev servers**

Terminal 1:
```bash
cd /home/nturner/PersonalRepos/MTGLeaderboard/backend && uv run uvicorn app.main:app --reload --port 7777
```

Terminal 2:
```bash
cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npm run dev
```

**Step 2: Test scoring rules panel**

1. Open the TV live view for an existing event (`/event/{id}/live`)
2. Verify the left column shows standings at the top and scoring rules at the bottom
3. Verify the scoring table shows: 1st=3, 2nd=2, 3rd=1, 4th=0, Kill=+1, Alt Win=+4, Scoop=-1
4. On a narrow screen, verify both sections are visible without overlapping

**Step 3: Test shuffle animation**

1. Create a new 4-player event from the mobile app
2. Open the TV live view in another browser tab
3. Start the tournament from the mobile app
4. On the TV tab, within 5 seconds the shuffle animation should play:
   - Player tiles bouncing randomly
   - Tiles grouping into pods
   - Pods revealed with glow effect
   - "Ready!" indicator, then normal round view appears

**Step 4: Test progressive deck reveal**

1. Start a pod match from the mobile app
2. On the TV live view, the pod should show "?" placeholders and "Selecting deck..." for each player
3. Complete the player assignment on mobile (select all players and decks)
4. Within 5 seconds on the TV, commander images, deck names, and color pips should appear
5. Verify the color identity border around commander artwork matches the deck's colors

**Step 5: Test re-seed animation**

1. Complete the first round (play and save a match)
2. Advance to round 2 from the mobile app
3. On the TV, within 5 seconds the re-seed animation should play:
   - Players appear in previous pods
   - Players slide into a ranked column showing their points
   - Players split into new pods based on ranking
   - Pods revealed with glow
4. Verify Pod 1 contains the highest-scoring players

**Step 6: Test winner highlighting**

1. Complete a pod match
2. On the TV, verify the winner's card has gold text, crown icon, and orange left border
3. Verify other players show their points in green
