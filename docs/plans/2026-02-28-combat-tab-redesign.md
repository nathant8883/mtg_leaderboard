# Combat Tab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Combat tab's Kill Streaks and Rivalries sections with more insightful stats (First Blood, Hunting Asymmetry, Combat Archetypes) that reveal player behavior independent of win rate.

**Architecture:** Backend-first approach — modify the `get_elimination_stats` endpoint to compute new metrics (kills_in_losses, first blood, archetypes, asymmetric hunting pairs), then update frontend components to display them. Response shape changes are additive where possible, replacing `nemesis_pairs` → `hunting_pairs` and `top_kill_streaks` → `first_blood_stats`.

**Tech Stack:** FastAPI (Python), React + TypeScript, Tailwind CSS v4

**Design doc:** `docs/plans/2026-02-28-combat-tab-redesign-design.md`

---

### Task 1: Backend — Add new tracking variables to elimination stats loop

**Files:**
- Modify: `backend/app/routers/pod_dynamics.py` (function `get_elimination_stats`, ~lines 1043-1284)

**Context:** The existing function iterates through `matches_with_data` and each match's `players` list. We need to add tracking for: kills_in_losses, wins, first blood, and first eliminated — all derivable from existing `MatchPlayer` fields (`elimination_order`, `eliminated_by_player_id`, `elimination_type`, `is_winner`).

**Step 1: Add new tracking variables**

After the existing `player_stats` defaultdict (around line 1108), add these new tracking variables alongside the existing ones:

```python
    # --- NEW: Additional tracking for combat redesign ---
    # Track kills in games the player lost
    kills_in_losses: Dict[str, int] = defaultdict(int)
    # Track wins per player
    wins_per_player: Dict[str, int] = defaultdict(int)
    # Track first blood credits
    first_blood_counts: Dict[str, int] = defaultdict(int)
    # Track first blood games that converted to wins
    first_blood_wins: Dict[str, int] = defaultdict(int)
    # Track times each player was first eliminated
    first_eliminated_counts: Dict[str, int] = defaultdict(int)
```

**Step 2: Add per-match first blood and first-eliminated tracking inside the match loop**

Inside the `for match in matches_with_data:` loop, AFTER the existing per-player loop ends (after the kill/scoop counting and kill_pairs tracking), add:

```python
        # --- NEW: First blood detection ---
        # Find the first player eliminated by a kill (highest elimination_order with type "kill")
        kill_eliminations = [
            p for p in match.players
            if p.elimination_type == "kill" and p.elimination_order is not None
        ]
        if kill_eliminations:
            first_eliminated_player = max(kill_eliminations, key=lambda p: p.elimination_order)
            # Credit first blood to the killer
            if first_eliminated_player.eliminated_by_player_id:
                killer_id = first_eliminated_player.eliminated_by_player_id
                first_blood_counts[killer_id] += 1
                # Check if killer also won this match
                winner = next((p for p in match.players if p.is_winner), None)
                if winner and winner.player_id == killer_id:
                    first_blood_wins[killer_id] += 1

        # --- NEW: First eliminated tracking ---
        # Find the player who was eliminated first (highest elimination_order overall)
        players_with_order = [
            p for p in match.players
            if p.elimination_order is not None and p.elimination_order > 1  # Exclude winner (order=1)
        ]
        if players_with_order:
            first_to_die = max(players_with_order, key=lambda p: p.elimination_order)
            first_eliminated_counts[first_to_die.player_id] += 1

        # --- NEW: Track wins and kills_in_losses ---
        winner = next((p for p in match.players if p.is_winner), None)
        winner_id = winner.player_id if winner else None
        if winner_id:
            wins_per_player[winner_id] += 1

        # Count kills per player in this match, credit kills_in_losses for non-winners
        for killer_id, victims in match_kills_by_player.items():
            if killer_id != winner_id:
                kills_in_losses[killer_id] += len(victims)
```

**Step 3: Verify**

Start the backend: `cd backend && uv run uvicorn app.main:app --reload --port 7777`

Hit the endpoint: `curl http://localhost:7777/api/pod-dynamics/elimination-stats` (with auth)

Verify no errors — response shape hasn't changed yet.

**Step 4: Commit**

```bash
git add backend/app/routers/pod_dynamics.py
git commit -m "feat: add tracking for kills_in_losses, first blood, first eliminated"
```

---

### Task 2: Backend — Compute combat archetypes

**Files:**
- Modify: `backend/app/routers/pod_dynamics.py` (function `get_elimination_stats`)

**Context:** After the match loop completes and before building leaderboards, compute each player's combat archetype. Use min-max normalization across the pod, assign each player the archetype where they score highest.

**Step 1: Add archetype computation after the match loop, before the leaderboard building section**

Insert this block AFTER the match iteration loop ends and BEFORE the `# Build leaderboards` comment:

```python
    # --- Combat Archetype Assignment ---
    # Compute raw scores for each archetype category
    archetype_scores: Dict[str, Dict[str, float]] = {}
    for player_id, stats in player_stats.items():
        games = stats["games_played"]
        if games == 0:
            continue
        player_wins = wins_per_player.get(player_id, 0)
        games_lost = max(games - player_wins, 1)
        win_rate = player_wins / games
        kill_rate = stats["total_kills"] / games
        total_deaths = stats["times_killed"] + stats["times_scooped"]
        scoop_rate = stats["times_scooped"] / total_deaths if total_deaths > 0 else 0

        archetype_scores[player_id] = {
            "Assassin": kills_in_losses.get(player_id, 0) / games_lost,
            "Kingmaker": kill_rate * (1 - win_rate),
            "Berserker": first_blood_counts.get(player_id, 0) / games,
            "Target": first_eliminated_counts.get(player_id, 0) / games,
            "Survivor": (1 - win_rate) * (1 / max(sum(stats["placements"]) / max(len(stats["placements"]), 1), 1)) * (1 - min(kill_rate, 1)) if stats["placements"] else 0,
            "Table Flipper": scoop_rate,
        }

    # Min-max normalize each category across all players
    if archetype_scores:
        categories = ["Assassin", "Kingmaker", "Berserker", "Target", "Survivor", "Table Flipper"]
        normalized_scores: Dict[str, Dict[str, float]] = {pid: {} for pid in archetype_scores}

        for cat in categories:
            values = [archetype_scores[pid][cat] for pid in archetype_scores]
            min_val = min(values)
            max_val = max(values)
            range_val = max_val - min_val if max_val != min_val else 1
            for pid in archetype_scores:
                normalized_scores[pid][cat] = (archetype_scores[pid][cat] - min_val) / range_val

        # Assign each player their highest-scoring archetype
        player_archetypes: Dict[str, str] = {}
        for pid in normalized_scores:
            player_archetypes[pid] = max(normalized_scores[pid], key=normalized_scores[pid].get)
    else:
        player_archetypes = {}
```

**Step 2: Commit**

```bash
git add backend/app/routers/pod_dynamics.py
git commit -m "feat: compute combat archetypes via min-max normalization"
```

---

### Task 3: Backend — Add new fields to response and replace nemesis/streaks

**Files:**
- Modify: `backend/app/routers/pod_dynamics.py` (function `get_elimination_stats`)

**Step 1: Add new fields to player_entry in leaderboard building**

In the leaderboard building section, add these fields to the `player_entry` dict:

```python
        player_entry = {
            # ... existing fields ...
            "player_id": player_id,
            "player_name": stats["name"],
            "avatar": player_avatars.get(player_id),
            "total_kills": stats["total_kills"],
            "kill_rate": kill_rate,
            "max_kills_in_game": stats["max_kills_in_game"],
            "total_deaths": total_deaths,
            "times_scooped": stats["times_scooped"],
            "times_killed": stats["times_killed"],
            "scoop_rate": scoop_rate,
            "average_placement": avg_placement,
            "games_with_placement": len(placements),
            "first_place": first_place,
            "second_place": second_place,
            "third_place": third_place,
            "fourth_plus": fourth_plus,
            "games_played": games,
            # --- NEW fields ---
            "kills_in_losses": kills_in_losses.get(player_id, 0),
            "archetype": player_archetypes.get(player_id, "Survivor"),
        }
```

**Step 2: Replace nemesis_pairs calculation with hunting_pairs**

Replace the entire nemesis pairs block (the `# Build nemesis pairs` section) with:

```python
    # Build hunting pairs (asymmetric kill relationships)
    hunting_pairs = []
    # Get all unique player pairs
    player_ids_in_data = list(player_stats.keys())
    seen_pairs = set()
    for i, pid_a in enumerate(player_ids_in_data):
        for pid_b in player_ids_in_data[i+1:]:
            pair_key = tuple(sorted([pid_a, pid_b]))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            kills_a_to_b = kill_pairs.get((pid_a, pid_b), 0)
            kills_b_to_a = kill_pairs.get((pid_b, pid_a), 0)
            total_pair_kills = kills_a_to_b + kills_b_to_a
            if total_pair_kills == 0:
                continue

            # Calculate games together
            games_together = sum(
                1 for m in matches_with_data
                if pid_a in [p.player_id for p in m.players]
                and pid_b in [p.player_id for p in m.players]
            )

            # Filter: 5+ games together
            if games_together < 5:
                continue

            # Determine hunter (more kills) and prey (fewer kills)
            if kills_a_to_b >= kills_b_to_a:
                hunter_id, prey_id = pid_a, pid_b
                hunter_kills, prey_kills = kills_a_to_b, kills_b_to_a
            else:
                hunter_id, prey_id = pid_b, pid_a
                hunter_kills, prey_kills = kills_b_to_a, kills_a_to_b

            # Calculate ratio (avoid division by zero)
            kill_ratio = round(hunter_kills / max(prey_kills, 1), 1)

            # Filter: 2:1+ asymmetry
            if kill_ratio < 2.0:
                continue

            # Determine label
            if kill_ratio >= 5.0:
                label = "Arch-Nemesis"
            elif kill_ratio >= 3.0:
                label = "Nemesis"
            else:
                label = None

            hunting_pairs.append({
                "hunter_id": hunter_id,
                "hunter_name": player_stats[hunter_id]["name"],
                "hunter_avatar": player_avatars.get(hunter_id),
                "prey_id": prey_id,
                "prey_name": player_stats[prey_id]["name"],
                "prey_avatar": player_avatars.get(prey_id),
                "hunter_kills": hunter_kills,
                "prey_kills": prey_kills,
                "kill_ratio": kill_ratio,
                "games_together": games_together,
                "label": label,
            })

    # Sort by kill ratio descending
    hunting_pairs.sort(key=lambda x: -x["kill_ratio"])
    hunting_pairs = hunting_pairs[:10]  # Top 10
```

**Step 3: Build first blood leaderboard**

Replace the kill streaks sorting/filtering section with:

```python
    # Build first blood leaderboard
    first_blood_leaders = []
    for player_id in first_blood_counts:
        if first_blood_counts[player_id] == 0:
            continue
        games = player_stats[player_id]["games_played"]
        fb_count = first_blood_counts[player_id]
        fb_wins = first_blood_wins.get(player_id, 0)
        first_blood_leaders.append({
            "player_id": player_id,
            "player_name": player_stats[player_id]["name"],
            "avatar": player_avatars.get(player_id),
            "first_blood_count": fb_count,
            "first_blood_rate": round(fb_count / max(games, 1) * 100, 1),
            "conversion_rate": round(fb_wins / max(fb_count, 1) * 100, 1),
            "games_played": games,
        })
    first_blood_leaders.sort(key=lambda x: (-x["first_blood_count"], -x["first_blood_rate"]))
```

**Step 4: Update the return dict**

Replace the return statement to include new fields and remove old ones:

```python
    return {
        "kill_leaders": kill_leaders,
        "scoop_leaders": scoop_leaders,
        "placement_leaders": placement_leaders,
        "hunting_pairs": hunting_pairs,
        "first_blood_leaders": first_blood_leaders,
        "total_kills": total_kills,
        "total_scoops": total_scoops,
        "total_games_with_elimination_data": total_games,
        "scoop_rate_pod": scoop_rate_pod,
        "avg_kills_per_game": avg_kills_per_game,
        # Keep old fields for backward compat during frontend migration
        "nemesis_pairs": [],
        "top_kill_streaks": [],
    }
```

**Step 5: Also update the empty-data early returns**

The function has 3 early return blocks (no player, no matches, no elimination data). Add `hunting_pairs`, `first_blood_leaders` as empty arrays to each, alongside the existing `nemesis_pairs` and `top_kill_streaks`.

Example (apply to all 3 early returns):
```python
        return {
            "kill_leaders": [],
            "scoop_leaders": [],
            "placement_leaders": [],
            "nemesis_pairs": [],
            "top_kill_streaks": [],
            "hunting_pairs": [],
            "first_blood_leaders": [],
            "total_kills": 0,
            "total_scoops": 0,
            "total_games_with_elimination_data": 0,
            "scoop_rate_pod": 0,
            "avg_kills_per_game": 0
        }
```

**Step 6: Verify backend starts without errors**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 7777
```

Hit the endpoint and verify new fields appear in the response.

**Step 7: Commit**

```bash
git add backend/app/routers/pod_dynamics.py
git commit -m "feat: replace nemesis/streaks with hunting pairs, first blood, archetypes"
```

---

### Task 4: Frontend — Update TypeScript interfaces

**Files:**
- Modify: `frontend/src/services/api.ts` (~lines 961-1021)

**Step 1: Add new fields to PlayerEliminationStats**

Add at the end of the interface (before the closing `}`):

```typescript
  // Combat archetype
  kills_in_losses: number;
  archetype: string;
```

**Step 2: Add new interfaces and update EliminationStatsData**

After the existing `KillStreak` interface, add:

```typescript
export interface FirstBloodEntry {
  player_id: string;
  player_name: string;
  avatar?: string | null;
  first_blood_count: number;
  first_blood_rate: number;
  conversion_rate: number;
  games_played: number;
}

export interface HuntingPair {
  hunter_id: string;
  hunter_name: string;
  hunter_avatar?: string | null;
  prey_id: string;
  prey_name: string;
  prey_avatar?: string | null;
  hunter_kills: number;
  prey_kills: number;
  kill_ratio: number;
  games_together: number;
  label: string | null;
}
```

**Step 3: Update EliminationStatsData**

Add new fields to the interface:

```typescript
export interface EliminationStatsData {
  kill_leaders: PlayerEliminationStats[];
  scoop_leaders: PlayerEliminationStats[];
  placement_leaders: PlayerEliminationStats[];
  nemesis_pairs: NemesisPair[];       // Keep for backward compat
  top_kill_streaks: KillStreak[];     // Keep for backward compat
  hunting_pairs: HuntingPair[];       // NEW
  first_blood_leaders: FirstBloodEntry[];  // NEW
  total_kills: number;
  total_scoops: number;
  total_games_with_elimination_data: number;
  scoop_rate_pod: number;
  avg_kills_per_game: number;
}
```

**Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add TypeScript interfaces for combat redesign"
```

---

### Task 5: Frontend — Enhance KillLeaderboard with archetype badges

**Files:**
- Modify: `frontend/src/components/pod-dynamics/KillLeaderboard.tsx`

**Context:** The existing component shows a ranked list of players by total kills. We need to add: (1) a colored archetype badge next to each player name, and (2) a "kills in losses" stat.

**Step 1: Add archetype color/icon mapping**

At the top of the file (after imports), add:

```typescript
const ARCHETYPE_CONFIG: Record<string, { color: string; bg: string; }> = {
  'Assassin':      { color: '#FF4444', bg: 'rgba(255, 68, 68, 0.15)' },
  'Kingmaker':     { color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)' },
  'Berserker':     { color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.15)' },
  'Target':        { color: '#FF69B4', bg: 'rgba(255, 105, 180, 0.15)' },
  'Survivor':      { color: '#33D9B2', bg: 'rgba(51, 217, 178, 0.15)' },
  'Table Flipper': { color: '#9B59B6', bg: 'rgba(155, 89, 182, 0.15)' },
};
```

**Step 2: Add archetype badge element to each player row**

Below the player name in each row, add:

```tsx
{player.archetype && (
  <span
    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
    style={{
      color: ARCHETYPE_CONFIG[player.archetype]?.color || '#888',
      backgroundColor: ARCHETYPE_CONFIG[player.archetype]?.bg || 'rgba(136,136,136,0.15)',
    }}
  >
    {player.archetype}
  </span>
)}
```

**Step 3: Add kills_in_losses to the stats display**

Next to the existing total kills number on the right side of each row, add:

```tsx
<span className="text-[11px] text-[#888]">
  {player.kills_in_losses} in losses
</span>
```

**Step 4: Verify in browser**

Start frontend: `cd frontend && npm run dev`

Navigate to Pod Dynamics → Combat tab. Kill leaderboard should show archetype badges and kills-in-losses.

**Step 5: Commit**

```bash
git add frontend/src/components/pod-dynamics/KillLeaderboard.tsx
git commit -m "feat: add archetype badges and kills-in-losses to kill leaderboard"
```

---

### Task 6: Frontend — Create FirstBlood component (replaces KillStreakHighlights)

**Files:**
- Create: `frontend/src/components/pod-dynamics/FirstBlood.tsx`
- Delete content of: `frontend/src/components/pod-dynamics/KillStreakHighlights.tsx` (will be unused)

**Context:** This replaces the kill streaks section. Shows a ranked list of who draws first blood most often, with conversion rate (first blood → win).

**Step 1: Create the FirstBlood component**

Create `frontend/src/components/pod-dynamics/FirstBlood.tsx`:

```tsx
import { Crosshair } from 'lucide-react';
import type { FirstBloodEntry } from '../../services/api';

interface FirstBloodProps {
  leaders: FirstBloodEntry[];
}

export default function FirstBlood({ leaders }: FirstBloodProps) {
  if (!leaders || leaders.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Crosshair className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-bold text-white">First Blood</h3>
        <span className="text-[11px] text-[#888] ml-1">Who strikes first</span>
      </div>

      <div className="space-y-2">
        {leaders.map((player, index) => (
          <div
            key={player.player_id}
            className="flex items-center gap-3 p-3 rounded-[10px] border border-[#2C2E33]"
            style={{ background: 'linear-gradient(135deg, #1A1B1E 0%, #1C1D21 100%)' }}
          >
            {/* Rank */}
            <div className="text-[#555] font-bold text-sm w-6 text-center">
              {index + 1}
            </div>

            {/* Avatar */}
            <img
              src={player.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${player.player_name}`}
              alt={player.player_name}
              className="w-8 h-8 rounded-full"
            />

            {/* Name + rate */}
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-sm truncate">
                {player.player_name}
              </div>
              <div className="text-[11px] text-[#888]">
                {player.first_blood_rate}% of games
              </div>
            </div>

            {/* First blood count */}
            <div className="text-right">
              <div className="text-red-400 font-bold text-lg">
                {player.first_blood_count}
              </div>
              <div className="text-[10px] text-[#888]">first bloods</div>
            </div>

            {/* Conversion rate */}
            <div className="text-right ml-2 pl-2 border-l border-[#2C2E33]">
              <div className="text-[#33D9B2] font-bold text-sm">
                {player.conversion_rate}%
              </div>
              <div className="text-[10px] text-[#888]">win rate</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/pod-dynamics/FirstBlood.tsx
git commit -m "feat: create FirstBlood component replacing kill streaks"
```

---

### Task 7: Frontend — Create HuntingAsymmetry component (replaces NemesisList)

**Files:**
- Create: `frontend/src/components/pod-dynamics/HuntingAsymmetry.tsx`

**Context:** Replaces the nemesis list. Shows directional kill ratios between player pairs, filtered for 2:1+ asymmetry.

**Step 1: Create the HuntingAsymmetry component**

Create `frontend/src/components/pod-dynamics/HuntingAsymmetry.tsx`:

```tsx
import { Target } from 'lucide-react';
import type { HuntingPair } from '../../services/api';

interface HuntingAsymmetryProps {
  pairs: HuntingPair[];
}

export default function HuntingAsymmetry({ pairs }: HuntingAsymmetryProps) {
  if (!pairs || pairs.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-bold text-white">Hunting Grounds</h3>
        <span className="text-[11px] text-[#888] ml-1">Lopsided kill relationships</span>
      </div>

      <div className="space-y-3">
        {pairs.map((pair, index) => (
          <div
            key={`${pair.hunter_id}-${pair.prey_id}`}
            className="p-3 rounded-[10px] border border-[#2C2E33]"
            style={{ background: 'linear-gradient(135deg, #1A1B1E 0%, #1C1D21 100%)' }}
          >
            {/* Label badge */}
            {pair.label && (
              <div className="mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: pair.label === 'Arch-Nemesis' ? '#FF4444' : '#FF8C00',
                    backgroundColor: pair.label === 'Arch-Nemesis' ? 'rgba(255,68,68,0.15)' : 'rgba(255,140,0,0.15)',
                  }}
                >
                  {pair.label}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Hunter */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img
                  src={pair.hunter_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${pair.hunter_name}`}
                  alt={pair.hunter_name}
                  className="w-9 h-9 rounded-full ring-2 ring-red-500/40"
                />
                <div className="min-w-0">
                  <div className="text-white font-medium text-sm truncate">{pair.hunter_name}</div>
                  <div className="text-[10px] text-red-400">Hunter</div>
                </div>
              </div>

              {/* Ratio badge */}
              <div className="flex flex-col items-center px-3">
                <div className="text-white font-bold text-lg">
                  {pair.kill_ratio}:1
                </div>
                <div className="text-[10px] text-[#888]">
                  {pair.hunter_kills} vs {pair.prey_kills}
                </div>
              </div>

              {/* Prey */}
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  <div className="text-white/75 font-medium text-sm truncate">{pair.prey_name}</div>
                  <div className="text-[10px] text-[#888]">Prey</div>
                </div>
                <img
                  src={pair.prey_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${pair.prey_name}`}
                  alt={pair.prey_name}
                  className="w-9 h-9 rounded-full opacity-75"
                />
              </div>
            </div>

            {/* Games together */}
            <div className="text-[10px] text-[#555] mt-2 text-center">
              {pair.games_together} games together
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/pod-dynamics/HuntingAsymmetry.tsx
git commit -m "feat: create HuntingAsymmetry component replacing nemesis list"
```

---

### Task 8: Frontend — Update CombatTab to wire up new components

**Files:**
- Modify: `frontend/src/components/pod-dynamics/CombatTab.tsx`

**Context:** The CombatTab currently imports and renders KillStreakHighlights and NemesisList. We need to swap them for FirstBlood and HuntingAsymmetry.

**Step 1: Update imports**

Replace:
```typescript
import KillStreakHighlights from './KillStreakHighlights';
import NemesisList from './NemesisList';
```

With:
```typescript
import FirstBlood from './FirstBlood';
import HuntingAsymmetry from './HuntingAsymmetry';
```

**Step 2: Replace component usage**

Find where `<KillStreakHighlights` is rendered and replace with:
```tsx
<FirstBlood leaders={eliminationStats.first_blood_leaders} />
```

Find where `<NemesisList` is rendered and replace with:
```tsx
<HuntingAsymmetry pairs={eliminationStats.hunting_pairs} />
```

**Step 3: Verify in browser**

Navigate to Pod Dynamics → Combat tab. All four sections should render:
1. Kill Leaderboard (with archetype badges)
2. Scoop Shame (unchanged)
3. First Blood (new)
4. Hunting Asymmetry (new)

**Step 4: Commit**

```bash
git add frontend/src/components/pod-dynamics/CombatTab.tsx
git commit -m "feat: wire up FirstBlood and HuntingAsymmetry in CombatTab"
```

---

### Task 9: Cleanup — Remove old components and backward compat fields

**Files:**
- Delete: `frontend/src/components/pod-dynamics/KillStreakHighlights.tsx`
- Delete: `frontend/src/components/pod-dynamics/NemesisList.tsx`
- Modify: `backend/app/routers/pod_dynamics.py` — remove `nemesis_pairs` and `top_kill_streaks` from response
- Modify: `frontend/src/services/api.ts` — remove `NemesisPair`, `KillStreak` interfaces and their fields from `EliminationStatsData`

**Step 1: Delete old frontend components**

```bash
rm frontend/src/components/pod-dynamics/KillStreakHighlights.tsx
rm frontend/src/components/pod-dynamics/NemesisList.tsx
```

**Step 2: Remove old interfaces from api.ts**

Remove the `NemesisPair` and `KillStreak` interfaces entirely. Remove `nemesis_pairs` and `top_kill_streaks` from `EliminationStatsData`.

**Step 3: Remove backward compat from backend response**

In `get_elimination_stats`, remove `"nemesis_pairs": []` and `"top_kill_streaks": []` from both the return statement and all early return blocks.

Also remove the old `match_kill_records` list and the old kill streak sorting code if any remains.

**Step 4: Verify everything still works**

```bash
cd frontend && npm run dev
cd backend && uv run uvicorn app.main:app --reload --port 7777
```

Navigate to Combat tab — everything should render cleanly.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old KillStreakHighlights and NemesisList components"
```

---

### Task 10: Visual polish and verify

**Files:**
- Potentially: `frontend/src/components/pod-dynamics/KillLeaderboard.tsx`
- Potentially: `frontend/src/components/pod-dynamics/FirstBlood.tsx`
- Potentially: `frontend/src/components/pod-dynamics/HuntingAsymmetry.tsx`

**Step 1: Visual review in browser**

Open the app and review the Combat tab. Check:
- Archetype badges are readable and not too large
- Kills in losses stat is positioned well
- First Blood section has proper spacing
- Hunting Asymmetry cards are readable on mobile
- All sections have consistent styling with the rest of the app

**Step 2: Fix any visual issues found**

Adjust padding, font sizes, colors as needed based on visual review.

**Step 3: Final commit**

```bash
git add -A
git commit -m "style: polish combat tab redesign"
```
