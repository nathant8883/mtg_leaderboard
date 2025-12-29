import type { PlayerLeaderboardEntry } from '../../services/api';
import { getEloTier, type TierLetter } from '../../utils/tierConfig';
import { getColorIdentityStyle } from '../../utils/manaColors';
import PlayerAvatar from '../PlayerAvatar';
import TierBadge from '../TierBadge';
import { EloTrendIndicator } from './EloTrendIndicator';
import { RankBadgeOverlay } from './RankBadgeOverlay';

const MIN_GAMES_FOR_RANKING = 4;

interface PlayerLeaderboardCardProps {
  player: PlayerLeaderboardEntry;
  rank: number | null;
  rankedElos: number[];
  onTap: () => void;
}

export function PlayerLeaderboardCard({
  player,
  rank,
  rankedElos,
  onTap,
}: PlayerLeaderboardCardProps) {
  const isRanked = player.ranked;
  const isTopThree = rank !== null && rank <= 3;
  const gamesNeeded = MIN_GAMES_FOR_RANKING - player.games_played;

  // Get tier for colors
  const tier: TierLetter = isRanked ? getEloTier(player.elo, rankedElos) : 'D';

  // For MVP, we don't have favorite colors - use empty array for colorless border
  const favoriteColors: string[] = [];

  return (
    <div
      className="leaderboard-card-border-wrapper cursor-pointer"
      style={getColorIdentityStyle(favoriteColors)}
      onClick={onTap}
    >
      <div className="leaderboard-card p-4 relative">
        {/* Rank overlay for top 3 */}
        {isTopThree && rank && (
          <div className="absolute -top-2 -left-2 z-10">
            <RankBadgeOverlay rank={rank as 1 | 2 | 3} size="md" />
          </div>
        )}

        {/* Tier badge - top right */}
        {isRanked && (
          <div className="absolute top-3 right-3">
            <TierBadge tier={tier} size="md" />
          </div>
        )}

        {/* Header: Avatar + Name */}
        <div className="flex items-center gap-3 mb-4">
          <PlayerAvatar
            playerName={player.player_name}
            customAvatar={player.custom_avatar}
            picture={player.picture}
            size="large"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">
              {player.player_name}
            </h3>
            <p className="text-sm text-[#909296]">
              {isRanked
                ? `Rank #${rank}`
                : `Needs ${gamesNeeded} more game${gamesNeeded !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Elo + Win Rate Row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 p-3 bg-[#25262B] rounded-[10px]">
            <div className="text-[10px] uppercase text-[#909296] mb-1 tracking-wide">
              Elo Rating
            </div>
            {player.elo ? (
              <EloTrendIndicator
                elo={player.elo}
                eloChange={player.elo_change}
                tier={tier}
                size="sm"
              />
            ) : (
              <span className="text-lg font-bold text-[#909296]">—</span>
            )}
          </div>
          <div className="flex-1 p-3 bg-[#25262B] rounded-[10px]">
            <div className="text-[10px] uppercase text-[#909296] mb-1 tracking-wide">
              Win Rate
            </div>
            <span className="text-lg font-bold" style={{ color: isRanked ? '#C1C2C5' : '#909296' }}>
              {player.win_rate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-micro-grid">
          <div className="stat-micro">
            <div className="stat-micro-value">{player.games_played}</div>
            <div className="stat-micro-label">Games</div>
          </div>
          <div className="stat-micro">
            <div className="stat-micro-value">{player.wins}</div>
            <div className="stat-micro-label">Wins</div>
          </div>
          <div className="stat-micro">
            <div className="stat-micro-value">{player.losses}</div>
            <div className="stat-micro-label">Losses</div>
          </div>
          <div className="stat-micro">
            <div className="stat-micro-value">{player.deck_count}</div>
            <div className="stat-micro-label">Decks</div>
          </div>
        </div>

        {/* Unranked overlay */}
        {!isRanked && (
          <div className="absolute inset-0 rounded-[12px] bg-black/20 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export default PlayerLeaderboardCard;
