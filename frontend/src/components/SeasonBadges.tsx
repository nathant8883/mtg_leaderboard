import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SeasonAward } from '../services/api';
import { getSeasonBadgeStyle, sortBadges } from '../utils/seasonBadges';
import ColorPips from './ColorPips';

interface SeasonBadgesProps {
  awards: SeasonAward[];
  /** Show which pod each badge came from (player belongs to several pods) */
  showPod?: boolean;
}

function BadgeIcon({ award, size = 48 }: { award: SeasonAward; size?: number }) {
  const style = getSeasonBadgeStyle(award);
  return (
    <div
      className="relative rounded-full border-[3px] overflow-hidden bg-[#25262B] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderColor: style.color, boxShadow: `0 0 10px ${style.glow}` }}
    >
      {award.award_type === 'deck_placement' && award.commander_image_url ? (
        <img src={award.commander_image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.45 }} aria-hidden>{style.emoji}</span>
      )}
    </div>
  );
}

/** Season award medals for the profile Badges card (renders badge buttons only). */
function SeasonBadges({ awards, showPod = false }: SeasonBadgesProps) {
  const [active, setActive] = useState<SeasonAward | null>(null);

  if (awards.length === 0) return null;

  const activeStyle = active ? getSeasonBadgeStyle(active) : null;

  return (
    <>
      {sortBadges(awards).map(award => {
          const style = getSeasonBadgeStyle(award);
          return (
            <button
              key={award.id}
              onClick={() => setActive(award)}
              className="relative bg-transparent border-none p-0 cursor-pointer transition-transform hover:scale-110 active:scale-95"
              title={`Season ${award.season} ${style.label}${award.deck_name ? ` - ${award.deck_name}` : ''}`}
            >
              <BadgeIcon award={award} />
              {/* Season number overlay */}
              <span
                className="absolute -bottom-0.5 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold leading-none border-2 border-[#1A1B1E] text-[#1A1B1E]"
                style={{ background: style.color }}
              >
                S{award.season}
              </span>
            </button>
          );
        })}

      {/* Bottom drawer - portal to escape scroll containers */}
      {active && activeStyle && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 flex items-end md:items-center justify-center"
          style={{ zIndex: 9999, height: '100dvh', width: '100vw' }}
          onClick={() => setActive(null)}
        >
          <div
            className="bg-[#1A1B1E] w-full md:w-auto md:min-w-[360px] md:max-w-md md:rounded-xl rounded-t-xl border border-[#2C2E33] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2C2E33]">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeStyle.emoji}</span>
                <span className="text-white font-semibold">Season {active.season} {activeStyle.label}</span>
              </div>
              <button
                onClick={() => setActive(null)}
                className="p-2 -mr-2 text-[#909296] active:bg-[#2C2E33] rounded-lg bg-transparent border-none cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                <BadgeIcon award={active} />
                <div className="min-w-0">
                  <div className="text-white font-semibold text-base truncate">
                    {active.deck_name ?? active.player_name}
                  </div>
                  {active.commander && (
                    <div className="text-[#909296] text-sm truncate">{active.commander}</div>
                  )}
                  {active.colors.length > 0 && <div className="mt-1"><ColorPips colors={active.colors} /></div>}
                  {showPod && active.pod_name && (
                    <div className="text-[#909296] text-xs mt-0.5">{active.pod_name}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {active.award_type === 'peak_elo' ? (
                  <div className="p-3 bg-[#141517] rounded-lg text-center">
                    <div className="text-lg font-bold" style={{ color: activeStyle.color }}>{active.stats.peak_elo ?? '-'}</div>
                    <div className="text-[#909296] text-xs mt-0.5">Peak Elo</div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#141517] rounded-lg text-center">
                    <div className="text-lg font-bold" style={{ color: activeStyle.color }}>#{active.placement}</div>
                    <div className="text-[#909296] text-xs mt-0.5">Finish</div>
                  </div>
                )}
                <div className="p-3 bg-[#141517] rounded-lg text-center">
                  <div className="text-lg font-bold text-white">
                    {active.stats.wins ?? 0}-{(active.stats.games_played ?? 0) - (active.stats.wins ?? 0)}
                  </div>
                  <div className="text-[#909296] text-xs mt-0.5">Record</div>
                </div>
                <div className="p-3 bg-[#141517] rounded-lg text-center">
                  {active.award_type === 'deck_placement' ? (
                    <>
                      <div className="text-lg font-bold text-[#667eea]">{active.stats.win_rate ?? 0}%</div>
                      <div className="text-[#909296] text-xs mt-0.5">Win Rate</div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-[#667eea]">{active.stats.elo ?? '-'}</div>
                      <div className="text-[#909296] text-xs mt-0.5">Final Elo</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default SeasonBadges;
