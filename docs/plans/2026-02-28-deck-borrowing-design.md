# Deck Borrowing — Design

**Date:** 2026-02-28
**Status:** Approved

## Problem

Players sometimes want to try a friend's deck during a casual game. Currently there's no way to record this — you either pick your own deck or don't track the game. We want to let players borrow a pod-mate's deck, show it clearly in match history, and exclude the borrower from stats so borrowed games don't distort leaderboards.

## Design

### Data Model

**`MatchPlayer` (backend model)** — one new field:
```python
borrowed_from_player_id: Optional[str] = None
```
If set, this player was using a deck owned by another player. Existing matches default to `None` (backward compatible).

**`PlayerSlot` (frontend)** — two new fields:
```typescript
borrowedFromPlayerId: string | null;
borrowedFromPlayerName: string | null;
```

**`CreateMatchRequest`** — `player_deck_pairs` entries accept an optional `borrowed_from_player_id` key.

**`serialize_match`** — includes `borrowed_from_player_id` and `borrowed_from_player_name` in the player output.

---

### UI Flow (Live Tracker Only)

**Entry point:** A "Borrow Deck" tile in `SmashDeckSelect`, alongside existing deck tiles and the "+ Quick Add" tile. Same visual style with a distinct swap/handshake icon.

**Borrow screen:** Full-screen overlay (same `smash-slide-in` pattern) showing:
- Header: "Borrow a Deck" with back button
- All other pod members' non-disabled decks, grouped by owner (player name + avatar as group header)
- Uses existing `DeckTile` component for commander art
- Already-assigned decks in this game are grayed out

**On selection:** Populates the `PlayerSlot` with the borrowed deck's info plus `borrowedFromPlayerId` and `borrowedFromPlayerName`.

**In-game indicator:** Small "Borrowed" badge on the player card in `ActiveGame`.

**Not available in:** MatchForm (simple form), EventMatchTracker (tournaments).

---

### Stat Exclusion

**Rule:** When a `MatchPlayer` has `borrowed_from_player_id` set, that player is skipped in all stat calculations. Other players in the same match count normally.

**Affected endpoints (5):**

1. **`/api/leaderboard/players`** — Skip borrower in wins, losses, games_played.
2. **`/api/leaderboard/decks`** — Skip borrowed deck entry (no credit for borrower or owner).
3. **`/api/leaderboard/players/{id}/detail`** — Skip borrowed game from deck breakdown.
4. **`process_match_elo`** — Skip borrower from Elo calculations. Other players adjust normally among themselves.
5. **`/api/pod-dynamics/elimination-stats`** — Skip borrower's kills, deaths, scoops, placement, kill pairs.

**Implementation pattern:** Guard at the top of per-player loops:
```python
for mp in match.players:
    if mp.borrowed_from_player_id:
        continue
```
Plus guards on `winner_player_id` / `winner_deck_id` fast-path checks.

---

### Display — Match History

**Recent Matches:** Borrowed deck entries show "Borrowed from {ownerName}" below the deck name.

**Match Detail:** Same borrowed indicator on the player entry.

**Offline queue:** `borrowed_from_player_id` included in offline match data so it persists through sync.

---

## What's NOT Changing

- MatchForm (simple form) — no borrow support
- EventMatchTracker — no borrow in tournaments
- Existing matches — backward compatible, `None` by default
- Deck ownership — borrowing doesn't create any new deck records

## Files Affected

| Layer | Files |
|-------|-------|
| Backend model | `backend/app/models/match.py` |
| Match creation | `backend/app/routers/matches.py` |
| Leaderboard stats | `backend/app/routers/leaderboard.py` |
| Elo processing | `backend/app/services/elo.py` (or wherever `process_match_elo` lives) |
| Pod dynamics | `backend/app/routers/pod_dynamics.py` |
| Frontend types | `frontend/src/services/api.ts` |
| Deck select | `frontend/src/components/match-tracker/smash-select/SmashDeckSelect.tsx` |
| New component | `frontend/src/components/match-tracker/smash-select/BorrowDeckSelect.tsx` |
| Player slot | `frontend/src/pages/MatchTracker.tsx` |
| Active game | `frontend/src/components/match-tracker/ActiveGame.tsx` |
| Match save | `frontend/src/pages/MatchTracker.tsx` (handleMatchSave) |
| Recent matches | `frontend/src/components/RecentMatches.tsx` |
| Offline queue | `frontend/src/services/offlineQueue.ts` |
