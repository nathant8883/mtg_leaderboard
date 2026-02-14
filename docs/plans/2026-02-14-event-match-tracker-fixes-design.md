# Event Match Tracker Fixes — Design Document

**Date:** 2026-02-14
**Status:** Approved
**Branch:** feat/tournament-events

## Problem

The EventMatchTracker has three issues that make the tournament match experience worse than regular matches:

1. **Navigation blocking** — `beforeunload` and `popstate` handlers show "are you sure" popups on page reload and block browser back navigation. Regular matches don't have these restrictions. Since localStorage already persists match state, users should be able to leave and return freely.

2. **Auto-filled player positions** — Players from the event pod are auto-assigned to fixed grid positions (1, 2, 3, 4) based on their array order. This forces players into table positions they may not be physically sitting in, and bypasses the normal player/deck selection flow entirely.

3. **Deck selection skipped** — Because player slots are pre-filled with player data but no deck data, and the assignment screen shows all slots as "filled" with players, the normal deck selection flow is disrupted.

## Design

### Approach: Match Regular Match Behavior with Filtered Players

Make the event match flow identical to the regular match flow, with two differences:
- The available player list is filtered to only event pod members
- Guest creation is disabled (event matches are for registered pod members)

### Navigation Behavior

| Action | Current | New |
|--------|---------|-----|
| Page reload | "Are you sure?" popup | No popup. localStorage restores state. |
| Browser back | Blocked, shows exit modal | Not blocked. User can leave freely. |
| Play button after leaving | Routes back to event match | Same (already works via `mtg_active_event_match` pointer) |
| Explicit Exit button | Shows exit modal | Same. On confirm: clear storage + call `cancelMatch()` to reset pod to pending. |

### Player Assignment Flow

| Step | Current | New |
|------|---------|-----|
| GameSetup | Skipped | Skipped (pod size known, 40 life default) |
| Slot initialization | Pre-filled with pod players | Empty slots (same as regular match) |
| Player selection | N/A (auto-assigned) | Tap slot, pick from pod players only |
| Guest option | N/A | Hidden for event matches |
| Deck selection | Skipped/broken | Normal flow: pick player, then pick deck |
| Position choice | Forced by array order | User chooses which slot to sit in |

### Empty Slot Creation

Follow MatchTracker's pattern for odd player counts (create extra slots so players can choose positions):
- 3 players: 4 slots (2x2 grid)
- 4 players: 4 slots
- 5 players: 6 slots (3x2 grid)
- 6 players: 6 slots

### Files to Modify

1. **`frontend/src/pages/EventMatchTracker.tsx`** — Remove nav blocking `useEffect`, create empty slots, store `podPlayerIds` for filtering, pass new props to PlayerAssignment
2. **`frontend/src/components/match-tracker/PlayerAssignment.tsx`** — Add optional `allowedPlayerIds` and `hideGuestOption` props, filter player list after fetch
3. **`frontend/src/components/match-tracker/smash-select/SmashPlayerSelect.tsx`** — Add optional `hideGuestOption` prop, conditionally hide guest button

### What Stays the Same

- localStorage auto-save (every state change)
- localStorage restore with validation (round/pod status/24h recency)
- `mtg_active_event_match` pointer key for Play button resume
- Match save flow (save match + complete tournament match + update standings)
- Exit button + cancel match behavior
- WinnerScreen alt-win toggle
- All backend endpoints unchanged
