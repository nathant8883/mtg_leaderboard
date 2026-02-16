import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { TournamentEvent, StandingsEntry } from '../../services/api';
import { RankRow, RoundProgressDots } from './CinematicParts';
import PlayerAvatar from '../PlayerAvatar';
import './cinematic-effects.css';

type ClosingPhase = 'final-round' | 'final-standings' | 'champion' | 'podium' | 'done';

interface CinematicClosingProps {
  event: TournamentEvent;
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}

export function CinematicClosing({ event, previousStandings, onComplete }: CinematicClosingProps) {
  const [phase, setPhase] = useState<ClosingPhase>('final-round');
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finalStandings = useMemo(
    () => [...event.standings].sort((a, b) => b.total_points - a.total_points),
    [event.standings],
  );

  const prevSorted = useMemo(
    () =>
      previousStandings
        ? [...previousStandings].sort((a, b) => b.total_points - a.total_points)
        : finalStandings,
    [previousStandings, finalStandings],
  );

  // Rank deltas
  const rankDeltas = useMemo(() => {
    const deltas: Record<string, number> = {};
    finalStandings.forEach((entry, newIdx) => {
      const oldIdx = prevSorted.findIndex((p) => p.player_id === entry.player_id);
      if (oldIdx >= 0) deltas[entry.player_id] = oldIdx - newIdx;
    });
    return deltas;
  }, [finalStandings, prevSorted]);

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

  const [showNewRanks, setShowNewRanks] = useState(false);

  const champion = finalStandings[0];
  const championPlayer = event.players.find((p) => p.player_id === champion?.player_id);
  const podiumEntries = finalStandings.slice(0, Math.min(3, finalStandings.length));

  const findPlayer = (pid: string) => event.players.find((p) => p.player_id === pid);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('final-standings'), 2500),
      setTimeout(() => setShowNewRanks(true), 3300),
      setTimeout(() => setPhase('champion'), 6000),
      setTimeout(() => setPhase('podium'), 9500),
      setTimeout(() => setPhase('done'), 12500),
      setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 14000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Which standings to show in rank-shift
  const displayStandings = showNewRanks ? finalStandings : prevSorted;

  return (
    <LayoutGroup>
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] w-full overflow-hidden">
        {/* Round progress — all complete */}
        <div className="absolute top-6 right-8 z-20">
          <RoundProgressDots
            totalRounds={event.round_count}
            currentRound={event.round_count}
            completedRounds={event.round_count}
          />
        </div>

        <AnimatePresence mode="wait">
          {/* Phase 1: Final Round Complete */}
          {phase === 'final-round' && (
            <motion.div
              key="final-round"
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
                className="w-24 h-24 rounded-full bg-[#FFD700]/15 border-2 border-[#FFD700]/40 flex items-center justify-center"
              >
                <span className="text-5xl">🏆</span>
              </motion.div>
              <h2
                className="text-6xl font-bold text-white"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Tournament Complete
              </h2>
              <p className="text-2xl text-[#909296]">
                {event.round_count} rounds played
              </p>
            </motion.div>
          )}

          {/* Phase 2: Final Standings */}
          {phase === 'final-standings' && (
            <motion.div
              key="final-standings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-3 max-w-4xl w-full px-8"
            >
              <h3
                className="text-4xl font-bold text-[#FFD700] mb-6 uppercase tracking-wider"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Final Standings
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

          {/* Phase 3: Champion Spotlight */}
          {phase === 'champion' && championPlayer && (
            <motion.div
              key="champion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="relative flex flex-col items-center gap-8"
            >
              {/* Scan line for dramatic effect */}
              <div className="scan-line" />

              {/* Ambient gold glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.1) 0%, transparent 60%)',
                  animation: 'ambient-glow 3s ease-in-out infinite',
                }}
              />

              {/* Champion label */}
              <motion.p
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
                className="text-2xl font-bold uppercase tracking-[0.3em] text-[#FFD700]/70"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Champion
              </motion.p>

              {/* Big avatar with gold ring */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }}
              >
                <div className="relative">
                  <div
                    className="rounded-full p-1.5"
                    style={{
                      background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
                    }}
                  >
                    <PlayerAvatar
                      playerName={championPlayer.player_name}
                      customAvatar={championPlayer.avatar}
                      size="large"
                      className="!w-40 !h-40 !text-6xl border-4 border-[#0a0a10]"
                    />
                  </div>
                  {/* Trophy badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.6 }}
                    className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-[#FFD700] flex items-center justify-center shadow-lg"
                  >
                    <span className="text-2xl">👑</span>
                  </motion.div>
                </div>
              </motion.div>

              {/* Champion name */}
              <motion.h1
                initial={{ scale: 2.5, opacity: 0, filter: 'blur(10px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.4 }}
                className="text-7xl font-bold text-[#FFD700] text-center"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                {championPlayer.player_name}
              </motion.h1>

              {/* Stats line */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="text-2xl text-[#FFD700]/60"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {event.event_type === 'draft'
                  ? `${champion.wins}-${champion.round_points.length - champion.wins}`
                  : `${champion.total_points} pts · ${champion.wins}W · ${champion.kills}K`}
              </motion.p>
            </motion.div>
          )}

          {/* Phase 4: Podium */}
          {phase === 'podium' && (
            <motion.div
              key="podium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-10"
            >
              <h3
                className="text-3xl font-bold text-white uppercase tracking-wider"
                style={{ fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Final Results
              </h3>

              {/* Podium layout: 2nd | 1st (elevated) | 3rd */}
              <div className="flex items-end justify-center gap-6">
                {/* Reorder for podium display: [1st] center elevated, [2nd] left, [3rd] right */}
                {podiumEntries.length >= 2 && (
                  <PodiumSlot
                    player={findPlayer(podiumEntries[1].player_id)!}
                    standing={podiumEntries[1]}
                    rank={2}
                    delay={0.3}
                    height={180}
                    eventType={event.event_type}
                  />
                )}
                {podiumEntries.length >= 1 && (
                  <PodiumSlot
                    player={findPlayer(podiumEntries[0].player_id)!}
                    standing={podiumEntries[0]}
                    rank={1}
                    delay={0.1}
                    height={240}
                    eventType={event.event_type}
                  />
                )}
                {podiumEntries.length >= 3 && (
                  <PodiumSlot
                    player={findPlayer(podiumEntries[2].player_id)!}
                    standing={podiumEntries[2]}
                    rank={3}
                    delay={0.5}
                    height={140}
                    eventType={event.event_type}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* Phase 5: Done */}
          {phase === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-8"
            >
              <div className="px-12 py-5 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/10"
                style={{ animation: 'ready-pulse 2s ease-in-out infinite' }}
              >
                <span
                  className="text-2xl font-bold text-[#FFD700] tracking-wide"
                  style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                >
                  {event.name} — Complete
                </span>
              </div>

              <RoundProgressDots
                totalRounds={event.round_count}
                currentRound={event.round_count}
                completedRounds={event.round_count}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

// ─── Podium Slot ──────────────────────────────────────────────────

const podiumColors: Record<number, { bg: string; border: string; text: string; label: string }> = {
  1: { bg: 'rgba(255,215,0,0.12)', border: 'rgba(255,215,0,0.5)', text: '#FFD700', label: '1st' },
  2: { bg: 'rgba(192,192,192,0.10)', border: 'rgba(192,192,192,0.4)', text: '#C0C0C0', label: '2nd' },
  3: { bg: 'rgba(205,127,50,0.10)', border: 'rgba(205,127,50,0.4)', text: '#CD7F32', label: '3rd' },
};

function PodiumSlot({
  player,
  standing,
  rank,
  delay,
  height,
  eventType,
}: {
  player: { player_name: string; avatar?: string };
  standing: StandingsEntry;
  rank: number;
  delay: number;
  height: number;
  eventType: string;
}) {
  const colors = podiumColors[rank] ?? podiumColors[3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay }}
      className="flex flex-col items-center gap-4"
    >
      {/* Avatar */}
      <div
        className="rounded-full p-1"
        style={{ background: `linear-gradient(135deg, ${colors.text}, ${colors.border})` }}
      >
        <PlayerAvatar
          playerName={player.player_name}
          customAvatar={player.avatar}
          size="large"
          className={`${rank === 1 ? '!w-24 !h-24 !text-4xl' : '!w-16 !h-16 !text-2xl'} border-2 border-[#0a0a10]`}
        />
      </div>

      {/* Name */}
      <span
        className={`${rank === 1 ? 'text-2xl' : 'text-lg'} font-bold text-center max-w-[160px] truncate`}
        style={{ fontFamily: "'Chakra Petch', sans-serif", color: colors.text }}
      >
        {player.player_name}
      </span>

      {/* Stats */}
      <span
        className="text-sm text-white/60"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {eventType === 'draft'
          ? `${standing.wins}-${standing.round_points.length - standing.wins}`
          : `${standing.total_points} pts`}
      </span>

      {/* Podium block */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height }}
        transition={{ type: 'spring', stiffness: 150, damping: 20, delay: delay + 0.2 }}
        className="w-32 rounded-t-[12px] flex items-start justify-center pt-4"
        style={{
          background: colors.bg,
          borderTop: `3px solid ${colors.border}`,
          borderLeft: `1px solid ${colors.border}`,
          borderRight: `1px solid ${colors.border}`,
        }}
      >
        <span
          className="text-3xl font-bold"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: colors.text }}
        >
          {colors.label}
        </span>
      </motion.div>
    </motion.div>
  );
}
