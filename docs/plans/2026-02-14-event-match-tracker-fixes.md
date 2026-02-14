# Event Match Tracker Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix EventMatchTracker to match regular match behavior — remove navigation blocking, use empty slots with filtered player selection, enable proper deck selection.

**Architecture:** Three leaf-to-root changes. Add optional filtering props to SmashPlayerSelect and PlayerAssignment (backward-compatible). Then refactor EventMatchTracker to use empty slots and pass those props.

**Tech Stack:** React, TypeScript, localStorage

---

### Task 1: Add `hideGuestOption` prop to SmashPlayerSelect

**Files:**
- Modify: `frontend/src/components/match-tracker/smash-select/SmashPlayerSelect.tsx`

**Step 1: Add prop to interface and destructure it**

At line 6, add `hideGuestOption?: boolean;` to `SmashPlayerSelectProps`. At line 16, add `hideGuestOption` to the destructured props.

```tsx
interface SmashPlayerSelectProps {
  seatNumber: number;
  playerCount: number;
  availablePlayers: Player[];
  assignedPlayers: PlayerSlot[];
  onSelect: (player: Player) => void;
  onGuestClick: () => void;
  onBack: () => void;
  hideGuestOption?: boolean;
}

function SmashPlayerSelect({
  seatNumber,
  playerCount,
  availablePlayers,
  assignedPlayers,
  onSelect,
  onGuestClick,
  onBack,
  hideGuestOption,
}: SmashPlayerSelectProps) {
```

**Step 2: Conditionally render guest button**

Replace lines 56-59 (the `rightAction` prop on `SmashHeader`):

```tsx
          rightAction={hideGuestOption ? undefined : {
            label: '+ Guest',
            onClick: onGuestClick,
          }}
```

**Step 3: Verify build compiles**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npx tsc --noEmit`
Expected: No errors (prop is optional, no callers need updating)

**Step 4: Commit**

```bash
git add frontend/src/components/match-tracker/smash-select/SmashPlayerSelect.tsx
git commit -m "feat: add hideGuestOption prop to SmashPlayerSelect"
```

---

### Task 2: Add `allowedPlayerIds` and `hideGuestOption` props to PlayerAssignment

**Files:**
- Modify: `frontend/src/components/match-tracker/PlayerAssignment.tsx`

**Step 1: Add props to interface and destructure them**

At line 7, add two optional props to `PlayerAssignmentProps`:

```tsx
interface PlayerAssignmentProps {
  playerCount: number;
  players: PlayerSlot[];
  layout: LayoutType;
  onComplete: (players: PlayerSlot[]) => void;
  onBack: () => void;
  allowedPlayerIds?: string[];
  hideGuestOption?: boolean;
}
```

At line 22, add them to the destructured params:

```tsx
function PlayerAssignment({ playerCount, players: initialPlayers, layout, onComplete, onBack, allowedPlayerIds, hideGuestOption }: PlayerAssignmentProps) {
```

**Step 2: Filter players in `loadPlayers`**

In the `loadPlayers` function (line 66-81), after `const data = await playerApi.getAll();` (line 68), add filtering before `setAvailablePlayers`:

```tsx
  const loadPlayers = async () => {
    try {
      const data = await playerApi.getAll();
      const filtered = allowedPlayerIds
        ? data.filter(p => p.id && allowedPlayerIds.includes(p.id))
        : data;
      setAvailablePlayers(filtered);
      console.log(`[PlayerAssignment] Loaded ${filtered.length} players${allowedPlayerIds ? ` (filtered from ${data.length})` : ''}`);

      // Preload commander images for faster deck selection
      const allDecks = await deckApi.getAll();
      const imageUrls = allDecks
        .map((d) => d.commander_image_url)
        .filter(Boolean) as string[];
      preloadImages(imageUrls);
    } catch (err) {
      console.error('[PlayerAssignment] Error loading players:', err);
    }
  };
```

**Step 3: Pass `hideGuestOption` to SmashPlayerSelect**

At line 264-272, add the prop to the SmashPlayerSelect render:

```tsx
      {selectionPhase.type === 'player-select' && (
        <SmashPlayerSelect
          seatNumber={selectionPhase.position}
          playerCount={playerCount}
          availablePlayers={availablePlayers}
          assignedPlayers={players}
          onSelect={handlePlayerSelect}
          onGuestClick={handleGuestClick}
          onBack={() => setSelectionPhase({ type: 'grid' })}
          hideGuestOption={hideGuestOption}
        />
      )}
```

**Step 4: Verify build compiles**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npx tsc --noEmit`
Expected: No errors (both props are optional, existing callers unaffected)

**Step 5: Commit**

```bash
git add frontend/src/components/match-tracker/PlayerAssignment.tsx
git commit -m "feat: add allowedPlayerIds and hideGuestOption props to PlayerAssignment"
```

---

### Task 3: Refactor EventMatchTracker — remove nav blocking and use empty slots

**Files:**
- Modify: `frontend/src/pages/EventMatchTracker.tsx`

**Step 1: Clean up imports**

Line 4: Remove `playerApi` — change to:
```tsx
import { eventApi, matchApi } from '../services/api';
```

Line 5: Remove `Player` — change to:
```tsx
import type { TournamentEvent, CreateMatchRequest } from '../services/api';
```

**Step 2: Replace `allPlayers` state with `podPlayerIds`**

Line 44: Replace `const [allPlayers, setAllPlayers] = useState<Player[]>([]);` with:
```tsx
  const [podPlayerIds, setPodPlayerIds] = useState<string[]>([]);
```

**Step 3: Delete `isActiveGame` variable**

Delete line 58: `const isActiveGame = matchState?.currentStep === 'game' || matchState?.currentStep === 'winner';`

This was only used by the navigation blocking `useEffect` which we're removing.

**Step 4: Refactor `loadData` — remove playerApi call, create empty slots**

In the `loadData` async function (lines 64-158):

Replace lines 69-75 (the Promise.all and setAllPlayers):
```tsx
        const eventData = await eventApi.getById(eventId);
        setEvent(eventData);
```

After the pod validation (after line 92), add:
```tsx
        setPodPlayerIds(pod.player_ids);
```

Replace lines 125-151 (the slot building and matchState initialization) with:
```tsx
        // Create empty slots like regular MatchTracker
        // For odd player counts, create extra slots so players can choose positions
        const podSize = pod.player_ids.length;
        const totalSlots = podSize === 3 ? 4 : podSize === 5 ? 6 : podSize;
        const emptyPlayers: PlayerSlot[] = Array.from({ length: totalSlots }, (_, i) => ({
          position: i + 1,
          playerId: null,
          playerName: '',
          deckId: null,
          deckName: '',
          commanderName: '',
          commanderImageUrl: '',
          isGuest: false,
        }));

        // Initialize match state starting at assignment step (player + deck selection)
        setMatchState({
          playerCount: podSize,
          players: emptyPlayers,
          layout: 'table' as LayoutType,
          startingLife: 40,
          currentStep: 'assignment',
        });
```

**Step 5: Delete the navigation blocking `useEffect`**

Delete lines 366-389 entirely — the `useEffect` that sets up `popstate` and `beforeunload` handlers:
```tsx
  // Block browser back button during active game via popstate + history guard
  useEffect(() => {
    if (!isActiveGame) return;
    // ... entire block through the closing }, [isActiveGame]);
  ```

**Step 6: Pass filtering props to PlayerAssignment**

Replace lines 458-466 (the PlayerAssignment render) with:
```tsx
      {matchState.currentStep === 'assignment' && (
        <PlayerAssignment
          playerCount={matchState.playerCount}
          players={matchState.players}
          layout={matchState.layout}
          onComplete={handlePlayerAssignment}
          onBack={handleMatchDiscard}
          allowedPlayerIds={podPlayerIds}
          hideGuestOption={true}
        />
      )}
```

**Step 7: Verify build compiles**

Run: `cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add frontend/src/pages/EventMatchTracker.tsx
git commit -m "fix: remove nav blocking and use empty slots in EventMatchTracker

Event matches now behave like regular matches:
- No beforeunload/popstate blocking
- Empty slots for player position choice
- Filtered player list (pod members only)
- Normal deck selection flow"
```

---

### Task 4: Manual Verification

**Step 1: Start dev servers**

Terminal 1:
```bash
cd /home/nturner/PersonalRepos/MTGLeaderboard/backend && uv run uvicorn app.main:app --reload --port 7777
```

Terminal 2:
```bash
cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npm run dev
```

**Step 2: Test event match flow**

1. Navigate to Events, create a test event with 4 players, start round 1
2. Start a pod match — verify:
   - Empty assignment slots appear (not pre-filled with players)
   - Tap a slot — only event pod players shown in selection
   - No "+ Guest" button in player selection
   - After picking a player, deck selection screen appears
   - Fill all 4 slots with players + decks, tap GO
3. Game starts normally

**Step 3: Test navigation resilience**

1. During active game, reload the page — verify:
   - No "are you sure" popup
   - Match state restores from localStorage
2. During active game, press browser back — verify:
   - No blocking, navigates away
   - Click Play button on main nav — routes back to event match in progress

**Step 4: Test Exit button**

1. During active game, tap menu → Exit
2. Confirm exit — verify:
   - Navigates to event page
   - Pod match status reset to pending (can be started again)

**Step 5: Test regular match unaffected**

1. Start a regular match from Play button
2. Verify all players appear (not filtered), guest option available
3. Normal flow unchanged
