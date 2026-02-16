# Cinematic TV Tournament Animations

## Overview

Replace the current `TVShuffleAnimation` with a cinematic multi-phase animation sequence for the TV Live View. The goal is broadcast/esports-quality transitions that make tournament reseeding and pod assignment feel dramatic and polished on a big screen.

## Animation Library: Framer Motion

- `layoutId` for FLIP-style spatial transitions (rank shift, fly-to-pods)
- `AnimatePresence` for phase enter/exit with crossfade
- `spring` config with tuned `stiffness`/`damping` for overshoot-and-settle feel
- `staggerChildren` for orchestrated reveals
- `useMotionValue` + `useTransform` for point counter tick-up

Framer Motion is only imported in the TV cinematic component (code-split naturally since EventLiveView is a separate route).

## Sequence A: Opening Ceremony (tournament start)

No standings exist yet, so this is a shorter sequence focused on spectacle and pod reveal.

### Phase 1: Intro (~2s)

- Event name + player count animate in with spring scale+opacity
- Scan line sweeps across screen via CSS keyframe overlay
- Round progress dots appear at top-right (Round 1 glows purple)

### Phase 2: Player Roll Call (~3s)

- Player avatar tiles fly in from random off-screen edges with staggered delays
- Each tile lands in a scattered grid formation
- Brief glow pulse on arrival, name appears beneath
- Framer Motion: `variants` with `staggerChildren: 0.15`, spring transition

### Phase 3: Seeding Interstitial (~2.5s)

- Full-screen "SEEDING PODS" text slams in with purple gradient
- Player avatar dots orbit in a spinning circle formation
- Scan line glitch sweep top-to-bottom for broadcast feel
- `AnimatePresence` for phase transition, CSS `@keyframes` for orbit + scan line

### Phase 4: Fly to Pods (~2.5s)

- Pod frames appear as empty containers on screen
- Player tiles animate from their scattered grid positions into assigned pods
- Uses `layoutId={playerId}` on player tiles — Framer Motion auto-calculates FLIP
- Pods get a border glow as each player arrives
- For draft 1v1 matches: "VS" badge appears between the two players

### Phase 5: Settled (~1s)

- Pulsing green "Round 1 Ready" indicator fades in
- Round progress dots update (Round 1 = purple glow)
- Auto-dismisses after brief hold, calls `onComplete`

## Sequence B: Reseed (round advance)

Full 5-phase sequence with rank-shift drama. Triggered when round advances and new pods are assigned.

### Phase 1: Round Complete (~2s)

- "Round N Complete" banner with green checkmark
- Brief hold showing final round results so spectators register what happened
- `AnimatePresence` enter animation

### Phase 2: Rank Shift (~3s)

- Player rows physically slide up/down to new rank positions
- Reorder the standings list — `layoutId` on each player row auto-animates position changes
- Point totals tick up during flight using `useMotionValue`
- Directional arrows (up/down indicators) fade in as players settle into new positions
- Player who moved the most ranks gets a highlight burst effect

### Phase 3: Reseed Interstitial (~2.5s)

- "RESEEDING" text with spinning gear/shuffle icon
- All player avatar dots orbit in a circle (each using player's avatar color or hash-derived accent)
- Scan line sweep for broadcast glitch feel
- Purple neon gradient background
- Pure drama — builds anticipation for new matchups

### Phase 4: Fly to Pods (~2.5s)

- Players fly from their ranked-list positions into new pod groups
- `layoutId` handles FLIP from ranked list to pod containers automatically
- Seed number badges displayed on each player
- Pod containers spring-scale in as they receive players
- Draft mode: "VS" between 1v1 pairs with seed matchup info

### Phase 5: Settled (~1s)

- Pulsing green "Round N Ready" indicator
- Round progress dots update — completed rounds fill green, current round glows purple
- Auto-dismisses after brief hold

## Visual Effects (CSS-only, decorative)

These are overlay effects that don't need FLIP transitions:

- **Scan line sweep**: `translateY` animation on a semi-transparent gradient bar
- **Orbit ring**: CSS `rotate` on a container with absolutely-positioned avatar dots
- **Glow pulse**: `box-shadow` animation on pod containers as players arrive
- **Glitch effect**: Brief `clip-path` + color channel shift on interstitial text
- **Point ticker**: Numbers counting up during rank-shift phase

## Architecture

- **New file**: `frontend/src/components/events/TVCinematicAnimation.tsx`
  - Replaces `TVShuffleAnimation` in `EventLiveView.tsx`
  - Receives same props: `event`, `animationType`, `previousStandings`, `onComplete`
- **Unchanged**: `ShuffleAnimation.tsx` stays as-is for mobile dashboard view
- **New dependency**: `framer-motion` added to frontend package.json
- **Integration**: `EventLiveView.tsx` imports new component where it currently imports `TVShuffleAnimation`

## Round Progress Indicator

Small dot strip shown in top-right corner during animations:
- Dim dot = upcoming round
- Purple glow = current round
- Green filled = completed round
- Updates during the "settled" phase of each sequence

## Timing Summary

| Sequence | Total Duration | Phases |
|----------|---------------|--------|
| Opening Ceremony | ~11s | Intro → Roll Call → Seeding → Fly to Pods → Settled |
| Reseed | ~11s | Round Complete → Rank Shift → Reseed → Fly to Pods → Settled |

## Design Decisions

- **Framer Motion over CSS-only**: FLIP transitions require DOM measurement + interpolation. Framer Motion's `layoutId` handles this automatically. Spring physics provide the broadcast-quality overshoot-and-settle feel that CSS `cubic-bezier` can only approximate.
- **Separate component vs. refactoring existing**: New `TVCinematicAnimation` rather than modifying `TVShuffleAnimation`. Cleaner separation, and the old component can serve as fallback reference.
- **TV-only**: Mobile dashboard keeps `ShuffleAnimation.tsx` unchanged. The cinematic sequence is designed for landscape big screens and would feel slow on a phone.
