import { Trophy, Clock, Loader2 } from 'lucide-react';
import type { Match } from '../services/api';
import type { PendingMatch } from '../App';
import ColorPips from './ColorPips';

interface RecentMatchesProps {
  matches: (Match | PendingMatch)[];
  loading?: boolean;
}

/**
 * Type guard to check if a match is pending
 */
function isPendingMatch(match: Match | PendingMatch): match is PendingMatch {
  return '_pending' in match && match._pending === true;
}

function RecentMatches({ matches, loading = false }: RecentMatchesProps) {
  const formatDate = (dateString: string): string => {
    // Parse date string as local date to avoid UTC timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const matchDate = new Date(year, month - 1, day); // month is 0-indexed

    // Get today's date at midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate difference in days
    const diffTime = today.getTime() - matchDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;

    // Format as "Oct 15, 2025"
    return matchDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getWinner = (match: Match) => {
    return match.players.find(p => p.is_winner);
  };

  const handleMatchClick = (matchId: string) => {
    window.dispatchEvent(new CustomEvent('viewMatchDetail', {
      detail: { matchId }
    }));
  };

  if (loading) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <h2 className="text-white m-0 text-2xl font-semibold mb-4">Recent Matches</h2>
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
        <h2 className="text-white m-0 text-2xl font-semibold mb-4">Recent Matches</h2>
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
      <h2 className="text-white m-0 text-2xl font-semibold mb-4">Recent Matches</h2>
      <div className="flex flex-col gap-4">
        {matches.map((match) => {
          const winner = getWinner(match);
          const durationText = formatDuration(match.duration_seconds);
          const isPending = isPendingMatch(match);

          return (
            <div
              key={match.id}
              className={`bg-[rgba(37,38,43,0.5)] rounded-[12px] p-4 border transition-all duration-200 cursor-pointer ${
                isPending
                  ? 'border-[rgba(255,165,0,0.4)] bg-[rgba(255,165,0,0.05)]'
                  : 'border-[#2C2E33] hover:bg-[#25262B] hover:border-[#667eea]'
              }`}
              onClick={() => !isPending && handleMatchClick(match.id!)}
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

              {/* Header Row: Winner + Time Info */}
              <div className="flex justify-between items-center mb-2 gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#FFA500] flex-shrink-0" />
                  <span className="text-[#667eea] font-semibold text-[15px]">{winner?.player_name || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#909296] flex-shrink-0">
                  {durationText && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {durationText}
                    </span>
                  )}
                  <span className="text-xs">{formatDate(match.match_date)}</span>
                </div>
              </div>

              {/* Winner's Deck Name */}
              <div className="text-[#909296] text-sm mb-3">{winner?.deck_name || 'Unknown Deck'}</div>

              {/* Player Chips Row */}
              <div className="flex flex-wrap gap-2">
                {match.players.map((player) => (
                  <div
                    key={`${player.player_id}-${player.deck_id}`}
                    className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-[16px] text-[13px] transition-all duration-200 ${
                      player.is_winner
                        ? 'bg-[rgba(102,126,234,0.2)] border border-[rgba(102,126,234,0.3)]'
                        : 'bg-[rgba(44,46,51,0.5)]'
                    }`}
                  >
                    <span className={`font-medium ${player.is_winner ? 'text-[#667eea]' : 'text-[#C1C2C5]'}`}>
                      {player.player_name}
                    </span>
                    <span className="text-[#666] text-xs">•</span>
                    <ColorPips colors={player.deck_colors || []} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecentMatches;
