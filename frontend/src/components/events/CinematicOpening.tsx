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
      setTimeout(() => setPhase('roll-call'), 4000),
      setTimeout(() => setPhase('seeding'), 10000),
      setTimeout(() => setPhase('fly-to-pods'), 15000),
      setTimeout(() => setPhase('settled'), 20000),
      setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 23000),
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
      transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
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
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] w-full overflow-hidden">
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
