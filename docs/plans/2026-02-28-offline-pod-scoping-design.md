# Offline Mode Pod Scoping — Design Document

**Date:** 2026-02-28
**Status:** Approved

## Problem

When a logged-in user goes offline or has no pod set, the backend returns all non-guest players/decks as a fallback. The service worker caches this unscoped response. When the user launches a game offline, they see players from pods they don't belong to.

## Solution: Defense in Depth (3 Layers)

### Layer 1: Backend — Eliminate Unscoped Fallbacks

**Files:** `backend/app/routers/players.py`, `backend/app/routers/decks.py`

Change the fallback behavior in `get_all_players()` and `get_all_decks()`:

- **No auth (unauthenticated):** Return empty list `[]`
- **Auth but no `current_pod_id`:** Return empty list `[]`
- **Auth with pod, but pod not found:** Return empty list `[]`, log a warning
- **Superuser:** Unchanged — sees all non-guest players/decks (intentional admin behavior)

### Layer 2: Client-Side Pod Membership Filter

**Files:** `frontend/src/contexts/PodContext.tsx`, `frontend/src/pages/MatchTracker.tsx`, `frontend/src/components/match-tracker/PlayerAssignment.tsx`

- Cache `currentPod.member_ids` in localStorage key `mtg_current_pod_member_ids` when pod loads
- After `playerApi.getAll()` returns in MatchTracker and PlayerAssignment, filter results through cached member IDs
- Skip filter in guest mode (guest mode creates throwaway players)

### Layer 3: Service Worker Cache Invalidation on Pod Switch

**File:** `frontend/src/contexts/PodContext.tsx`

- In `switchPod()`, after backend call succeeds and before dispatching `podSwitched` event, delete `api-players-cache` and `api-decks-cache` via Cache API
- Fresh fetches triggered by `podSwitched` event repopulate cache with correctly-scoped data

## Post-Fix Behavior

| Scenario | Before | After |
|----------|--------|-------|
| Logged in, offline | All app players shown | Only pod members shown |
| Quick Play (guest) | Guest-only players | No change — already isolated |
| Pod switch | Stale pod data in cache | Cache cleared, fresh fetch |
| No pod set | All players shown | Empty list (must select pod) |
| Superuser | All players | No change |
