# Borrowed Deck Stats Count Fully — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the backend stat-exclusion guards so borrowed-deck matches count as normal wins/losses for the borrower (player stats, Elo, pod dynamics) and for the deck (deck leaderboard). UI, data model, and match creation stay unchanged.

**Architecture:** Pure deletion. Each of four backend files currently branches on `borrowed_from_player_id` to skip borrowed rows during aggregation. Strip those branches so borrowed rows flow through the same code path as regular ones. The `match_helpers.py` utility becomes unreferenced and gets deleted. The `borrowed_from_player_id` / `borrowed_from_player_name` fields on `MatchPlayer` stay — the UI still reads them for the "Borrowed from X" badge.

**Tech Stack:** FastAPI (Python 3.13), Beanie ODM, MongoDB. Backend runs via `uv run uvicorn app.main:app --reload --port 7777`.

**Design doc:** `docs/plans/2026-04-21-borrowed-deck-stats-design.md`

**Heads-up on pre-existing state:** The uncommitted `backend/app/routers/leaderboard.py` has a broken partial refactor — it imports `player_borrowed_in_match` / `deck_borrowed_in_match` from `match_helpers` but call sites still use the underscore-prefixed local names. This plan deletes the import and all call sites together, so the inconsistency resolves itself. Do not "fix" the naming mismatch separately.

**No test suite exists for these modules.** Verification per task is: backend reloads cleanly (uvicorn `--reload` is already running), imports resolve, no `NameError` at request time. End-to-end verification is a single manual task at the end.

---

### Task 1: Remove borrow guards from `elo_service.py`

**Files:**
- Modify: `backend/app/services/elo_service.py`

**Step 1: Delete the local helper (lines 22–27)**

Find and delete this block:

```python
def _player_borrowed_in_match(match, player_id):
    """Check if a player was borrowing a deck in a given match."""
    for p in match.players:
        if p.player_id == player_id and p.borrowed_from_player_id:
            return True
    return False
```

**Step 2: Remove the `continue` guard inside `process_match_elo`**

Replace this (around line 64–69):

```python
    # Get current Elo for all players in the match
    player_elos = []
    for mp in match.players:
        if mp.borrowed_from_player_id:
            continue  # Borrowed deck players don't affect Elo
        rating = await get_or_create_player_elo(mp.player_id, match.pod_id)
        player_elos.append((mp.player_id, rating.current_elo))
```

With:

```python
    # Get current Elo for all players in the match
    player_elos = []
    for mp in match.players:
        rating = await get_or_create_player_elo(mp.player_id, match.pod_id)
        player_elos.append((mp.player_id, rating.current_elo))
```

**Step 3: Remove the winner-borrow guard**

Replace this (around lines 71–74):

```python
    # If the winner was borrowing, they're excluded - no Elo changes
    actual_winner = match.winner_player_id
    if _player_borrowed_in_match(match, actual_winner):
        actual_winner = None

    # Calculate Elo changes
    changes = calculate_multiplayer_elo_changes(player_elos, actual_winner)
```

With:

```python
    # Calculate Elo changes
    changes = calculate_multiplayer_elo_changes(player_elos, match.winner_player_id)
```

**Step 4: Verify**

Run: `uv run python -c "from app.services import elo_service; print(elo_service.process_match_elo)"` from the `backend/` directory.

Expected: Prints the function object with no `NameError` / `ImportError`.

**Step 5: Commit**

```bash
git add backend/app/services/elo_service.py
git commit -m "refactor: remove borrowed-deck Elo exclusion"
```

---

### Task 2: Remove borrow guards from `pod_dynamics.py`

**Files:**
- Modify: `backend/app/routers/pod_dynamics.py`

The file has six guard sites in the elimination-stats endpoint. Strip each one. There is no helper to delete — guards are inline.

**Step 1: Remove the combat-loop skip (around lines 1143–1145)**

Replace:

```python
        for p in match.players:
            if p.borrowed_from_player_id:
                continue  # Skip borrowed deck players from combat stats

            player_id = p.player_id
```

With:

```python
        for p in match.players:
            player_id = p.player_id
```

**Step 2: Remove the killer-borrow check inside kill credit (around lines 1161–1170)**

Replace:

```python
                # Credit the killer (skip if killer is a borrowed deck player)
                if p.eliminated_by_player_id:
                    killer_id = p.eliminated_by_player_id
                    killer_is_borrowed = any(
                        mp.player_id == killer_id and mp.borrowed_from_player_id
                        for mp in match.players
                    )
                    if not killer_is_borrowed:
                        player_stats[killer_id]["total_kills"] += 1
                        kill_pairs[(killer_id, player_id)] += 1
                        match_kills_by_player[killer_id].append(p.player_name)
```

With:

```python
                # Credit the killer
                if p.eliminated_by_player_id:
                    killer_id = p.eliminated_by_player_id
                    player_stats[killer_id]["total_kills"] += 1
                    kill_pairs[(killer_id, player_id)] += 1
                    match_kills_by_player[killer_id].append(p.player_name)
```

**Step 3: Remove the winner-borrow guard (around lines 1183–1186)**

Replace:

```python
        # --- NEW: Determine winner for this match (used by multiple sections below) ---
        winner = next((p for p in match.players if p.is_winner), None)
        if winner and winner.borrowed_from_player_id:
            winner = None
        winner_id = winner.player_id if winner else None
```

With:

```python
        # --- NEW: Determine winner for this match (used by multiple sections below) ---
        winner = next((p for p in match.players if p.is_winner), None)
        winner_id = winner.player_id if winner else None
```

**Step 4: Remove the first-blood kill-elimination filter (around lines 1189–1203)**

Replace:

```python
        # --- NEW: First blood detection ---
        kill_eliminations = [
            p for p in match.players
            if p.elimination_type == "kill" and p.elimination_order is not None and p.elimination_order > 1
            and not p.borrowed_from_player_id
        ]
        if kill_eliminations:
            first_eliminated_player = max(kill_eliminations, key=lambda p: p.elimination_order)
            if first_eliminated_player.eliminated_by_player_id:
                killer_id = first_eliminated_player.eliminated_by_player_id
                killer_is_borrowed = any(
                    mp.player_id == killer_id and mp.borrowed_from_player_id
                    for mp in match.players
                )
                if not killer_is_borrowed:
                    first_blood_counts[killer_id] += 1
```

With:

```python
        # --- NEW: First blood detection ---
        kill_eliminations = [
            p for p in match.players
            if p.elimination_type == "kill" and p.elimination_order is not None and p.elimination_order > 1
        ]
        if kill_eliminations:
            first_eliminated_player = max(kill_eliminations, key=lambda p: p.elimination_order)
            if first_eliminated_player.eliminated_by_player_id:
                killer_id = first_eliminated_player.eliminated_by_player_id
                first_blood_counts[killer_id] += 1
```

**Step 5: Remove the first-eliminated filter (around lines 1206–1210)**

Replace:

```python
        # --- NEW: First eliminated tracking ---
        players_with_order = [
            p for p in match.players
            if p.elimination_order is not None and p.elimination_order > 1
            and not p.borrowed_from_player_id
        ]
```

With:

```python
        # --- NEW: First eliminated tracking ---
        players_with_order = [
            p for p in match.players
            if p.elimination_order is not None and p.elimination_order > 1
        ]
```

**Step 6: Verify no guards remain in this file**

Run from repo root: `grep -n "borrowed_from_player_id" backend/app/routers/pod_dynamics.py`

Expected: no output. If any line still matches, inspect and remove it.

**Step 7: Confirm module imports**

Run from `backend/`: `uv run python -c "from app.routers import pod_dynamics; print(pod_dynamics.router)"`

Expected: Prints the APIRouter object, no errors.

**Step 8: Commit**

```bash
git add backend/app/routers/pod_dynamics.py
git commit -m "refactor: remove borrowed-deck pod dynamics exclusion"
```

---

### Task 3: Remove borrow guards from `players.py`

**Files:**
- Modify: `backend/app/routers/players.py`

**Step 1: Delete both local helpers (lines 15–28)**

Remove this block entirely:

```python
def _player_borrowed_in_match(match, player_id: str) -> bool:
    """Check if a player was borrowing a deck in a given match."""
    for p in match.players:
        if p.player_id == player_id and p.borrowed_from_player_id:
            return True
    return False


def _deck_borrowed_in_match(match, deck_id: str) -> bool:
    """Check if a deck was being borrowed in a match."""
    for p in match.players:
        if p.deck_id == deck_id and p.borrowed_from_player_id:
            return True
    return False
```

Leave the surrounding imports/`router = APIRouter()` intact.

**Step 2: Strip guards from player-detail stats (lines 149–150)**

Replace:

```python
    games_played = sum(1 for match in all_matches if any(p.player_id == player_id_str and not p.borrowed_from_player_id for p in match.players))
    wins = sum(1 for match in all_matches if match.winner_player_id == player_id_str and not _player_borrowed_in_match(match, player_id_str))
```

With:

```python
    games_played = sum(1 for match in all_matches if any(p.player_id == player_id_str for p in match.players))
    wins = sum(1 for match in all_matches if match.winner_player_id == player_id_str)
```

**Step 3: Strip guards from rank-calculation loop (lines 158–159)**

Replace:

```python
        p_games = sum(1 for match in all_matches if any(mp.player_id == p_id and not mp.borrowed_from_player_id for mp in match.players))
        p_wins = sum(1 for match in all_matches if match.winner_player_id == p_id and not _player_borrowed_in_match(match, p_id))
```

With:

```python
        p_games = sum(1 for match in all_matches if any(mp.player_id == p_id for mp in match.players))
        p_wins = sum(1 for match in all_matches if match.winner_player_id == p_id)
```

**Step 4: Strip guards from per-deck breakdown (lines 177–178)**

Replace:

```python
        deck_games = sum(1 for match in all_matches if any(p.deck_id == deck_id and not p.borrowed_from_player_id for p in match.players))
        deck_wins = sum(1 for match in all_matches if match.winner_deck_id == deck_id and not _deck_borrowed_in_match(match, deck_id))
```

With:

```python
        deck_games = sum(1 for match in all_matches if any(p.deck_id == deck_id for p in match.players))
        deck_wins = sum(1 for match in all_matches if match.winner_deck_id == deck_id)
```

**Step 5: Verify no guards remain**

Run: `grep -n "borrowed_from_player_id\|_player_borrowed_in_match\|_deck_borrowed_in_match" backend/app/routers/players.py`

Expected: no output.

**Step 6: Confirm module imports**

Run from `backend/`: `uv run python -c "from app.routers import players; print(players.router)"`

Expected: APIRouter object printed.

**Step 7: Commit**

```bash
git add backend/app/routers/players.py
git commit -m "refactor: remove borrowed-deck player detail exclusion"
```

---

### Task 4: Remove borrow guards from `leaderboard.py`

**Files:**
- Modify: `backend/app/routers/leaderboard.py`

This file has seven guard sites plus a now-unused import. Handle them in one task.

**Step 1: Drop the `match_helpers` import (line 13)**

Delete this line from the import block:

```python
from app.utils.match_helpers import player_borrowed_in_match, deck_borrowed_in_match
```

**Step 2: Strip guards in player leaderboard (lines 68, 71)**

Replace:

```python
        games_played = sum(1 for match in matches if any(p.player_id == player_id and not p.borrowed_from_player_id for p in match.players))

        # Count wins
        wins = sum(1 for match in matches if match.winner_player_id == player_id and not _player_borrowed_in_match(match, player_id))
```

With:

```python
        games_played = sum(1 for match in matches if any(p.player_id == player_id for p in match.players))

        # Count wins
        wins = sum(1 for match in matches if match.winner_player_id == player_id)
```

**Step 3: Strip guards in deck leaderboard (lines 173, 176)**

Replace:

```python
        games_played = sum(1 for match in matches if any(p.deck_id == deck_id and not p.borrowed_from_player_id for p in match.players))

        # Count wins
        wins = sum(1 for match in matches if match.winner_deck_id == deck_id and not _deck_borrowed_in_match(match, deck_id))
```

With:

```python
        games_played = sum(1 for match in matches if any(p.deck_id == deck_id for p in match.players))

        # Count wins
        wins = sum(1 for match in matches if match.winner_deck_id == deck_id)
```

**Step 4: Strip guard in most-games-player stat (line 269)**

Replace:

```python
            games_played = sum(1 for match in matches if any(p.player_id == player_id and not p.borrowed_from_player_id for p in match.players))
```

With:

```python
            games_played = sum(1 for match in matches if any(p.player_id == player_id for p in match.players))
```

**Step 5: Strip guard in most-played-deck stat (line 293)**

Replace:

```python
            games_played = sum(1 for match in matches if any(p.deck_id == deck_id and not p.borrowed_from_player_id for p in match.players))
```

With:

```python
            games_played = sum(1 for match in matches if any(p.deck_id == deck_id for p in match.players))
```

**Step 6: Strip guard in pod-balance win counter (lines 389–392)**

Replace:

```python
        win_counts = Counter(
            match.winner_player_id for match in recent_matches
            if not _player_borrowed_in_match(match, match.winner_player_id)
        )
```

With:

```python
        win_counts = Counter(match.winner_player_id for match in recent_matches)
```

**Step 7: Verify no guards remain**

Run: `grep -n "borrowed_from_player_id\|_player_borrowed_in_match\|_deck_borrowed_in_match\|match_helpers" backend/app/routers/leaderboard.py`

Expected: no output.

**Step 8: Confirm module imports**

Run from `backend/`: `uv run python -c "from app.routers import leaderboard; print(leaderboard.router)"`

Expected: APIRouter object printed, no `ImportError`.

**Step 9: Commit**

```bash
git add backend/app/routers/leaderboard.py
git commit -m "refactor: remove borrowed-deck leaderboard exclusion"
```

---

### Task 5: Delete the now-unused `match_helpers.py`

**Files:**
- Delete: `backend/app/utils/match_helpers.py`

**Step 1: Confirm zero remaining references in the backend**

Run from repo root: `grep -rn "match_helpers\|player_borrowed_in_match\|deck_borrowed_in_match" backend/`

Expected: only matches inside `backend/app/utils/match_helpers.py` itself. If anything else shows up, stop and inspect — a previous task missed a call site.

**Step 2: Delete the file**

```bash
git rm backend/app/utils/match_helpers.py
```

**Step 3: Confirm backend imports cleanly**

Run from `backend/`: `uv run python -c "from app.main import app; print(app)"`

Expected: FastAPI app object printed.

**Step 4: Commit**

```bash
git commit -m "refactor: delete unused match_helpers utility"
```

---

### Task 6: End-to-end manual verification

No automated tests exist for these modules, so verify in the running app.

**Prerequisites:**
- Backend running on `:7777` (should auto-reload on each task's edits)
- Frontend running on `:5173`
- You are logged in as a user who is a member of a pod with at least 2 other members, each of whom owns at least one deck.

**Step 1: Capture baseline stats**

Before creating a test match, open the frontend and note:
- Your current win count and games-played on the **player leaderboard**
- Your current Elo (if visible)
- A pod-mate's deck's W/L on the **deck leaderboard** (this is the deck you'll borrow)

Write the numbers down.

**Step 2: Record a match where you borrow a pod-mate's deck and win**

1. Start the Match Tracker (smash flow).
2. For your own slot, tap the "Borrow Deck" tile and pick a deck owned by another pod member.
3. Fill out the rest of the pod with real players + their own decks (need ≥3 players total to satisfy match validation).
4. Play through to the end, mark yourself the winner, save the match.

**Step 3: Verify all five stat endpoints updated**

Re-check each of the following and confirm they changed compared to baseline:

- **Player leaderboard (`/api/leaderboard/players`)** — your games-played +1, wins +1.
- **Deck leaderboard (`/api/leaderboard/decks`)** — the borrowed deck's games-played +1, wins +1.
- **Player detail (`/api/leaderboard/players/{your_id}/detail`)** — your total games/wins reflect the match. The borrowed deck does **not** appear in your per-deck breakdown (expected — you don't own it).
- **Pod dynamics (`/api/pod-dynamics/elimination-stats`)** — any kills, placements, or pair stats from your game are attributed to you.
- **Elo** — your rating moved. If the rising-star widget surfaces, it should consider you eligible.

**Step 4: Verify UI indicator still renders**

- In **Recent Matches**, the row for this match shows "Borrowed from {owner's name}" under the deck name.
- If you replay the game view, the "Borrowed" badge renders on the relevant player card.

**Step 5: Spot-check an older borrowed match (retroactive behavior)**

If any borrowed matches existed before this change, confirm one of those players now appears in `/api/leaderboard/players` with the old borrowed games counted. Design-approved that this applies retroactively — no action if numbers look plausible.

**Step 6: Commit (no-op, just closes the loop)**

Nothing to commit. If anything failed verification, halt and diagnose — do not paper over with new guards.

---

## Summary of commits produced

1. `refactor: remove borrowed-deck Elo exclusion`
2. `refactor: remove borrowed-deck pod dynamics exclusion`
3. `refactor: remove borrowed-deck player detail exclusion`
4. `refactor: remove borrowed-deck leaderboard exclusion`
5. `refactor: delete unused match_helpers utility`

After Task 4, the partial-refactor inconsistency in `leaderboard.py` (imported `player_borrowed_in_match` vs. called `_player_borrowed_in_match`) is resolved as a side effect of deleting both.
