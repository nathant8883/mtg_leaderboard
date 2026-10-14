import type { SeasonBadgeRef } from '../services/api';
import { getSeasonBadgeStyle, seasonName, shortBadgeLabel, sortBadges } from '../utils/seasonBadges';

interface SeasonBadgeChipsProps {
  badges?: SeasonBadgeRef[];
  /** Max chips before collapsing into "+N" */
  max?: number;
  className?: string;
}

/** Compact inline season badges ("👑 S1 #1") for leaderboard rows and deck cards. */
function SeasonBadgeChips({ badges, max = 2, className = '' }: SeasonBadgeChipsProps) {
  if (!badges || badges.length === 0) return null;

  const sorted = sortBadges(badges);
  const shown = sorted.slice(0, max);
  const hidden = sorted.length - shown.length;

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {shown.map(badge => {
        const style = getSeasonBadgeStyle(badge);
        return (
          <span
            key={`${badge.season}-${badge.award_type}-${badge.placement}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded-full text-[10px] font-bold leading-4 whitespace-nowrap border"
            style={{ color: style.color, borderColor: `${style.color}55`, background: `${style.color}14` }}
            title={`${seasonName(badge.season)} ${style.label}`}
          >
            <span aria-hidden>{style.emoji}</span>
            {shortBadgeLabel(badge)}
          </span>
        );
      })}
      {hidden > 0 && (
        <span className="text-[10px] font-semibold text-[#909296]" title={`${hidden} more season badges`}>
          +{hidden}
        </span>
      )}
    </span>
  );
}

export default SeasonBadgeChips;
