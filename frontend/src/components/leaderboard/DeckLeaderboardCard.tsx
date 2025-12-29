import type { DeckLeaderboardEntry } from '../../services/api';
import { getWinRateTier, type TierLetter } from '../../utils/tierConfig';
import { getColorIdentityStyle } from '../../utils/manaColors';
import ColorPips from '../ColorPips';
import TierBadge from '../TierBadge';
import { RankBadgeOverlay } from './RankBadgeOverlay';

const MIN_GAMES_FOR_RANKING = 4;

interface DeckLeaderboardCardProps {
  deck: DeckLeaderboardEntry;
  rank: number | null;
  onTap: () => void;
}

export function DeckLeaderboardCard({
  deck,
  rank,
  onTap,
}: DeckLeaderboardCardProps) {
  const isRanked = deck.ranked;
  const isTopThree = rank !== null && rank <= 3;
  const gamesNeeded = MIN_GAMES_FOR_RANKING - deck.games_played;

  // Get tier based on win rate
  const tier: TierLetter = getWinRateTier(deck.win_rate / 100);

  return (
    <div
      className="leaderboard-card-border-wrapper cursor-pointer"
      style={getColorIdentityStyle(deck.colors)}
      onClick={onTap}
    >
      <div className="leaderboard-card p-4 relative">
        {/* Rank overlay for top 3 */}
        {isTopThree && rank && (
          <div className="absolute -top-2 -left-2 z-10">
            <RankBadgeOverlay rank={rank as 1 | 2 | 3} size="md" />
          </div>
        )}

        {/* Commander image + Info row */}
        <div className="flex gap-4 mb-4">
          {/* Commander image with color border */}
          <div
            className="commander-frame-wrapper shrink-0"
            style={getColorIdentityStyle(deck.colors)}
          >
            {deck.commander_image_url ? (
              <img
                src={deck.commander_image_url}
                alt={deck.commander}
                className="commander-frame"
              />
            ) : (
              <div className="commander-frame flex items-center justify-center bg-[#25262B] text-[#909296] text-2xl">
                🃏
              </div>
            )}
          </div>

          {/* Deck info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">
              {deck.deck_name}
            </h3>
            <p className="text-sm text-[#909296] truncate mb-2">
              {deck.commander}
            </p>
            <p className="text-xs text-[#666] mb-2">
              by {deck.player_name}
            </p>
            <ColorPips colors={deck.colors} size="md" />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3">
          <div className="stat-pill">
            <span className="stat-pill-value">{deck.games_played}</span>
            <span className="stat-pill-label">games</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-value">{deck.wins}-{deck.losses}</span>
            <span className="stat-pill-label">record</span>
          </div>
          <div className="flex-1" />

          {/* Win rate with tier */}
          {isRanked ? (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">
                {deck.win_rate.toFixed(1)}%
              </span>
              <TierBadge tier={tier} variant="compact" size="sm" />
            </div>
          ) : (
            <div className="text-xs text-[#909296] text-right">
              +{gamesNeeded} game{gamesNeeded !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Unranked overlay */}
        {!isRanked && (
          <div className="absolute inset-0 rounded-[12px] bg-black/20 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export default DeckLeaderboardCard;
