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
                <span className="text-4xl">&#x2713;</span>
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
