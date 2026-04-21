# Borrowed Deck Stats Count Fully — Design

**Date:** 2026-04-21
**Status:** Approved

## Problem

The existing deck-borrowing feature (2026-02-28) excludes borrowed games from all stat calculations for both the borrower and the lender's deck. We want the opposite: borrowed games should count as normal wins/losses for the borrower (player stats, Elo, pod dynamics) and the deck (deck leaderboard), while the UI continues to show the "Borrowed from {owner}" indicator as historical context.

## Design

### Scope

Pure backend stat-guard removal. No data model changes, no UI changes, no frontend changes, no migration.

### What stays unchanged

- `MatchPlayer.borrowed_from_player_id` / `borrowed_from_player_name` — still persisted so the UI can render the badge.
- `BorrowDeckSelect` flow, "Borrow Deck" tile in `SmashDeckSelect`, in-game badge in `ActiveGame`, "Borrowed from X" line in `RecentMatches`.
- Match creation payload (`borrowed_from_player_id` still accepted and stored denormalized alongside `borrowed_from_player_name`).

### What changes — remove exclusion guards

Four backend files carry the guards. All need the `borrowed_from_player_id` checks stripped so borrowed entries flow through the same code path as regular ones. One utility file becomes unreferenced and gets deleted.

| File | Change |
|---|---|
| `backend/app/routers/leaderboard.py` | Remove guards at lines 68, 71, 173, 176, 269, 293, 391. Drop the `from app.utils.match_helpers import ...` line. |
| `backend/app/routers/players.py` | Delete local `_player_borrowed_in_match` / `_deck_borrowed_in_match` helpers (lines 15–31) and their call sites at 149, 150, 158, 159, 177, 178. |
| `backend/app/services/elo_service.py` | Delete local `_player_borrowed_in_match` (22–27). Remove `if mp.borrowed_from_player_id: continue` at 66. Remove the winner-borrow guard at 73. |
| `backend/app/routers/pod_dynamics.py` | Remove borrower guards at 1144, 1164, 1184, 1192, 1199, 1209. |
| `backend/app/utils/match_helpers.py` | Delete file (unreferenced after the leaderboard import is dropped). |

### Resulting stat semantics

- **Player leaderboard, Elo, player-detail totals:** Nathan borrows Joe's Atraxa and wins → Nathan +1W, +1 game played, Elo bump.
- **Deck leaderboard:** Atraxa +1W, +1 game regardless of pilot.
- **Pod dynamics:** Borrower's kills, deaths, scoops, placements, and kill-pairs count like any other game.
- **Player detail per-deck breakdown:** Unchanged — still only shows decks the player *owns*. A borrowed win contributes to total W/L but does not appear under an owned-deck row (Nathan doesn't own Atraxa, so it stays absent from his breakdown). Acceptable; no scope change.

### No migration required

Existing matches already carry `borrowed_from_player_id`. Removing the guards means those entries start counting automatically on next request. Approved that this applies retroactively — no flag, no backfill, no cutoff date.

## What's NOT Changing

- Data model (no schema changes)
- Frontend components (borrow flow, badges, display text)
- Match creation endpoint (still accepts and stores the field)
- Per-deck breakdown on player detail (borrowed decks remain absent since the player doesn't own them)

## Files Affected

| Layer | Files |
|-------|-------|
| Leaderboard endpoints | `backend/app/routers/leaderboard.py` |
| Player detail | `backend/app/routers/players.py` |
| Elo service | `backend/app/services/elo_service.py` |
| Pod dynamics | `backend/app/routers/pod_dynamics.py` |
| Deleted | `backend/app/utils/match_helpers.py` |
