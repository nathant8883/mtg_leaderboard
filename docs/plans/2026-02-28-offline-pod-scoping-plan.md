# Offline Pod Scoping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent pod data from leaking across pod boundaries in offline mode and unscoped API fallbacks.

**Architecture:** Three defense layers — (1) backend endpoints return empty lists instead of all-players fallbacks, (2) frontend caches pod member IDs in localStorage and filters API responses client-side, (3) service worker caches are cleared on pod switch. All 8 affected endpoints across 4 routers are fixed.

**Tech Stack:** FastAPI (Python), React/TypeScript, Workbox service worker, localStorage

**Design doc:** `docs/plans/2026-02-28-offline-pod-scoping-design.md`

---

### Task 1: Fix `get_all_players()` fallback in players router

**Files:**
- Modify: `backend/app/routers/players.py:14-67`

**Step 1: Replace unscoped fallbacks with empty list**

Replace lines 24-52 of `get_all_players()`. The superuser branch (lines 20-23) stays unchanged. All three fallback paths (no auth/no pod, pod not found, exception) return `[]` instead of querying all players.

```python
@router.get("/")
async def get_all_players(current_player: Optional[Player] = Depends(get_optional_player)):
    """Get all players in current pod. Returns empty list if no pod context.
    Superusers always see all players regardless of pod membership."""

    # Superusers always see all non-guest players
    if current_player and current_player.is_superuser:
        players = await Player.find(
            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
        ).to_list()
    # No auth or no pod — return empty (pod context required)
    elif not current_player or not current_player.current_pod_id:
        players = []
    else:
        # Get pod members
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
            else:
                logger.warning(f"Pod {current_player.current_pod_id} not found for player {current_player.id}")
                players = []
        except Exception as e:
            logger.warning(f"Error fetching pod {current_player.current_pod_id}: {e}")
            players = []

    # Convert _id to id for frontend compatibility
    return [
        {
            "id": str(player.id),
            "name": player.name,
            "avatar": player.avatar,
            "picture": player.picture,
            "custom_avatar": player.custom_avatar,
            "kill_messages": player.kill_messages,
            "deck_ids": player.deck_ids,
            "created_at": player.created_at
        }
        for player in players
    ]
```

**Step 2: Add logger import if missing**

Check top of `players.py` — if `logger` is not defined, add:

```python
import logging
logger = logging.getLogger(__name__)
```

**Step 3: Verify manually**

Run: `cd backend && uv run python -c "from app.routers.players import router; print('OK')"`
Expected: `OK` (no import errors)

**Step 4: Commit**

```
git add backend/app/routers/players.py
git commit -m "fix: return empty list instead of all players when no pod context"
```

---

### Task 2: Fix `get_all_decks()` fallback in decks router

**Files:**
- Modify: `backend/app/routers/decks.py:35-60`

**Step 1: Replace unscoped fallbacks with empty list**

Same pattern as Task 1. Replace the three fallback branches with empty list returns. Note: decks router has no superuser override — just the pod-scoped and fallback paths.

```python
@router.get("/")
async def get_all_decks(current_player: Optional[Player] = Depends(get_optional_player)):
    """Get all enabled decks from current pod. Returns empty list if no pod context."""
    # No auth or no pod — return empty (pod context required)
    if not current_player or not current_player.current_pod_id:
        decks = []
    else:
        # Two-step filtering: get pod members, then get their decks
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                decks = await Deck.find(
                    {
                        "$and": [
                            {"player_id": {"$in": pod.member_ids}},
                            {"$or": [{"disabled": False}, {"disabled": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
            else:
                logger.warning(f"Pod {current_player.current_pod_id} not found for player {current_player.id}")
                decks = []
        except Exception as e:
            logger.warning(f"Error fetching pod {current_player.current_pod_id}: {e}")
            decks = []
```

The rest of the function (serialization) stays unchanged.

**Step 2: Verify `logger` exists**

`decks.py` already has `logger = logging.getLogger(__name__)` at line 7 — no change needed.

**Step 3: Verify manually**

Run: `cd backend && uv run python -c "from app.routers.decks import router; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```
git add backend/app/routers/decks.py
git commit -m "fix: return empty list instead of all decks when no pod context"
```

---

### Task 3: Fix leaderboard router fallbacks (3 endpoints)

**Files:**
- Modify: `backend/app/routers/leaderboard.py:22-62` (player leaderboard)
- Modify: `backend/app/routers/leaderboard.py:122-172` (deck leaderboard)
- Modify: `backend/app/routers/leaderboard.py:228-272` (dashboard stats)

**Step 1: Fix `get_player_leaderboard()` (lines 22-62)**

Replace the no-pod/fallback branches. When no pod context: `players = []`, `matches = []`.

```python
@router.get("/players")
async def get_player_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> list[Dict[str, Any]]:
    """Get leaderboard by player from current pod. Returns empty list if no pod context."""
    if not current_player or not current_player.current_pod_id:
        players = []
        matches = []
    else:
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                matches = await Match.find(Match.pod_id == current_player.current_pod_id).to_list()
            else:
                logger.warning(f"Pod {current_player.current_pod_id} not found for player {current_player.id}")
                players = []
                matches = []
        except Exception as e:
            logger.warning(f"Error fetching pod {current_player.current_pod_id}: {e}")
            players = []
            matches = []
```

**Step 2: Fix `get_deck_leaderboard()` (lines 122-172)**

Same pattern. When no pod context: `decks = []`, `matches = []`, `players = []`.

```python
@router.get("/decks")
async def get_deck_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> list[Dict[str, Any]]:
    """Get leaderboard by deck from current pod. Returns empty list if no pod context."""
    if not current_player or not current_player.current_pod_id:
        decks = []
        matches = []
        players = []
    else:
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                decks = await Deck.find(
                    {
                        "$and": [
                            {"player_id": {"$in": pod.member_ids}},
                            {"$or": [{"disabled": False}, {"disabled": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                matches = await Match.find(Match.pod_id == current_player.current_pod_id).to_list()
            else:
                logger.warning(f"Pod {current_player.current_pod_id} not found for player {current_player.id}")
                decks = []
                matches = []
                players = []
        except Exception as e:
            logger.warning(f"Error fetching pod {current_player.current_pod_id}: {e}")
            decks = []
            matches = []
            players = []
```

**Step 3: Fix `get_dashboard_stats()` (lines 228-272)**

Same pattern. When no pod context: `players = []`, `matches = []`, `decks = []`.

```python
@router.get("/stats")
async def get_dashboard_stats(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """Get dashboard statistics from current pod. Returns zeroed stats if no pod context."""
    if not current_player or not current_player.current_pod_id:
        players = []
        matches = []
        decks = []
    else:
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                decks = await Deck.find({"player_id": {"$in": pod.member_ids}}).to_list()
                matches = await Match.find(Match.pod_id == current_player.current_pod_id).to_list()
            else:
                logger.warning(f"Pod {current_player.current_pod_id} not found for player {current_player.id}")
                players = []
                matches = []
                decks = []
        except Exception as e:
            logger.warning(f"Error fetching pod {current_player.current_pod_id}: {e}")
            players = []
            matches = []
            decks = []
```

**Step 4: Verify manually**

Run: `cd backend && uv run python -c "from app.routers.leaderboard import router; print('OK')"`
Expected: `OK`

**Step 5: Commit**

```
git add backend/app/routers/leaderboard.py
git commit -m "fix: return empty data instead of all-user fallback in leaderboard endpoints"
```

---

### Task 4: Fix matches router fallbacks (2 endpoints)

**Files:**
- Modify: `backend/app/routers/matches.py:70-104`

**Step 1: Fix `get_all_matches()` (lines 70-86)**

```python
@router.get("/")
async def get_all_matches(
    limit: int = 50,
    skip: int = 0,
    current_player: Optional[Player] = Depends(get_optional_player)
):
    """Get all matches from current pod. Returns empty list if no pod context."""
    if not current_player or not current_player.current_pod_id:
        matches = []
    else:
        matches = await Match.find(
            Match.pod_id == current_player.current_pod_id
        ).sort(-Match.match_date, -Match.created_at).skip(skip).limit(limit).to_list()

    return [serialize_match(match) for match in matches]
```

**Step 2: Fix `get_recent_matches()` (lines 89-104)**

```python
@router.get("/recent")
async def get_recent_matches(
    limit: int = 10,
    current_player: Optional[Player] = Depends(get_optional_player)
):
    """Get recent matches from current pod. Returns empty list if no pod context."""
    if not current_player or not current_player.current_pod_id:
        matches = []
    else:
        matches = await Match.find(
            Match.pod_id == current_player.current_pod_id
        ).sort(-Match.match_date, -Match.created_at).limit(limit).to_list()

    return [serialize_match(match) for match in matches]
```

**Step 3: Verify manually**

Run: `cd backend && uv run python -c "from app.routers.matches import router; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```
git add backend/app/routers/matches.py
git commit -m "fix: return empty list instead of all matches when no pod context"
```

---

### Task 5: Cache pod member IDs in localStorage and add client-side filter

**Files:**
- Modify: `frontend/src/contexts/PodContext.tsx`

**Step 1: Add localStorage caching of member IDs**

Add a constant for the key at line 21 (next to `CURRENT_POD_KEY`):

```typescript
const POD_MEMBERS_KEY = 'mtg_current_pod_member_ids';
```

**Step 2: Cache member IDs when pod is set**

In `loadPodsAndInvites()`, after `setCurrentPod(pod)` (line 57), add:

```typescript
localStorage.setItem(POD_MEMBERS_KEY, JSON.stringify(pod.member_ids));
```

In `switchPod()`, after `setCurrentPod(pod)` (line 91), add:

```typescript
if (pod) {
  localStorage.setItem(POD_MEMBERS_KEY, JSON.stringify(pod.member_ids));
}
```

**Step 3: Clear member IDs on logout/guest**

In the `useEffect` that clears state when user is guest/logged out (line 34-38 area), add:

```typescript
localStorage.removeItem(POD_MEMBERS_KEY);
```

**Step 4: Export a helper function for reading cached member IDs**

Add before the `PodProvider` component:

```typescript
export const getCachedPodMemberIds = (): string[] | null => {
  const stored = localStorage.getItem(POD_MEMBERS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};
```

**Step 5: Commit**

```
git add frontend/src/contexts/PodContext.tsx
git commit -m "feat: cache pod member IDs in localStorage for offline filtering"
```

---

### Task 6: Add client-side pod filter in MatchTracker

**Files:**
- Modify: `frontend/src/pages/MatchTracker.tsx:143-160`

**Step 1: Import the helper**

Add to imports at top of file:

```typescript
import { getCachedPodMemberIds } from '../contexts/PodContext';
```

**Step 2: Filter API response through cached member IDs**

Replace the data loading `useEffect` (lines 143-160):

```typescript
// Load players and decks - SW cache will serve if available
useEffect(() => {
  const loadData = async () => {
    try {
      console.log('[MatchTracker] Fetching players and decks...');
      const [playersData, decksData] = await Promise.all([
        playerApi.getAll(),
        deckApi.getAll(),
      ]);

      // Client-side pod filter: safety net against stale/unscoped cached data
      const cachedMemberIds = getCachedPodMemberIds();
      if (cachedMemberIds && !isGuest) {
        const filteredPlayers = playersData.filter(p => p.id && cachedMemberIds.includes(p.id));
        const filteredDecks = decksData.filter(d => d.player_id && cachedMemberIds.includes(d.player_id));
        setPlayers(filteredPlayers);
        setDecks(filteredDecks);
        console.log(`[MatchTracker] ✅ Loaded ${filteredPlayers.length} players and ${filteredDecks.length} decks (filtered from ${playersData.length}/${decksData.length})`);
      } else {
        setPlayers(playersData);
        setDecks(decksData);
        console.log(`[MatchTracker] ✅ Loaded ${playersData.length} players and ${decksData.length} decks`);
      }
    } catch (error) {
      console.error('[MatchTracker] ❌ Failed to load data:', error);
    }
  };
  loadData();
}, []);
```

**Step 3: Commit**

```
git add frontend/src/pages/MatchTracker.tsx
git commit -m "feat: add client-side pod member filter in MatchTracker"
```

---

### Task 7: Add client-side pod filter in PlayerAssignment

**Files:**
- Modify: `frontend/src/components/match-tracker/PlayerAssignment.tsx:88-110`

**Step 1: Import the helper**

Add to imports:

```typescript
import { getCachedPodMemberIds } from '../../contexts/PodContext';
```

**Step 2: Add pod filtering after existing `allowedPlayerIds` filter**

Replace the `loadPlayers` function (lines 92-110):

```typescript
const loadPlayers = async () => {
  try {
    const data = await playerApi.getAll();

    // First filter: allowedPlayerIds (event-specific scoping)
    let filtered = allowedPlayerIds
      ? data.filter(p => p.id && allowedPlayerIds.includes(p.id))
      : data;

    // Second filter: pod member IDs (offline safety net)
    const cachedMemberIds = getCachedPodMemberIds();
    if (cachedMemberIds && !allowedPlayerIds) {
      filtered = filtered.filter(p => p.id && cachedMemberIds.includes(p.id));
    }

    setAvailablePlayers(filtered);
    console.log(`[PlayerAssignment] Loaded ${filtered.length} players${allowedPlayerIds ? ` (event-filtered from ${data.length})` : cachedMemberIds ? ` (pod-filtered from ${data.length})` : ''}`);

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

**Step 3: Commit**

```
git add frontend/src/components/match-tracker/PlayerAssignment.tsx
git commit -m "feat: add client-side pod member filter in PlayerAssignment"
```

---

### Task 8: Clear service worker caches on pod switch

**Files:**
- Modify: `frontend/src/contexts/PodContext.tsx` (inside `switchPod()`)

**Step 1: Add cache clearing before the `podSwitched` event dispatch**

In `switchPod()`, after the `refreshPlayer()` call (line 96) and before the `window.dispatchEvent` (line 99), add:

```typescript
// Clear pod-scoped API caches so stale data from previous pod doesn't persist
if ('caches' in window) {
  try {
    await caches.delete('api-players-cache');
    await caches.delete('api-decks-cache');
    console.log('[PodContext] Cleared API caches for pod switch');
  } catch (e) {
    console.warn('[PodContext] Failed to clear API caches:', e);
  }
}
```

**Step 2: Commit**

```
git add frontend/src/contexts/PodContext.tsx
git commit -m "feat: clear service worker API caches on pod switch"
```

---

### Task 9: Verify end-to-end

**Step 1: Start development servers**

Run backend: `cd backend && uv run uvicorn app.main:app --reload --port 7777`
Run frontend: `cd frontend && npm run dev`

**Step 2: Manual verification checklist**

1. Log in with a pod → MatchTracker only shows pod members
2. Check browser console for `[MatchTracker] ✅ Loaded N players ... (filtered from ...)`
3. Switch pods → check Application > Cache Storage in DevTools, confirm `api-players-cache` and `api-decks-cache` are cleared
4. Check localStorage for `mtg_current_pod_member_ids` key with correct member IDs
5. Open DevTools > Application > Service Workers > check "Offline" → navigate to MatchTracker → confirm only pod members shown
6. Quick Play mode → confirm guest players are created (no real players leaked)

**Step 3: Final commit**

If any adjustments were needed during testing, commit them:

```
git commit -m "fix: address issues found during offline pod scoping verification"
```
