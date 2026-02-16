import { motion, AnimatePresence } from 'framer-motion';
import type { EventPlayer } from '../../services/api';
import PlayerAvatar from '../PlayerAvatar';

/* ==========================================================
   Shared Sub-Components for Cinematic Event Animations
   Used by both the intro and round-transition sequences.
   ========================================================== */

// ---------------------------------------------------------
// 1. RoundProgressDots
//    A row of small dots indicating round progress.
// ---------------------------------------------------------

interface RoundProgressDotsProps {
  totalRounds: number;
  currentRound: number;
  completedRounds: number;
}

export function RoundProgressDots({
  totalRounds,
  currentRound,
  completedRounds,
}: RoundProgressDotsProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalRounds }, (_, i) => {
        const roundNumber = i + 1;
        const isCompleted = roundNumber <= completedRounds;
        const isCurrent = roundNumber === currentRound;

        let dotClass = 'w-2.5 h-2.5 rounded-full transition-colors duration-300';
        if (isCompleted) {
          dotClass += ' bg-[#51CF66]';
        } else if (isCurrent) {
          dotClass += ' bg-[#667eea] round-dot-current';
        } else {
          dotClass += ' bg-[#2C2E33]';
        }

        return <div key={i} className={dotClass} />;
      })}
    </div>
  );
}

// ---------------------------------------------------------
// 2. OrbitRing
//    Players arranged in a circle that rotates together.
// ---------------------------------------------------------

interface OrbitRingProps {
  players: EventPlayer[];
  size?: number;
}

export function OrbitRing({ players, size = 200 }: OrbitRingProps) {
  const radius = size / 2 - 20; // leave room for avatars at edges

  return (
    <div
      className="orbit-container"
      style={{ width: size, height: size }}
    >
      {players.map((player, i) => {
        const angle = (i / players.length) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <div
            key={player.player_id}
            className="orbit-dot absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
              width: 'auto',
              height: 'auto',
              margin: 0,
              background: 'none',
              boxShadow: 'none',
            }}
          >
            <PlayerAvatar
              playerName={player.player_name}
              customAvatar={player.avatar}
              size="small"
              className="!w-8 !h-8 !text-xs"
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------
// 3. CinematicPlayerTile
//    An animated player tile with avatar, name, optional
//    seed badge and points badge. Uses framer-motion layoutId
//    for FLIP animations between positions.
// ---------------------------------------------------------

interface CinematicPlayerTileProps {
  player: EventPlayer;
  seed?: number;
  points?: number;
  layoutId?: string;
}

const tileSpring = { type: 'spring' as const, stiffness: 300, damping: 30 };

export function CinematicPlayerTile({
  player,
  seed,
  points,
  layoutId,
}: CinematicPlayerTileProps) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={tileSpring}
      className="flex flex-col items-center gap-2"
    >
      {/* Avatar wrapper — holds the seed badge */}
      <div className="relative">
        <PlayerAvatar
          playerName={player.player_name}
          customAvatar={player.avatar}
          size="large"
          className="!w-[72px] !h-[72px] !text-2xl"
        />
        {seed !== undefined && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#667eea] text-white text-[10px] font-bold flex items-center justify-center shadow-lg"
          >
            {seed}
          </span>
        )}
      </div>

      {/* Player name */}
      <span
        className="text-sm font-semibold text-white/90 text-center max-w-[90px] truncate"
        style={{ fontFamily: "'Chakra Petch', sans-serif" }}
      >
        {player.player_name}
      </span>

      {/* Optional points badge */}
      {points !== undefined && (
        <span className="text-xs font-bold text-[#667eea] bg-[#667eea]/15 px-2 py-0.5 rounded-full">
          {points} pts
        </span>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------
// 4. RankRow
//    A single row in a standings table with animated layout
//    transitions, rank delta arrows, and top-mover highlight.
// ---------------------------------------------------------

interface RankRowProps {
  player: EventPlayer;
  rank: number;
  points: number;
  rankDelta?: number;
  layoutId: string;
  isTopMover?: boolean;
}

function rankColor(rank: number): string {
  switch (rank) {
    case 1:
      return '#FFD700'; // gold
    case 2:
      return '#C0C0C0'; // silver
    case 3:
      return '#CD7F32'; // bronze
    default:
      return '#9ca3af'; // gray-400
  }
}

const rowSpring = { type: 'spring' as const, stiffness: 200, damping: 25 };

export function RankRow({
  player,
  rank,
  points,
  rankDelta,
  layoutId,
  isTopMover = false,
}: RankRowProps) {
  const highlightClass = isTopMover
    ? 'bg-[#667eea]/10 border border-[#667eea]/40'
    : 'border border-transparent';

  return (
    <motion.div
      layoutId={layoutId}
      transition={rowSpring}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-[10px] ${highlightClass}`}
    >
      {/* Rank number */}
      <span
        className="w-7 text-right text-lg font-bold shrink-0"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: rankColor(rank),
        }}
      >
        {rank}
      </span>

      {/* Player avatar */}
      <PlayerAvatar
        playerName={player.player_name}
        customAvatar={player.avatar}
        size="small"
        className="!w-8 !h-8 !text-xs"
      />

      {/* Player name — fills available space */}
      <span
        className="flex-1 truncate text-sm font-semibold text-white/90"
        style={{ fontFamily: "'Chakra Petch', sans-serif" }}
      >
        {player.player_name}
      </span>

      {/* Rank delta arrow */}
      <AnimatePresence>
        {rankDelta !== undefined && rankDelta !== 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ delay: 0.8, duration: 0.3 }}
            className={`text-xs font-bold ${
              rankDelta > 0 ? 'text-[#51CF66]' : 'text-[#ff6b6b]'
            }`}
          >
            {rankDelta > 0 ? `▲${rankDelta}` : `▼${Math.abs(rankDelta)}`}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Points */}
      <span
        className="w-10 text-right text-sm font-bold text-white/80"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {points}
      </span>
    </motion.div>
  );
}
