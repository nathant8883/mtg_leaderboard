# Cinematic TV Tournament Animations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the basic `TVShuffleAnimation` with a cinematic multi-phase broadcast-quality animation for the TV Live View, using Framer Motion for FLIP transitions and spring physics.

**Architecture:** New `TVCinematicAnimation.tsx` component replaces `TVShuffleAnimation` in `EventLiveView.tsx`. Two animation sequences — Opening Ceremony (tournament start) and Reseed (round advance) — each with 5 phases. CSS handles decorative effects (scan lines, orbit, glow), Framer Motion handles spatial transitions (rank shift, fly-to-pods via `layoutId`).

**Tech Stack:** React 19, Framer Motion (new dep), TypeScript, Tailwind CSS v4, CSS keyframes

**Design Doc:** `docs/plans/2026-02-15-cinematic-tv-animations-design.md`

---

## Key Types Reference

```typescript
// From frontend/src/services/api.ts
interface TournamentEvent {
  id: string; name: string; event_type: string; players: EventPlayer[];
  status: 'setup' | 'active' | 'completed' | 'cancelled';
  current_round: number; round_count: number; rounds: EventRound[];
  standings: StandingsEntry[]; sets: DraftSet[]; game_mode?: 'commander' | 'limited';
  custom_image?: string; event_date: string;
}
interface EventPlayer { player_id: string; player_name: string; avatar?: string; }
interface StandingsEntry {
  player_id: string; player_name: string; total_points: number;
  wins: number; kills: number; round_points: number[];
}
interface EventRound { round_number: number; pods: PodAssignment[]; results: RoundResult[]; status: string; }
interface PodAssignment { pod_index: number; player_ids: string[]; match_status: string; player_decks: Record<string, PlayerDeckInfo>; }
```

**Existing component contract (same props interface):**
```typescript
interface TVCinematicAnimationProps {
  event: TournamentEvent;
  animationType: 'shuffle' | 'reseed';
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}
```

---

## Task 1: Install Framer Motion

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install framer-motion**

Run:
```bash
cd frontend && npm install framer-motion
```

Expected: `framer-motion` added to `dependencies` in `package.json`.

**Step 2: Verify installation**

Run:
```bash
cd frontend && node -e "require('framer-motion'); console.log('OK')"
```

Expected: `OK` (no errors). Note: If this fails with ESM error, just verify it's in package.json and move on — it'll work in Vite.

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add framer-motion dependency for cinematic animations"
```

---

## Task 2: CSS Effects Foundation

Create the CSS-only decorative effects used across both animation sequences. These are scan lines, orbit ring, glow effects, and glitch text — all pure CSS keyframes that don't need Framer Motion.

**Files:**
- Create: `frontend/src/components/events/cinematic-effects.css`

**Step 1: Create the CSS effects file**

```css
/* ─── Scan Line Sweep ─────────────────────────────────────────── */

@keyframes scan-line-sweep {
  0%   { transform: translateY(-100vh); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(100vh); opacity: 0; }
}

.scan-line {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
}

.scan-line::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(102, 126, 234, 0.5) 20%,
    rgba(102, 126, 234, 0.8) 50%,
    rgba(102, 126, 234, 0.5) 80%,
    transparent 100%
  );
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.6), 0 0 60px rgba(102, 126, 234, 0.3);
  animation: scan-line-sweep 2s ease-in-out forwards;
}

/* ─── Orbit Ring ──────────────────────────────────────────────── */

@keyframes orbit-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.orbit-container {
  animation: orbit-spin 4s linear infinite;
}

.orbit-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: 0 0;
}

/* ─── Glow Pulse on Pod Arrival ───────────────────────────────── */

@keyframes pod-glow-arrive {
  0%   { box-shadow: 0 0 0px rgba(102, 126, 234, 0); }
  50%  { box-shadow: 0 0 30px rgba(102, 126, 234, 0.5), 0 0 60px rgba(102, 126, 234, 0.2); }
  100% { box-shadow: 0 0 12px rgba(102, 126, 234, 0.25); }
}

.pod-glow-arrive {
  animation: pod-glow-arrive 1s ease-out forwards;
}

/* ─── Glitch Text Effect ──────────────────────────────────────── */

@keyframes glitch-text {
  0%   { clip-path: inset(0 0 85% 0); transform: translate(-2px, 2px); }
  10%  { clip-path: inset(15% 0 60% 0); transform: translate(2px, -1px); }
  20%  { clip-path: inset(50% 0 20% 0); transform: translate(-1px, 1px); }
  30%  { clip-path: inset(0); transform: translate(0); }
  100% { clip-path: inset(0); transform: translate(0); }
}

.glitch-text {
  position: relative;
}

.glitch-text::before,
.glitch-text::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.glitch-text::before {
  color: #ff6b6b;
  animation: glitch-text 0.8s ease-in-out 0.2s both;
}

.glitch-text::after {
  color: #4dabf7;
  animation: glitch-text 0.8s ease-in-out 0.4s reverse both;
}

/* ─── Round Progress Dots ─────────────────────────────────────── */

@keyframes dot-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(102, 126, 234, 0.4); }
  50%      { box-shadow: 0 0 12px rgba(102, 126, 234, 0.8); }
}

.round-dot-current {
  animation: dot-glow 2s ease-in-out infinite;
}

/* ─── Title Slam-In ───────────────────────────────────────────── */

@keyframes slam-in {
  0%   { transform: scale(2.5); opacity: 0; filter: blur(10px); }
  60%  { transform: scale(0.95); opacity: 1; filter: blur(0); }
  80%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}

.slam-in {
  animation: slam-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* ─── Pulsing Ready Indicator ─────────────────────────────────── */

@keyframes ready-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(81, 207, 102, 0.3); }
  50%      { opacity: 0.8; box-shadow: 0 0 20px rgba(81, 207, 102, 0.6); }
}

.ready-pulse {
  animation: ready-pulse 2s ease-in-out infinite;
}

/* ─── Background Ambient Glow ─────────────────────────────────── */

@keyframes ambient-glow {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 0.6; }
}

.ambient-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(102, 126, 234, 0.08) 0%, transparent 70%);
  animation: ambient-glow 4s ease-in-out infinite;
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/events/cinematic-effects.css
git commit -m "feat: add CSS effects for cinematic TV animations (scan line, orbit, glow, glitch)"
```

---

## Task 3: Shared Sub-Components

Create small reusable pieces shared across both animation sequences: Round Progress Dots, Orbit Ring, and Player Tile.

**Files:**
- Create: `frontend/src/components/events/CinematicParts.tsx`

**Step 1: Create the shared components file**

This file exports three components:

1. **`RoundProgressDots`** — small dots showing round progression (green=done, purple=current, dim=upcoming)
2. **`OrbitRing`** — rotating circle of player avatar dots for interstitial phases
3. **`CinematicPlayerTile`** — individual player avatar + name tile used in grid and pod layouts

```tsx
import { motion } from 'framer-motion';
import type { EventPlayer, StandingsEntry } from '../../services/api';
import PlayerAvatar from '../PlayerAvatar';

// ─── Round Progress Dots ─────────────────────────────────────────

interface RoundProgressDotsProps {
  totalRounds: number;
  currentRound: number;
  completedRounds: number;
}

export function RoundProgressDots({ totalRounds, currentRound, completedRounds }: RoundProgressDotsProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalRounds }, (_, i) => {
        const roundNum = i + 1;
        const isCompleted = roundNum <= completedRounds;
        const isCurrent = roundNum === currentRound;

        return (
          <div
            key={roundNum}
            className={`w-3 h-3 rounded-full transition-all duration-500 ${
              isCompleted
                ? 'bg-[#51CF66]'
                : isCurrent
                  ? 'bg-[#667eea] round-dot-current'
                  : 'bg-[#2C2E33]'
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── Orbit Ring ──────────────────────────────────────────────────

interface OrbitRingProps {
  players: EventPlayer[];
  /** Diameter of the orbit circle in px */
  size?: number;
}

export function OrbitRing({ players, size = 200 }: OrbitRingProps) {
  const radius = size / 2;

  return (
    <div
      className="orbit-container relative"
      style={{ width: size, height: size }}
    >
      {players.map((player, i) => {
        const angle = (i / players.length) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <div
            key={player.player_id}
            className="orbit-dot"
            style={{
              transform: `translate(${x - 16}px, ${y - 16}px)`,
            }}
          >
            <PlayerAvatar
              playerName={player.player_name}
              customAvatar={player.avatar}
              size="small"
              className="!w-8 !h-8 !text-xs border-2 border-[#667eea]/50"
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Cinematic Player Tile ──────────────────────────────────────

interface CinematicPlayerTileProps {
  player: EventPlayer;
  /** If provided, shows seed number badge */
  seed?: number;
  /** If provided, shows point badge */
  points?: number;
  /** Framer Motion layout ID for FLIP animation */
  layoutId?: string;
}

export function CinematicPlayerTile({ player, seed, points, layoutId }: CinematicPlayerTileProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className="flex flex-col items-center gap-2"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative">
        <PlayerAvatar
          playerName={player.player_name}
          customAvatar={player.avatar}
          size="small"
          className="!w-[72px] !h-[72px] !text-2xl border-2 border-[#2C2E33]"
        />
        {seed != null && (
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#667eea] flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{seed}</span>
          </div>
        )}
      </div>
      <span className="text-lg text-white font-medium text-center truncate max-w-[130px]">
        {player.player_name}
      </span>
      {points != null && (
        <span className="text-sm font-bold text-[#667eea] bg-[#667eea]/10 px-3 py-0.5 rounded-full">
          {points} pts
        </span>
      )}
    </motion.div>
  );
}

// ─── Rank Row (for rank shift phase) ────────────────────────────

interface RankRowProps {
  player: EventPlayer;
  rank: number;
  points: number;
  /** Change in rank from previous round: positive = moved up, negative = moved down */
  rankDelta?: number;
  layoutId: string;
  isTopMover?: boolean;
}

export function RankRow({ player, rank, points, rankDelta, layoutId, isTopMover }: RankRowProps) {
  const rankColor =
    rank === 1 ? 'text-[#FFD700]' : rank === 2 ? 'text-[#C0C0C0]' : rank === 3 ? 'text-[#CD7F32]' : 'text-[#909296]';

  return (
    <motion.div
      layoutId={layoutId}
      className={`flex items-center gap-5 w-full px-6 py-4 rounded-[14px] border transition-colors ${
        isTopMover
          ? 'bg-[#667eea]/10 border-[#667eea]/40'
          : 'bg-[#1A1B1E]/80 border-[#2C2E33]'
      }`}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      <span className={`text-3xl font-bold w-12 text-center ${rankColor}`}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {rank}
      </span>
      <PlayerAvatar
        playerName={player.player_name}
        customAvatar={player.avatar}
        size="small"
        className="!w-14 !h-14 !text-lg border-2 border-[#2C2E33]"
      />
      <span className="text-2xl text-white font-semibold flex-1 truncate"
        style={{ fontFamily: "'Chakra Petch', sans-serif" }}
      >
        {player.player_name}
      </span>

      {/* Rank change indicator */}
      {rankDelta != null && rankDelta !== 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring' }}
          className={`text-lg font-bold ${
            rankDelta > 0 ? 'text-[#51CF66]' : 'text-[#FF6B6B]'
          }`}
        >
          {rankDelta > 0 ? `▲${rankDelta}` : `▼${Math.abs(rankDelta)}`}
        </motion.span>
      )}

      <motion.span
        className="text-xl font-bold text-[#667eea]"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {points} pts
      </motion.span>
    </motion.div>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to CinematicParts.tsx.

**Step 3: Commit**

```bash
git add frontend/src/components/events/CinematicParts.tsx
git commit -m "feat: add shared cinematic animation sub-components (tiles, orbit, progress dots)"
```

---

## Task 4: Phase Components — Interstitial & Settled

Create the two phase components shared by both sequences: the dramatic interstitial screen (SEEDING/RESEEDING) and the settled/ready indicator.

**Files:**
- Create: `frontend/src/components/events/CinematicPhases.tsx`

**Step 1: Create the phases file**

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import type { EventPlayer } from '../../services/api';
import { OrbitRing, RoundProgressDots } from './CinematicParts';

// ─── Interstitial Phase (Seeding/Reseeding drama) ───────────────

interface InterstitialPhaseProps {
  text: string;
  players: EventPlayer[];
}

export function InterstitialPhase({ text, players }: InterstitialPhaseProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-10"
    >
      {/* Scan line overlay */}
      <div className="scan-line" />

      {/* Title with glitch effect */}
      <div className="relative">
        <h2
          className="glitch-text text-7xl font-bold uppercase tracking-[0.15em] text-center"
          data-text={text}
          style={{
            fontFamily: "'Chakra Petch', sans-serif",
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {text}
        </h2>
      </div>

      {/* Orbiting player dots */}
      <OrbitRing players={players} size={240} />

      {/* Ambient glow */}
      <div className="ambient-glow" />
    </motion.div>
  );
}

// ─── Settled Phase (Ready indicator) ─────────────────────────────

interface SettledPhaseProps {
  roundNumber: number;
  totalRounds: number;
  completedRounds: number;
}

export function SettledPhase({ roundNumber, totalRounds, completedRounds }: SettledPhaseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex flex-col items-center gap-8"
    >
      <div className="ready-pulse px-12 py-5 rounded-full border border-[#51CF66]/40 bg-[#51CF66]/10">
        <span
          className="text-2xl font-bold text-[#51CF66] tracking-wide"
          style={{ fontFamily: "'Chakra Petch', sans-serif" }}
        >
          Round {roundNumber} Ready
        </span>
      </div>

      <RoundProgressDots
        totalRounds={totalRounds}
        currentRound={roundNumber}
        completedRounds={completedRounds}
      />
    </motion.div>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add frontend/src/components/events/CinematicPhases.tsx
git commit -m "feat: add interstitial and settled phase components for cinematic animation"
```

---

## Task 5: Opening Ceremony Sequence

Build the full 5-phase Opening Ceremony animation (used on tournament start when there are no standings yet).

**Files:**
- Create: `frontend/src/components/events/CinematicOpening.tsx`

**Step 1: Create the opening ceremony component**

This component renders 5 phases in sequence: Intro → Roll Call → Seeding Interstitial → Fly to Pods → Settled.

The key animation technique for **Fly to Pods** (Phase 4): Each `CinematicPlayerTile` has a `layoutId` based on the player ID. In Phase 2 (Roll Call) they're rendered in a flat grid. In Phase 4 they're rendered inside pod containers. Framer Motion auto-animates the position change via FLIP.

```tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { TournamentEvent } from '../../services/api';
import { CinematicPlayerTile, RoundProgressDots } from './CinematicParts';
import { InterstitialPhase, SettledPhase } from './CinematicPhases';
import './cinematic-effects.css';

type OpeningPhase = 'intro' | 'roll-call' | 'seeding' | 'fly-to-pods' | 'settled';

interface CinematicOpeningProps {
  event: TournamentEvent;
  onComplete: () => void;
}

export function CinematicOpening({ event, onComplete }: CinematicOpeningProps) {
  const [phase, setPhase] = useState<OpeningPhase>('intro');
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const round1 = event.rounds.find((r) => r.round_number === 1);
  const pods = round1?.pods ?? [];

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('roll-call'), 2000),
      setTimeout(() => setPhase('seeding'), 5000),
      setTimeout(() => setPhase('fly-to-pods'), 7500),
      setTimeout(() => setPhase('settled'), 10000),
      setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 11500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const findPlayer = (pid: string) => event.players.find((p) => p.player_id === pid);

  // Stagger variants for roll call
  const rollCallContainer = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.15 },
    },
  };

  const rollCallItem = {
    hidden: { opacity: 0, scale: 0.5, y: 40 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 20 },
    },
  };

  // Pod grid columns
  const podGridCols =
    pods.length === 1
      ? 'grid-cols-1'
      : pods.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <LayoutGroup>
      <div className="relative flex flex-col items-center justify-center h-full w-full overflow-hidden">
        {/* Round progress dots — top right */}
        <div className="absolute top-6 right-8 z-20">
          <RoundProgressDots
            totalRounds={event.round_count}
            currentRound={1}
            completedRounds={0}
          />
        </div>

        <AnimatePresence mode="wait">
          {/* Phase 1: Intro */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="scan-line" />
              <motion.h1
                initial={{ scale: 2.5, opacity: 0, filter: 'blur(10px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-7xl font-bold text-white text-center"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                {event.name}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="text-2xl text-[#909296]"
              >
                {event.players.length} Players &middot; {event.round_count} Rounds
              </motion.p>
            </motion.div>
          )}

          {/* Phase 2: Roll Call — players fly in */}
          {phase === 'roll-call' && (
            <motion.div
              key="roll-call"
              variants={rollCallContainer}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className={`grid ${event.players.length <= 4 ? 'grid-cols-2' : event.players.length <= 9 ? 'grid-cols-3' : 'grid-cols-4'} gap-8 max-w-5xl`}
            >
              {event.players.map((player) => (
                <motion.div key={player.player_id} variants={rollCallItem}>
                  <CinematicPlayerTile
                    player={player}
                    layoutId={`player-${player.player_id}`}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Phase 3: Seeding Interstitial */}
          {phase === 'seeding' && (
            <InterstitialPhase
              key="seeding"
              text="Seeding Pods"
              players={event.players}
            />
          )}

          {/* Phase 4: Fly to Pods */}
          {phase === 'fly-to-pods' && (
            <motion.div
              key="fly-to-pods"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`grid ${podGridCols} gap-8 max-w-5xl w-full px-6`}
            >
              {pods.map((pod, podIdx) => (
                <motion.div
                  key={podIdx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: podIdx * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
                  className="pod-glow-arrive rounded-[14px] border border-[#667eea]/40 p-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(26,27,30,0.95) 0%, rgba(28,29,33,0.95) 100%)',
                    animationDelay: `${podIdx * 0.2}s`,
                  }}
                >
                  <div className="mb-4">
                    <span
                      className="text-base font-bold uppercase tracking-widest text-[#667eea]"
                      style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                    >
                      {event.event_type === 'draft' ? `Match ${podIdx + 1}` : `Pod ${podIdx + 1}`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    {pod.player_ids.map((pid, playerIdx) => {
                      const player = findPlayer(pid);
                      if (!player) return null;

                      return (
                        <div key={pid}>
                          {/* VS separator for draft 1v1 */}
                          {event.event_type === 'draft' && playerIdx === 1 && (
                            <div className="flex justify-center my-2">
                              <span className="text-2xl font-bold text-[#5C5F66]"
                                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                              >
                                VS
                              </span>
                            </div>
                          )}
                          <CinematicPlayerTile
                            player={player}
                            layoutId={`player-${pid}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Phase 5: Settled */}
          {phase === 'settled' && (
            <SettledPhase
              key="settled"
              roundNumber={1}
              totalRounds={event.round_count}
              completedRounds={0}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add frontend/src/components/events/CinematicOpening.tsx
git commit -m "feat: add cinematic opening ceremony animation (5-phase sequence)"
```

---

## Task 6: Reseed Sequence

Build the full 5-phase Reseed animation (used on round advance when standings exist).

**Files:**
- Create: `frontend/src/components/events/CinematicReseed.tsx`

**Step 1: Create the reseed component**

The key animation technique for **Rank Shift** (Phase 2): Render the standings list sorted by *previous* rank, then re-sort by *new* rank. Each row has a `layoutId`, so Framer Motion animates the position change. The `rankDelta` prop shows directional arrows.

```tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { TournamentEvent, StandingsEntry } from '../../services/api';
import { CinematicPlayerTile, RankRow, RoundProgressDots } from './CinematicParts';
import { InterstitialPhase, SettledPhase } from './CinematicPhases';
import './cinematic-effects.css';

type ReseedPhase = 'round-complete' | 'rank-shift' | 'reseeding' | 'fly-to-pods' | 'settled';

interface CinematicReseedProps {
  event: TournamentEvent;
  previousStandings: StandingsEntry[];
  onComplete: () => void;
}

export function CinematicReseed({ event, previousStandings, onComplete }: CinematicReseedProps) {
  const [phase, setPhase] = useState<ReseedPhase>('round-complete');
  const [showNewRanks, setShowNewRanks] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const currentRound = event.rounds.find((r) => r.round_number === event.current_round);
  const pods = currentRound?.pods ?? [];
  const prevRoundNumber = event.current_round - 1;

  // Sort standings
  const newStandings = useMemo(
    () => [...event.standings].sort((a, b) => b.total_points - a.total_points),
    [event.standings],
  );

  const prevSorted = useMemo(
    () => [...previousStandings].sort((a, b) => b.total_points - a.total_points),
    [previousStandings],
  );

  // Calculate rank deltas (positive = moved up)
  const rankDeltas = useMemo(() => {
    const deltas: Record<string, number> = {};
    newStandings.forEach((entry, newIdx) => {
      const oldIdx = prevSorted.findIndex((p) => p.player_id === entry.player_id);
      if (oldIdx >= 0) {
        deltas[entry.player_id] = oldIdx - newIdx; // positive = moved up
      }
    });
    return deltas;
  }, [newStandings, prevSorted]);

  // Find top mover
  const topMoverId = useMemo(() => {
    let maxMove = 0;
    let topId = '';
    for (const [id, delta] of Object.entries(rankDeltas)) {
      if (Math.abs(delta) > maxMove) {
        maxMove = Math.abs(delta);
        topId = id;
      }
    }
    return maxMove > 0 ? topId : null;
  }, [rankDeltas]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('rank-shift'), 2000),
      // Trigger the re-sort after a brief pause so users see the old order first
      setTimeout(() => setShowNewRanks(true), 2800),
      setTimeout(() => setPhase('reseeding'), 5000),
      setTimeout(() => setPhase('fly-to-pods'), 7500),
      setTimeout(() => setPhase('settled'), 10000),
      setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 11500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const findPlayer = (pid: string) => event.players.find((p) => p.player_id === pid);

  // Which standings to render in rank-shift: start with old order, then swap to new
  const displayStandings = showNewRanks ? newStandings : prevSorted;

  // Pod grid columns
  const podGridCols =
    pods.length === 1
      ? 'grid-cols-1'
      : pods.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <LayoutGroup>
      <div className="relative flex flex-col items-center justify-center h-full w-full overflow-hidden">
        {/* Round progress dots — top right */}
        <div className="absolute top-6 right-8 z-20">
          <RoundProgressDots
            totalRounds={event.round_count}
            currentRound={event.current_round}
            completedRounds={event.current_round - 1}
          />
        </div>

        <AnimatePresence mode="wait">
          {/* Phase 1: Round Complete */}
          {phase === 'round-complete' && (
            <motion.div
              key="round-complete"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-[#51CF66]/15 border-2 border-[#51CF66]/40 flex items-center justify-center"
              >
                <span className="text-4xl">✓</span>
              </motion.div>
              <h2
                className="text-5xl font-bold text-white"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Round {prevRoundNumber} Complete
              </h2>
              <p className="text-xl text-[#909296]">Standings updated</p>
            </motion.div>
          )}

          {/* Phase 2: Rank Shift */}
          {phase === 'rank-shift' && (
            <motion.div
              key="rank-shift"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 max-w-2xl w-full px-6"
            >
              <h3
                className="text-2xl font-bold text-[#667eea] mb-4 uppercase tracking-wider"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Standings
              </h3>
              {displayStandings.map((entry, idx) => {
                const player = findPlayer(entry.player_id);
                if (!player) return null;
                return (
                  <RankRow
                    key={entry.player_id}
                    layoutId={`player-${entry.player_id}`}
                    player={player}
                    rank={idx + 1}
                    points={entry.total_points}
                    rankDelta={showNewRanks ? rankDeltas[entry.player_id] : undefined}
                    isTopMover={showNewRanks && entry.player_id === topMoverId}
                  />
                );
              })}
            </motion.div>
          )}

          {/* Phase 3: Reseeding Interstitial */}
          {phase === 'reseeding' && (
            <InterstitialPhase
              key="reseeding"
              text="Reseeding"
              players={event.players}
            />
          )}

          {/* Phase 4: Fly to Pods */}
          {phase === 'fly-to-pods' && (
            <motion.div
              key="fly-to-pods"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`grid ${podGridCols} gap-8 max-w-5xl w-full px-6`}
            >
              {pods.map((pod, podIdx) => {
                // Calculate seed for each player
                const playerSeeds: Record<string, number> = {};
                pod.player_ids.forEach((pid) => {
                  const seedIdx = newStandings.findIndex((s) => s.player_id === pid);
                  playerSeeds[pid] = seedIdx >= 0 ? seedIdx + 1 : 0;
                });

                return (
                  <motion.div
                    key={podIdx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: podIdx * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
                    className="pod-glow-arrive rounded-[14px] border border-[#667eea]/40 p-6"
                    style={{
                      background: 'linear-gradient(135deg, rgba(26,27,30,0.95) 0%, rgba(28,29,33,0.95) 100%)',
                      animationDelay: `${podIdx * 0.2}s`,
                    }}
                  >
                    <div className="mb-4">
                      <span
                        className="text-base font-bold uppercase tracking-widest text-[#667eea]"
                        style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                      >
                        {event.event_type === 'draft' ? `Match ${podIdx + 1}` : `Pod ${podIdx + 1}`}
                      </span>
                    </div>

                    <div className="flex flex-col gap-4">
                      {pod.player_ids.map((pid, playerIdx) => {
                        const player = findPlayer(pid);
                        if (!player) return null;
                        const standing = newStandings.find((s) => s.player_id === pid);

                        return (
                          <div key={pid}>
                            {event.event_type === 'draft' && playerIdx === 1 && (
                              <div className="flex justify-center my-2">
                                <span className="text-2xl font-bold text-[#5C5F66]"
                                  style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                                >
                                  VS
                                </span>
                              </div>
                            )}
                            <CinematicPlayerTile
                              player={player}
                              layoutId={`player-${pid}`}
                              seed={playerSeeds[pid]}
                              points={standing?.total_points}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Phase 5: Settled */}
          {phase === 'settled' && (
            <SettledPhase
              key="settled"
              roundNumber={event.current_round}
              totalRounds={event.round_count}
              completedRounds={event.current_round - 1}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add frontend/src/components/events/CinematicReseed.tsx
git commit -m "feat: add cinematic reseed animation (5-phase with rank shift and FLIP transitions)"
```

---

## Task 7: Main TVCinematicAnimation Wrapper

Create the top-level component that selects between Opening and Reseed sequences, matching the same interface as the existing `TVShuffleAnimation`.

**Files:**
- Create: `frontend/src/components/events/TVCinematicAnimation.tsx`

**Step 1: Create the wrapper component**

```tsx
import type { TournamentEvent, StandingsEntry } from '../../services/api';
import { CinematicOpening } from './CinematicOpening';
import { CinematicReseed } from './CinematicReseed';

interface TVCinematicAnimationProps {
  event: TournamentEvent;
  animationType: 'shuffle' | 'reseed';
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}

export function TVCinematicAnimation({
  event,
  animationType,
  previousStandings,
  onComplete,
}: TVCinematicAnimationProps) {
  if (animationType === 'reseed' && previousStandings) {
    return (
      <CinematicReseed
        event={event}
        previousStandings={previousStandings}
        onComplete={onComplete}
      />
    );
  }

  return (
    <CinematicOpening
      event={event}
      onComplete={onComplete}
    />
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/events/TVCinematicAnimation.tsx
git commit -m "feat: add TVCinematicAnimation wrapper (selects opening vs reseed sequence)"
```

---

## Task 8: Integration — Wire Up to EventLiveView

Replace `TVShuffleAnimation` with `TVCinematicAnimation` in the live view.

**Files:**
- Modify: `frontend/src/pages/EventLiveView.tsx`

**Step 1: Update the import**

In `EventLiveView.tsx`, change:
```typescript
import { TVShuffleAnimation } from '../components/events/TVShuffleAnimation';
```
To:
```typescript
import { TVCinematicAnimation } from '../components/events/TVCinematicAnimation';
```

**Step 2: Update the usage**

Find the `TVShuffleAnimation` usage (around line 1101) and replace:
```tsx
<TVShuffleAnimation
  event={event}
  animationType={animationState}
  previousStandings={previousStandings ?? undefined}
  onComplete={() => setAnimationState('none')}
/>
```
With:
```tsx
<TVCinematicAnimation
  event={event}
  animationType={animationState}
  previousStandings={previousStandings ?? undefined}
  onComplete={() => setAnimationState('none')}
/>
```

**Step 3: Verify it compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

**Step 4: Verify dev build works**

Run:
```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add frontend/src/pages/EventLiveView.tsx
git commit -m "feat: wire cinematic animation into TV live view (replaces TVShuffleAnimation)"
```

---

## Task 9: Visual Testing & Tuning

Manually test both animation sequences on the TV live view and tune spring configs, timing, and visual effects.

**Files:**
- Modify: Various cinematic animation files as needed during tuning

**Step 1: Start dev servers**

Use the `start` skill or manually:
```bash
# Terminal 1: Backend
cd backend && uv run uvicorn app.main:app --reload --port 7777

# Terminal 2: Frontend
cd frontend && npm run dev
```

**Step 2: Test Opening Ceremony**

1. Create a test event with 4-8 players
2. Open the live view URL in a separate browser tab/window: `http://localhost:5173/event/{id}/live`
3. Start the tournament from the dashboard view
4. Watch the live view — it should play the 5-phase opening ceremony
5. Verify: Intro text slams in → Players fly in with stagger → "SEEDING PODS" interstitial with orbit ring → Players fly into pod containers → "Round 1 Ready" pulse

**Step 3: Test Reseed Animation**

1. Complete all pods in Round 1
2. Click "Next Round" from the dashboard
3. Watch the live view — it should play the 5-phase reseed
4. Verify: "Round 1 Complete" banner → Standings rows shift to new positions with arrows → "RESEEDING" interstitial → Players fly to new pods with seed badges → "Round 2 Ready" pulse

**Step 4: Tune as needed**

Common tuning targets:
- Spring `stiffness`/`damping` values in `CinematicParts.tsx` and `CinematicPhases.tsx`
- Phase timing in `setTimeout` chains (in `CinematicOpening.tsx` and `CinematicReseed.tsx`)
- CSS effect intensity (glow opacity, scan line color, glitch severity)

**Step 5: Commit tuning changes**

```bash
git add -A
git commit -m "fix: tune cinematic animation timing and spring configs"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Install Framer Motion | `package.json` |
| 2 | CSS effects (scan line, orbit, glow, glitch) | `cinematic-effects.css` |
| 3 | Shared sub-components (tiles, orbit ring, progress dots) | `CinematicParts.tsx` |
| 4 | Phase components (interstitial, settled) | `CinematicPhases.tsx` |
| 5 | Opening Ceremony sequence (5 phases) | `CinematicOpening.tsx` |
| 6 | Reseed sequence (5 phases with rank shift) | `CinematicReseed.tsx` |
| 7 | Wrapper component | `TVCinematicAnimation.tsx` |
| 8 | Integration with EventLiveView | `EventLiveView.tsx` |
| 9 | Visual testing & tuning | Various |
