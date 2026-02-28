import { useState } from 'react';
import { createPortal } from 'react-dom';
import { type EventPlacement } from '../services/api';

const PLACEMENT_CONFIG = {
  1: {
    label: '1st Place',
    emoji: '🥇',
    borderColor: '#FFD700',
    glow: 'rgba(255, 215, 0, 0.5)',
  },
  2: {
    label: '2nd Place',
    emoji: '🥈',
    borderColor: '#C0C0C0',
    glow: 'rgba(192, 192, 192, 0.4)',
  },
  3: {
    label: '3rd Place',
    emoji: '🥉',
    borderColor: '#CD7F32',
    glow: 'rgba(205, 127, 50, 0.4)',
  },
} as const;

interface EventBadgesProps {
  placements: EventPlacement[];
}

function EventBadges({ placements }: EventBadgesProps) {
  const [activePlacement, setActivePlacement] = useState<EventPlacement | null>(null);

  if (placements.length === 0) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeConfig = activePlacement
    ? PLACEMENT_CONFIG[activePlacement.placement as 1 | 2 | 3]
    : null;

  return (
    <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-3 md:p-6 mb-4 md:mb-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏆</span>
        <h3 className="text-lg font-semibold text-white">Event Badges</h3>
      </div>

      <div className="flex flex-wrap gap-3">
        {placements.map((placement) => {
          const config = PLACEMENT_CONFIG[placement.placement as 1 | 2 | 3];
          if (!config) return null;

          return (
            <button
              key={`${placement.event_id}-${placement.placement}`}
              onClick={() => setActivePlacement(placement)}
              className="relative w-12 h-12 rounded-full border-[3px] overflow-hidden bg-[#25262B] cursor-pointer transition-transform hover:scale-110 active:scale-95 flex items-center justify-center p-0"
              style={{
                borderColor: config.borderColor,
                boxShadow: `0 0 10px ${config.glow}`,
              }}
              title={`${config.label} - ${placement.event_name}`}
            >
              {/* Event icon with 3-tier resolution */}
              {placement.custom_image ? (
                <img
                  src={placement.custom_image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : placement.event_type === 'draft' && placement.set_icon_svg_uri ? (
                <img
                  src={placement.set_icon_svg_uri}
                  alt=""
                  className="w-6 h-6"
                  style={{ filter: 'invert(1)' }}
                />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={config.borderColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              )}

              {/* Placement medal overlay */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none border-2 border-[#1A1B1E]"
                style={{ background: config.borderColor }}
              >
                {placement.placement}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom drawer - portal to escape scroll containers */}
      {activePlacement && activeConfig && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 flex items-end md:items-center justify-center"
          style={{ zIndex: 9999, height: '100dvh', width: '100vw' }}
          onClick={() => setActivePlacement(null)}
        >
          <div
            className="bg-[#1A1B1E] w-full md:w-auto md:max-w-md md:rounded-xl rounded-t-xl border border-[#2C2E33] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2C2E33]">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeConfig.emoji}</span>
                <span className="text-white font-semibold">{activeConfig.label}</span>
              </div>
              <button
                onClick={() => setActivePlacement(null)}
                className="p-2 -mr-2 text-[#909296] active:bg-[#2C2E33] rounded-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                {/* Event icon */}
                <div
                  className="w-12 h-12 rounded-full border-[3px] overflow-hidden bg-[#25262B] flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: activeConfig.borderColor,
                    boxShadow: `0 0 10px ${activeConfig.glow}`,
                  }}
                >
                  {activePlacement.custom_image ? (
                    <img src={activePlacement.custom_image} alt="" className="w-full h-full object-cover" />
                  ) : activePlacement.event_type === 'draft' && activePlacement.set_icon_svg_uri ? (
                    <img src={activePlacement.set_icon_svg_uri} alt="" className="w-6 h-6" style={{ filter: 'invert(1)' }} />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeConfig.borderColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" />
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold text-base">{activePlacement.event_name}</div>
                  <div className="text-[#909296] text-sm capitalize">{activePlacement.event_type}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#141517] rounded-lg text-center">
                  <div className="text-lg font-bold" style={{ color: activeConfig.borderColor }}>
                    {activeConfig.label}
                  </div>
                  <div className="text-[#909296] text-xs mt-0.5">Placement</div>
                </div>
                <div className="p-3 bg-[#141517] rounded-lg text-center">
                  <div className="text-lg font-bold text-[#667eea]">
                    {activePlacement.total_points}
                  </div>
                  <div className="text-[#909296] text-xs mt-0.5">Points</div>
                </div>
              </div>

              {activePlacement.event_date && (
                <div className="text-[#909296] text-xs text-center">
                  {formatDate(activePlacement.event_date)}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default EventBadges;
