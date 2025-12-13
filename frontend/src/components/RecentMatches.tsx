import { Trophy, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Match, Deck, EloHistoryPoint } from '../services/api';
import type { PendingMatch } from '../types/matchTypes';
import { getColorIdentityStyle } from '../utils/manaColors';

// Enhanced match player with commander image and ELO data
interface EnrichedMatchPlayer {
  player_id: string;
  player_name: string;
  deck_id: string;
  deck_name: string;
  deck_colors: string[];
  elimination_order?: number;
  is_winner: boolean;
  commander_image_url?: string;
  elo_change?: number;
  elo_after?: number;
  went_first?: boolean;
}

interface RecentMatchesProps {
  matches: (Match | PendingMatch)[];
  deckMap?: Map<string, Deck>;
  eloHistoryByPlayer?: Map<string, EloHistoryPoint[]>;
  loading?: boolean;
  onViewAll?: () => void;
}

/**
 * Type guard to check if a match is pending
 */
function isPendingMatch(match: Match | PendingMatch): match is PendingMatch {
  return '_pending' in match && match._pending === true;
}

/**
 * Format relative time from date string
 */
function formatRelativeTime(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const matchDate = new Date(year, month - 1, day);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - matchDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return matchDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format duration from seconds
 */
function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Get placement badge color class
 */
function getPlacementColor(order: number): string {
  if (order === 2) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800';
  if (order === 3) return 'bg-gradient-to-br from-amber-600 to-amber-700 text-white';
  return 'bg-[#2C2E33] text-[#909296]';
}

/**
 * Commander artwork with color identity border
 */
function CommanderArtwork({
  imageUrl,
  deckColors,
  size = 'large',
}: {
  imageUrl?: string;
  deckColors: string[];
  size?: 'large' | 'small';
}) {
  const wrapperPadding = size === 'large' ? 'p-[3px]' : 'p-[2px]';
  const wrapperRadius = size === 'large' ? 'rounded-[11px]' : 'rounded-[8px]';
  const innerSize = size === 'large' ? 'w-[94px] h-[94px]' : 'w-[44px] h-[44px]';
  const innerRadius = size === 'large' ? 'rounded-[8px]' : 'rounded-[6px]';

  if (imageUrl) {
    return (
      <div
        className={`deck-color-border-wrapper ${wrapperPadding} ${wrapperRadius} flex-shrink-0`}
        style={getColorIdentityStyle(deckColors)}
      >
        <div className={`${innerSize} ${innerRadius} overflow-hidden bg-[#1A1B1E]`}>
          <img
            src={imageUrl}
            alt="Commander"
            className="w-full h-full object-cover object-[center_20%]"
          />
        </div>
      </div>
    );
  }

  // Fallback: color gradient fill when no image
  const colorMap: Record<string, string> = {
    W: '#F8F6D8',
    U: '#0E68AB',
    B: '#150B00',
    R: '#D3202A',
    G: '#00733E',
  };

  const colors = deckColors.length > 0 ? deckColors : ['W', 'U', 'B', 'R', 'G'];
  const gradient = colors.length === 1
    ? colorMap[colors[0]] || '#2C2E33'
    : `linear-gradient(135deg, ${colors.map((c, i) => `${colorMap[c] || '#2C2E33'} ${(i / (colors.length - 1)) * 100}%`).join(', ')})`;

  return (
    <div
      className={`deck-color-border-wrapper ${wrapperPadding} ${wrapperRadius} flex-shrink-0`}
      style={getColorIdentityStyle(deckColors)}
    >
      <div
        className={`${innerSize} ${innerRadius} flex items-center justify-center`}
        style={{ background: gradient }}
      >
        <span className="text-2xl opacity-50">🎴</span>
      </div>
    </div>
  );
}

/**
 * ELO change badge component
 */
function EloBadge({ change, currentElo }: { change?: number; currentElo?: number }) {
  if (change === undefined || change === null) return null;

  const isPositive = change >= 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
  const bgClass = isPositive ? 'bg-green-400/10' : 'bg-red-400/10';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`${colorClass} ${bgClass} px-2 py-0.5 rounded-full text-xs font-semibold`}>
        {isPositive ? '+' : ''}{Math.round(change)}
      </span>
      {currentElo !== undefined && (
        <span className="text-[#909296] text-xs">({Math.round(currentElo)})</span>
      )}
    </div>
  );
}

/**
 * "Went first" indicator badge
 */
function WentFirstBadge() {
  return (
    <span className="bg-[rgba(102,126,234,0.2)] text-[#667eea] px-1.5 py-0.5 rounded text-[10px] font-semibold">
      1st
    </span>
  );
}

/**
 * Winner section - prominent display at top of match card
 */
function WinnerSection({
  player,
  isPending,
}: {
  player: EnrichedMatchPlayer;
  isPending: boolean;
}) {
  return (
    <div className="flex gap-4 p-3 rounded-[8px] bg-gradient-to-r from-[rgba(255,165,0,0.08)] to-transparent border-l-[3px] border-[rgba(255,165,0,0.5)]">
      <CommanderArtwork
        imageUrl={player.commander_image_url}
        deckColors={player.deck_colors}
        size="large"
      />
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-4 h-4 text-[#FFA500] flex-shrink-0" />
          <span className="text-white font-semibold text-[15px] truncate">
            {player.player_name}
          </span>
          {player.went_first && <WentFirstBadge />}
        </div>
        <div className="text-[#909296] text-sm truncate mb-2">
          {player.deck_name}
        </div>
        {isPending ? (
          <span className="text-[#FFA500] text-xs">Calculating ELO...</span>
        ) : (
          <EloBadge change={player.elo_change} currentElo={player.elo_after} />
        )}
      </div>
    </div>
  );
}

/**
 * Player placement card for non-winners
 */
function PlayerPlacement({
  player,
  placement,
  isPending,
}: {
  player: EnrichedMatchPlayer;
  placement: number;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2 bg-[rgba(37,38,43,0.3)] rounded-[8px]">
      {/* Artwork with placement badge */}
      <div className="relative flex-shrink-0">
        <CommanderArtwork
          imageUrl={player.commander_image_url}
          deckColors={player.deck_colors}
          size="small"
        />
        <div
          className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${getPlacementColor(placement)}`}
        >
          {placement}
        </div>
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-sm font-medium truncate">
            {player.player_name}
          </span>
          {player.went_first && <WentFirstBadge />}
        </div>
        <div className="text-[#909296] text-xs truncate">
          {player.deck_name}
        </div>
      </div>

      {/* ELO change */}
      <div className="flex-shrink-0">
        {isPending ? (
          <span className="text-[#909296] text-xs">---</span>
        ) : (
          <EloBadge change={player.elo_change} currentElo={player.elo_after} />
        )}
      </div>
    </div>
  );
}

/**
 * Placement grid for non-winner players
 */
function PlacementGrid({
  players,
  isPending,
}: {
  players: EnrichedMatchPlayer[];
  isPending: boolean;
}) {
  if (players.length === 0) return null;

  // Mobile-first: single column on mobile, adapt on larger screens
  // sm breakpoint (640px) switches to multi-column
  let gridClass = 'grid gap-2 grid-cols-1';
  if (players.length === 2) {
    gridClass += ' sm:grid-cols-2';
  } else if (players.length === 3) {
    gridClass += ' sm:grid-cols-3';
  } else if (players.length >= 4) {
    gridClass += ' sm:grid-cols-2';
  }

  return (
    <div className={gridClass}>
      {players.map((player, index) => (
        <PlayerPlacement
          key={`${player.player_id}-${player.deck_id}`}
          player={player}
          placement={player.elimination_order || index + 2}
          isPending={isPending}
        />
      ))}
    </div>
  );
}

/**
 * Individual match card with podium layout
 */
function MatchCard({
  match,
  isPending,
  enrichedPlayers,
  onClick,
}: {
  match: Match | PendingMatch;
  isPending: boolean;
  enrichedPlayers: EnrichedMatchPlayer[];
  onClick?: () => void;
}) {
  const durationText = formatDuration(match.duration_seconds);
  const dateText = formatRelativeTime(match.match_date);

  // Find winner and non-winners
  const winner = enrichedPlayers.find((p) => p.is_winner);
  const nonWinners = enrichedPlayers
    .filter((p) => !p.is_winner)
    .sort((a, b) => {
      // Sort by elimination order if available, otherwise alphabetically
      if (a.elimination_order && b.elimination_order) {
        return a.elimination_order - b.elimination_order;
      }
      return a.player_name.localeCompare(b.player_name);
    });

  // Check if this is a 1v1 match
  const is1v1 = enrichedPlayers.length === 2;

  return (
    <div
      className={`bg-[rgba(37,38,43,0.5)] rounded-[12px] p-4 border transition-all duration-200 ${
        isPending
          ? 'border-[rgba(255,165,0,0.4)] bg-[rgba(255,165,0,0.05)]'
          : 'border-[#2C2E33] hover:bg-[#25262B] hover:border-[#667eea] cursor-pointer'
      }`}
      onClick={() => !isPending && onClick?.()}
    >
      {/* Pending Badge */}
      {isPending && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[rgba(255,165,0,0.2)]">
          <Loader2 className="w-4 h-4 text-[#FFA500] animate-spin" />
          <span className="text-[#FFA500] text-xs font-semibold">
            Syncing to server...
          </span>
        </div>
      )}

      {/* Header: Time info */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-[#909296] text-xs">{dateText}</span>
        <div className="flex items-center gap-2 text-xs text-[#909296]">
          {is1v1 && (
            <span className="bg-[rgba(102,126,234,0.2)] text-[#667eea] px-2 py-0.5 rounded-full text-[10px] font-semibold">
              1v1
            </span>
          )}
          {durationText && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {durationText}
            </span>
          )}
        </div>
      </div>

      {/* Winner Section */}
      {winner && (
        <div className="mb-3">
          <WinnerSection player={winner} isPending={isPending} />
        </div>
      )}

      {/* Non-winner Placements */}
      {!is1v1 && nonWinners.length > 0 && (
        <PlacementGrid players={nonWinners} isPending={isPending} />
      )}
    </div>
  );
}

/**
 * Main RecentMatches component
 */
function RecentMatches({
  matches,
  deckMap,
  eloHistoryByPlayer,
  loading = false,
  onViewAll,
}: RecentMatchesProps) {
  const navigate = useNavigate();

  /**
   * Enrich match players with commander images and ELO data
   */
  const enrichPlayers = (match: Match | PendingMatch): EnrichedMatchPlayer[] => {
    return match.players.map((player, index) => {
      // Get commander image from deck map
      const deck = deckMap?.get(player.deck_id);
      const commander_image_url = deck?.commander_image_url;

      // Get ELO data from history
      let elo_change: number | undefined;
      let elo_after: number | undefined;

      if (eloHistoryByPlayer && match.id) {
        const playerHistory = eloHistoryByPlayer.get(player.player_id);
        if (playerHistory) {
          const historyEntry = playerHistory.find((h) => h.match_id === match.id);
          if (historyEntry) {
            elo_change = historyEntry.change;
            elo_after = historyEntry.elo;
          }
        }
      }

      // Check if this player went first
      const went_first = match.first_player_position === index;

      return {
        ...player,
        commander_image_url,
        elo_change,
        elo_after,
        went_first,
      };
    });
  };

  const handleMatchClick = (matchId: string) => {
    navigate(`/matches/${matchId}`);
  };

  // Header with optional "View All" link
  const Header = () => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-white m-0 text-2xl font-semibold">Recent Matches</h2>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="text-[#667eea] text-sm font-medium hover:text-[#764ba2] transition-colors"
        >
          View All
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <Header />
        <div className="text-center py-[60px] px-5">
          <div className="loading-spinner"></div>
          <p className="text-[#909296] text-sm">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <Header />
        <div className="text-center py-[60px] px-5">
          <div className="text-[64px] mb-4">🏆</div>
          <h3 className="text-white text-xl mb-2">No matches yet</h3>
          <p className="text-[#909296] text-sm">Record your first match to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
      <Header />
      <div className="flex flex-col gap-4">
        {matches.map((match) => {
          const isPending = isPendingMatch(match);
          const enrichedPlayers = enrichPlayers(match);

          return (
            <MatchCard
              key={match.id}
              match={match}
              isPending={isPending}
              enrichedPlayers={enrichedPlayers}
              onClick={() => match.id && handleMatchClick(match.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default RecentMatches;
