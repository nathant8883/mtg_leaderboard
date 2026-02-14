import { useState, useEffect, useRef } from 'react';
import type { TournamentEvent, EventPlayer } from '../../services/api';
import PlayerAvatar from '../PlayerAvatar';

type AnimationPhase = 'shuffle' | 'resolve' | 'reveal' | 'done';

interface ShuffleAnimationProps {
  event: TournamentEvent;
  onComplete: () => void;
}

// Generate a deterministic but varied set of animation parameters per player index
function getShuffleStyle(index: number): React.CSSProperties {
  // Vary delay and duration so each tile feels independent
  const delay = (index * 0.12) % 0.8;
  const duration = 0.5 + (index % 3) * 0.15;
  return {
    animation: `shuffle-bounce ${duration}s ease-in-out infinite alternate`,
    animationDelay: `${delay}s`,
  };
}

export function ShuffleAnimation({ event, onComplete }: ShuffleAnimationProps) {
  const [phase, setPhase] = useState<AnimationPhase>('shuffle');
  const completedRef = useRef(false);

  // Get round 1 pods
  const round1 = event.rounds.find((r) => r.round_number === 1);
  const pods = round1?.pods ?? [];

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('resolve'), 1500),
      setTimeout(() => setPhase('reveal'), 3000),
      setTimeout(() => {
        setPhase('done');
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }, 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Determine grid columns based on player count
  const playerCount = event.players.length;
  const gridCols =
    playerCount <= 4
      ? 'grid-cols-2'
      : playerCount <= 9
        ? 'grid-cols-3'
        : 'grid-cols-4';

  return (
    <div className="fixed inset-0 z-[3000] bg-black/95 flex flex-col items-center justify-center overflow-hidden">
      {/* Inline keyframes */}
      <style>{`
        @keyframes shuffle-bounce {
          0%   { transform: translateY(0)     scale(1)    rotate(0deg);  opacity: 1;   }
          20%  { transform: translateY(-12px) scale(1.08) rotate(-4deg); opacity: 0.75; }
          40%  { transform: translateY(6px)   scale(0.92) rotate(3deg);  opacity: 1;   }
          60%  { transform: translateY(-9px)  scale(1.04) rotate(-2deg); opacity: 0.85; }
          80%  { transform: translateY(4px)   scale(0.97) rotate(1deg);  opacity: 1;   }
          100% { transform: translateY(-3px)  scale(1.01) rotate(-1deg); opacity: 0.9; }
        }

        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(102,126,234,0.3); }
          50%      { box-shadow: 0 0 20px rgba(102,126,234,0.6); }
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes title-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }

        .shuffle-tile {
          transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pod-container {
          animation: fade-in-up 0.6s ease-out both;
        }
      `}</style>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-8 text-center">
        {phase === 'shuffle' && (
          <span style={{ animation: 'title-pulse 1.2s ease-in-out infinite' }} className="inline-block">
            Shuffling Players...
          </span>
        )}
        {phase === 'resolve' && (
          <span className="text-[#667eea]">Forming Pods...</span>
        )}
        {(phase === 'reveal' || phase === 'done') && (
          <span className="text-[#51CF66]">Pods Assigned!</span>
        )}
      </h2>

      {/* Animation container */}
      <div className="relative w-full max-w-3xl px-4">
        {/* Phase 1: Shuffling grid */}
        {phase === 'shuffle' && (
          <div className={`grid ${gridCols} gap-4 justify-items-center`}>
            {event.players.map((player, i) => (
              <div
                key={player.player_id}
                className="shuffle-tile"
                style={getShuffleStyle(i)}
              >
                <PlayerTile player={player} glowing />
              </div>
            ))}
          </div>
        )}

        {/* Phase 2-4: Players grouped into pods */}
        {(phase === 'resolve' || phase === 'reveal' || phase === 'done') && (
          <div className="flex flex-col gap-5">
            {pods.map((pod, podIdx) => {
              const isRevealed = phase === 'reveal' || phase === 'done';

              return (
                <div
                  key={podIdx}
                  className="pod-container rounded-[12px] border p-4 transition-all duration-700"
                  style={{
                    animationDelay: `${podIdx * 150}ms`,
                    background: isRevealed
                      ? 'linear-gradient(135deg, rgba(26,27,30,0.95) 0%, rgba(28,29,33,0.95) 100%)'
                      : 'transparent',
                    borderColor: isRevealed
                      ? 'rgba(102,126,234,0.35)'
                      : 'transparent',
                    ...(isRevealed
                      ? { animation: `glow-pulse 2s ease-in-out infinite, fade-in-up 0.6s ease-out both` }
                      : {}),
                  }}
                >
                  {/* Pod label */}
                  <div
                    className="transition-all duration-500 mb-3"
                    style={{
                      opacity: isRevealed ? 1 : 0,
                      transform: isRevealed ? 'translateY(0)' : 'translateY(-8px)',
                    }}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-[#667eea]">
                      Pod {podIdx + 1}
                    </span>
                  </div>

                  {/* Player tiles in the pod */}
                  <div className="flex flex-wrap gap-4 justify-center">
                    {pod.player_ids.map((pid, playerIdx) => {
                      const player = event.players.find((p) => p.player_id === pid);
                      if (!player) return null;
                      return (
                        <div
                          key={pid}
                          className="shuffle-tile"
                          style={{
                            opacity: phase === 'resolve' ? 0.5 : 1,
                            transitionDelay: `${playerIdx * 80}ms`,
                          }}
                        >
                          <PlayerTile player={player} glowing={isRevealed} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ready indicator */}
      {phase === 'done' && (
        <div
          className="mt-8 px-6 py-2 rounded-full border border-[#51CF66]/40 bg-[#51CF66]/10"
          style={{ animation: 'fade-in-up 0.4s ease-out both' }}
        >
          <span className="text-sm font-semibold text-[#51CF66] tracking-wide">
            Ready!
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Player Tile ────────────────────────────────────────────────

function PlayerTile({ player, glowing = false }: { player: EventPlayer; glowing?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-full"
        style={glowing ? { animation: 'glow-pulse 2s ease-in-out infinite' } : undefined}
      >
        <PlayerAvatar
          playerName={player.player_name}
          customAvatar={player.avatar}
          size="small"
          className="!w-12 !h-12 !text-lg border-2 border-[#2C2E33]"
        />
      </div>
      <span className="text-xs text-white font-medium text-center truncate max-w-[80px]">
        {player.player_name}
      </span>
    </div>
  );
}
