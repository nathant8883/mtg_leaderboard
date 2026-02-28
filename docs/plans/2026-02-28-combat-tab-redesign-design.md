# Combat Tab Redesign — Kill Stats & Rivalries

**Date:** 2026-02-28
**Status:** Approved

## Problem

The Combat tab's Kill Streaks and Rivalries sections are not providing meaningful insights:

1. **Kill Streaks** are a proxy for wins — the winner typically eliminates all opponents, so "kill streaks" just show games someone won.
2. **Rivalries** are meaningless at scale — with 8 players and ~120 games, nearly every pair exceeds the 2-kill threshold, so every relationship looks like a "rivalry."

Both stats are heavily correlated with winning and don't reveal anything the leaderboard doesn't already show.

## Design

### Section Layout (5 sections)

1. Combat Overview Cards (unchanged)
2. Kill Leaderboard (enhanced)
3. First Blood (new, replaces Kill Streaks)
4. Hunting Asymmetry (new, replaces Rivalries)
5. Scoop Shame (unchanged)

---

### 1. Combat Overview Cards — No Changes

- Pod Kills | Pod Scoops | Kills/Game
- These aggregate stats are fine as-is.

---

### 2. Kill Leaderboard — Enhanced

**Changes:**
- Add a **combat archetype badge** next to each player's name
- Add **"Kills in Losses"** stat alongside total kills

**Combat Archetypes (6 types):**

| Archetype | Criteria | Meaning |
|-----------|----------|---------|
| Assassin | Highest kill rate in games they *lost* | Dangerous even when losing |
| Kingmaker | High kill count but below-average win rate | Shapes games for others to win |
| Berserker | Gets first blood most often | Aggressive early, sets the pace |
| Target | First eliminated most often | Table perceives them as biggest threat |
| Survivor | Best avg placement with low kill count | Outlasts everyone without fighting |
| Table Flipper | Highest scoop rate | Flips the table when things go south |

**Archetype Assignment Algorithm:**
- Calculate each player's percentile rank in each category relative to the pod
- Assign the archetype where the player scores highest
- Each player gets exactly one archetype

**Kills in Losses:**
- `kills_in_losses` = total kills in games where the player did NOT win
- Decouples kill stats from win stats — a high number here means genuinely dangerous

---

### 3. First Blood — Replaces Kill Streaks

**What it measures:** Who draws first blood (gets the first kill elimination) most often.

**Calculation:**
- In each game, find the first player eliminated via kill (highest `elimination_order` with `elimination_type: "kill"`)
- Credit `eliminated_by_player_id` with a "first blood"
- Only count kills, not scoops

**Display (ranked list):**
- Player avatar + name
- First blood count (e.g., "12 First Bloods")
- First blood rate (% of their games where they drew first blood)
- Conversion rate (when they get first blood, how often they win)

**Why this is better:** Measures *aggression* as a playstyle trait, independent of winning. Conversion rate adds narrative — "gets first blood 40% of the time but only converts 25%."

---

### 4. Hunting Asymmetry — Replaces Rivalries

**What it measures:** One-sided kill relationships between player pairs.

**Calculation:**
- For each pair (A, B), compute kills in both directions: A→B and B→A
- Compute kill ratio (higher / lower)
- Filter: only show pairs with **2:1+ ratio asymmetry** AND **5+ games together**
- Sort by ratio descending

**Display (directional cards):**
- Hunter avatar (left) → ratio badge → Prey avatar (right)
- Raw kill counts: "8 kills vs 2 kills"
- Kill ratio: "4:1"
- Games together count
- Fun labels at extreme ratios:
  - 3:1+ = "Nemesis"
  - 5:1+ = "Arch-Nemesis"

**Why this is better:** "A killed B 8 times" is noise. "A hunts B at 4:1 across 15 games" reveals a genuine asymmetric dynamic the table can banter about.

---

### 5. Scoop Shame — No Changes

- Working well as-is, not a pain point.

---

## What Gets Removed

- **Kill Streaks** section (replaced by First Blood)
- **Current Rivalries/Nemesis Pairs** section (replaced by Hunting Asymmetry)

## Backend Changes

The `/api/pod-dynamics/elimination-stats` endpoint needs to be updated to:
- Calculate and return combat archetypes per player
- Calculate and return kills_in_losses per player
- Calculate and return first blood stats (count, rate, conversion rate)
- Replace nemesis_pairs with asymmetric hunting pairs (directional ratios, filtered by 2:1+ asymmetry and 5+ games together)
- Remove kill streak data from response (or keep for backward compatibility)

## Frontend Changes

- **KillLeaderboard.tsx** — Add archetype badge and kills-in-losses display
- **KillStreakHighlights.tsx** — Replace entirely with new FirstBlood component
- **NemesisList.tsx** — Replace entirely with new HuntingAsymmetry component
- **CombatTab.tsx** — Update to use new components
- **api.ts** — Update TypeScript interfaces for new response shape
