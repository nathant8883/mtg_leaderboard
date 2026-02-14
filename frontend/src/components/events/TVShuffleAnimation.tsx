import { useState, useEffect, useRef } from 'react';
import type { TournamentEvent, StandingsEntry } from '../../services/api';
import PlayerAvatar from '../PlayerAvatar';

type AnimationType = 'shuffle' | 'reseed';
type AnimationPhase = 'scatter' | 'sort' | 'form-pods' | 'reveal' | 'done';

interface TVShuffleAnimationProps {
  event: TournamentEvent;
  animationType: AnimationType;
  previousStandings?: StandingsEntry[];
  onComplete: () => void;
}

export function TVShuffleAnimation({
  event,
  animationType,
  previousStandings,
  onComplete,
}: TVShuffleAnimationProps) {
  const [phase, setPhase] = useState<AnimationPhase>('scatter');
  const completedRef = useRef(false);

  // Get the new round's pods
  const currentRound = event.rounds.find((r) => r.round_number === event.current_round);
  const pods = currentRound?.pods ?? [];

  // Phase timing
  useEffect(() => {
    const timers =
      animationType === 'shuffle'
        ? [
            setTimeout(() => setPhase('form-pods'), 2000),
            setTimeout(() => setPhase('reveal'), 3500),
            setTimeout(() => {
              setPhase('done');
              if (!completedRef.current) {
                completedRef.current = true;
                onComplete();
              }
            }, 5000),
          ]
        : [
            // reseed: scatter -> sort -> form-pods -> reveal -> done
            setTimeout(() => setPhase('sort'), 2000),
            setTimeout(() => setPhase('form-pods'), 3500),
            setTimeout(() => setPhase('reveal'), 5000),
            setTimeout(() => {
              setPhase('done');
              if (!completedRef.current) {
                completedRef.current = true;
                onComplete();
              }
            }, 6500),
          ];

    return () => timers.forEach(clearTimeout);
  }, [animationType, onComplete]);

  // Sort standings for re-seed display
  const sortedStandings = previousStandings
    ? [...previousStandings].sort((a, b) => b.total_points - a.total_points)
    : [];

  const rankColor = (idx: number) =>
    idx === 0 ? 'text-[#FFD700]' : idx === 1 ? 'text-[#C0C0C0]' : idx === 2 ? 'text-[#CD7F32]' : 'text-[#909296]';

  const findPlayer = (pid: string) => event.players.find((p) => p.player_id === pid);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full overflow-hidden">
      {/* Inline keyframes */}
      <style>{`
        @keyframes tv-shuffle-bounce {
          0%   { transform: translateY(0)     scale(1)    rotate(0deg);  opacity: 1;   }
          20%  { transform: translateY(-18px) scale(1.06) rotate(-3deg); opacity: 0.8; }
          40%  { transform: translateY(8px)   scale(0.94) rotate(2deg);  opacity: 1;   }
          60%  { transform: translateY(-12px) scale(1.03) rotate(-1.5deg); opacity: 0.85; }
          80%  { transform: translateY(5px)   scale(0.97) rotate(1deg);  opacity: 1;   }
          100% { transform: translateY(-4px)  scale(1.01) rotate(-0.5deg); opacity: 0.9; }
        }

        @keyframes tv-glow-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(102,126,234,0.3); }
          50%      { box-shadow: 0 0 24px rgba(102,126,234,0.6); }
        }

        @keyframes tv-fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes tv-title-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }

        @keyframes tv-slide-to-rank {
          from { opacity: 0.6; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .tv-shuffle-tile {
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tv-pod-container {
          animation: tv-fade-in-up 0.6s ease-out both;
        }
      `}</style>

      {/* Title */}
      <h2 className="text-3xl font-bold text-white mb-10 text-center">
        {animationType === 'shuffle' && phase === 'scatter' && (
          <span style={{ animation: 'tv-title-pulse 1.2s ease-in-out infinite' }} className="inline-block">
            Shuffling Players...
          </span>
        )}
        {animationType === 'reseed' && phase === 'scatter' && (
          <span style={{ animation: 'tv-title-pulse 1.2s ease-in-out infinite' }} className="inline-block">
            Re-seeding by Standings...
          </span>
        )}
        {animationType === 'reseed' && phase === 'sort' && (
          <span className="text-[#667eea]">Ranking Players...</span>
        )}
        {phase === 'form-pods' && (
          <span className="text-[#667eea]">Forming Pods...</span>
        )}
        {(phase === 'reveal' || phase === 'done') && (
          <span className="text-[#51CF66]">Pods Assigned!</span>
        )}
      </h2>

      {/* Animation container */}
      <div className="relative w-full max-w-4xl px-6">
        {/* Phase: Scatter (shuffle bounce grid) */}
        {phase === 'scatter' && (
          <div className={`grid ${event.players.length <= 4 ? 'grid-cols-2' : event.players.length <= 8 ? 'grid-cols-4' : 'grid-cols-4'} gap-6 justify-items-center`}>
            {event.players.map((player, i) => (
              <div
                key={player.player_id}
                className="tv-shuffle-tile"
                style={{
                  animation: `tv-shuffle-bounce ${0.5 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                  animationDelay: `${(i * 0.12) % 0.8}s`,
                }}
              >
                <TVPlayerTile player={player} />
              </div>
            ))}
          </div>
        )}

        {/* Phase: Sort (re-seed only) — ranked column */}
        {phase === 'sort' && animationType === 'reseed' && (
          <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
            {sortedStandings.map((entry, idx) => {
              const player = findPlayer(entry.player_id);
              if (!player) return null;
              return (
                <div
                  key={entry.player_id}
                  className="flex items-center gap-4 w-full px-4 py-2 rounded-[10px] bg-[#1A1B1E]/80 border border-[#2C2E33]"
                  style={{
                    animation: `tv-slide-to-rank 0.5s ease-out both`,
                    animationDelay: `${idx * 120}ms`,
                  }}
                >
                  <span className={`text-xl font-bold w-8 text-center ${rankColor(idx)}`}>
                    {idx + 1}
                  </span>
                  <PlayerAvatar
                    playerName={player.player_name}
                    customAvatar={player.avatar}
                    size="small"
                    className="!w-10 !h-10 !text-base border-2 border-[#2C2E33]"
                  />
                  <span className="text-base text-white font-semibold flex-1 truncate">
                    {player.player_name}
                  </span>
                  <span className="text-sm font-bold text-[#667eea]">{entry.total_points} pts</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Phase: Form pods / Reveal / Done — players grouped into pods */}
        {(phase === 'form-pods' || phase === 'reveal' || phase === 'done') && (
          <div className={`grid ${pods.length === 1 ? 'grid-cols-1' : pods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-6`}>
            {pods.map((pod, podIdx) => {
              const isRevealed = phase === 'reveal' || phase === 'done';

              return (
                <div
                  key={podIdx}
                  className="tv-pod-container rounded-[12px] border p-5 transition-all duration-700"
                  style={{
                    animationDelay: `${podIdx * 200}ms`,
                    background: isRevealed
                      ? 'linear-gradient(135deg, rgba(26,27,30,0.95) 0%, rgba(28,29,33,0.95) 100%)'
                      : 'rgba(26,27,30,0.5)',
                    borderColor: isRevealed
                      ? 'rgba(102,126,234,0.4)'
                      : 'rgba(44,46,51,0.5)',
                    ...(isRevealed
                      ? { animation: `tv-glow-pulse 2s ease-in-out infinite, tv-fade-in-up 0.6s ease-out both`, animationDelay: `${podIdx * 200}ms` }
                      : {}),
                  }}
                >
                  {/* Pod label */}
                  <div
                    className="transition-all duration-500 mb-4"
                    style={{
                      opacity: isRevealed ? 1 : 0.5,
                      transform: isRevealed ? 'translateY(0)' : 'translateY(-6px)',
                    }}
                  >
                    <span className="text-sm font-bold uppercase tracking-widest text-[#667eea]">
                      Pod {podIdx + 1}
                    </span>
                  </div>

                  {/* Player tiles */}
                  <div className="flex flex-col gap-3">
                    {pod.player_ids.map((pid, playerIdx) => {
                      const player = findPlayer(pid);
                      if (!player) return null;

                      // For re-seed, show points badge
                      const standingEntry = previousStandings?.find((s) => s.player_id === pid);

                      return (
                        <div
                          key={pid}
                          className="tv-shuffle-tile flex items-center gap-3"
                          style={{
                            opacity: phase === 'form-pods' ? 0.6 : 1,
                            transitionDelay: `${playerIdx * 100}ms`,
                          }}
                        >
                          <PlayerAvatar
                            playerName={player.player_name}
                            customAvatar={player.avatar}
                            size="small"
                            className="!w-10 !h-10 !text-base border-2 border-[#2C2E33]"
                          />
                          <span className="text-base text-white font-medium truncate flex-1">
                            {player.player_name}
                          </span>
                          {animationType === 'reseed' && standingEntry && (
                            <span className="text-xs font-bold text-[#667eea] bg-[#667eea]/10 px-2 py-0.5 rounded-full">
                              {standingEntry.total_points} pts
                            </span>
                          )}
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
          className="mt-10 px-8 py-3 rounded-full border border-[#51CF66]/40 bg-[#51CF66]/10"
          style={{ animation: 'tv-fade-in-up 0.4s ease-out both' }}
        >
          <span className="text-base font-semibold text-[#51CF66] tracking-wide">
            Ready!
          </span>
        </div>
      )}
    </div>
  );
}

// ─── TV Player Tile ─────────────────────────────────────────────

function TVPlayerTile({ player }: { player: { player_id: string; player_name: string; avatar?: string } }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <PlayerAvatar
        playerName={player.player_name}
        customAvatar={player.avatar}
        size="small"
        className="!w-14 !h-14 !text-xl border-2 border-[#2C2E33]"
      />
      <span className="text-sm text-white font-medium text-center truncate max-w-[100px]">
        {player.player_name}
      </span>
    </div>
  );
}
