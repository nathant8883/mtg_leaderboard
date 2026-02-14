# TV Live View Enhancements — Design Document

**Date:** 2026-02-14
**Status:** Approved
**Branch:** feat/tournament-events

## Overview

Three enhancements to the tournament TV live view (`EventLiveView.tsx`) to make the spectator experience richer and more engaging:

1. **Shuffle/re-seed animation on TV** — Show pod formation animations when the tournament starts or advances rounds
2. **Rich pod cards with progressive deck reveal** — Replace flat player name lists with commander artwork, deck names, and color pips that appear as players select decks
3. **Scoring rules panel** — Display the tournament point system in the bottom-left of the TV view

## 1. Backend — Enriched Pod Deck Data

### Model Change

Replace `PodAssignment.player_decks` from `dict[str, str]` (player_id -> deck_name) to `dict[str, PlayerDeckInfo]`:

```python
class PlayerDeckInfo(BaseModel):
    deck_name: str
    commander_image_url: str = ""
    colors: list[str] = Field(default_factory=list)  # ["W", "U", "B", "R", "G"]
```

### New Endpoint

```
POST /api/events/{event_id}/rounds/{round_num}/pods/{pod_index}/set-deck
Body: { player_id: str, deck_id: str }
```

- Looks up the Deck document by `deck_id`
- Writes a `PlayerDeckInfo` entry into `pod.player_decks[player_id]`
- Saves the event
- Called by EventMatchTracker during PlayerAssignment when a player selects a deck

### TypeScript Type Update

```typescript
interface PlayerDeckInfo {
  deck_name: string;
  commander_image_url: string;
  colors: string[];
}

// PodAssignment.player_decks: Record<string, PlayerDeckInfo>
```

### Migration

Old events with string-valued `player_decks` entries: treat as `PlayerDeckInfo(deck_name=value)` or clear old data. Personal project, tournaments are short-lived.

## 2. TV Shuffle & Re-seed Animation

### State Transition Detection

`EventLiveView` tracks previous state via refs:

- `prevStatusRef` and `prevRoundRef` compared on each poll
- `setup -> active` triggers **tournament start animation**
- `prevRound < newRound` triggers **re-seed animation**
- `animationState: 'none' | 'shuffle' | 'reseed'` controls rendering

### Round 1 — Shuffle Animation

Renders in the right column (65% width) where `RoundTimeline` normally sits. Standings remain visible in the left column.

| Phase | Time | Visual |
|-------|------|--------|
| Shuffle | 0–2s | All player tiles in grid, bouncing/shuffling randomly. Large tiles with avatar + name. |
| Forming Pods | 2–3.5s | Tiles slide into pod groupings. Pod containers fade in with purple gradient borders. |
| Pods Assigned | 3.5–5s | Pod containers get glowing borders. Pod labels appear. Brief hold, fade to normal view. |

### Round 2+ — Re-seed Animation

Different animation conveying standings-based re-seeding:

| Phase | Time | Visual |
|-------|------|--------|
| Re-seeding | 0–2s | Tiles start in previous pod positions, slide into single ranked column sorted by points. Point badges visible. Gold/silver/bronze for top 3. |
| Forming New Pods | 2–3.5s | From ranked column, tiles slide into new pod groupings (Pod 1 = top 4, Pod 2 = next 4, etc.). |
| Pods Assigned | 3.5–5s | Same reveal as Round 1 — glow, labels, fade to normal view. |

### Component

New: `TVShuffleAnimation.tsx`
- Props: `event`, `animationType: 'shuffle' | 'reseed'`, `previousStandings?: StandingsEntry[]`, `onComplete: () => void`
- Self-contained phase timing via `useEffect` + `setTimeout`
- CSS keyframes for transforms

## 3. Rich Pod Cards with Progressive Deck Reveal

### Pod Player Card States

**Before deck selected:**
- Placeholder artwork (44x44px) with card-back pattern or `?`
- Player name in white
- "Waiting for deck..." in dim gray italic

**After deck selected (progressive reveal):**
- Commander artwork (44x44px) with color identity border (`deck-color-border-wrapper`)
- Player name in white
- Color pips (existing `ColorPips` component)
- Deck name in gray

**After match completes (winner highlighted):**
- Crown icon + gold text + orange left border accent
- Points badge showing placement + kill total

### Transition Animation

When deck data appears on a poll cycle:
- Commander image fades in (opacity 0->1, ~300ms CSS transition)
- Placeholder disappears
- Deck name and color pips slide in

### Data Flow

1. Player picks deck on phone
2. EventMatchTracker calls `POST /events/{id}/rounds/{round}/pods/{pod}/set-deck`
3. Backend writes `PlayerDeckInfo` to pod
4. TV polls, gets updated data, card re-renders with commander image

### Pod Grid Layout

- 1 pod (4 players): Single column
- 2 pods (8 players): Two-column grid
- 3 pods (12 players): Three-column grid or 2+1

## 4. Scoring Rules Panel

### Layout

Split the left column (35% width):
- **Top ~70%**: Standings table (scrollable via `overflow-y: auto` if needed)
- **Bottom ~30%**: Scoring rules card (pinned)

### Scoring Card Content

Static content, no backend changes:

```
Scoring
  Placement
    1st ··· 3    2nd ··· 2    3rd ··· 1    4th ··· 0
  Bonuses
    Kill ··· +1    Alt Win ··· +4
  Penalties
    Scoop ··· -1
```

### Styling

- Same card background as standings (`rgba(37,38,43,0.5)` with `#2C2E33` border)
- Section labels in dim purple `#667eea`
- Point values right-aligned: green for positive, red for penalties
- Compact text (`text-xs` / `text-sm`)
- Dotted leaders between label and value

### Responsive

- Desktop/TV: Standings top, rules bottom in left column
- Mobile: Rules card stacks below standings in single-column layout

## Polling & Sync

- TV polls every 5 seconds (existing behavior, no changes)
- Animation triggered by client-side state transition detection (no backend flags)
- Max 5s delay between phone action and TV response — acceptable

## Files Summary

| File | Change |
|------|--------|
| `backend/app/models/event.py` | Add `PlayerDeckInfo` model, update `PodAssignment.player_decks` type |
| `backend/app/routers/events.py` | Add `set-deck` endpoint, update `complete_pod_match` for new type |
| `frontend/src/services/api.ts` | Update `PlayerDeckInfo` type, add `setDeck()` API method |
| `frontend/src/pages/EventLiveView.tsx` | Add transition detection, animation state, split left column, rich pod cards, rules panel |
| `frontend/src/components/events/TVShuffleAnimation.tsx` | New component for TV shuffle/re-seed animations |
| `frontend/src/pages/EventMatchTracker.tsx` | Call `set-deck` endpoint during PlayerAssignment |
