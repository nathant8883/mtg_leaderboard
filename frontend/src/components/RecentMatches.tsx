import { Trophy, Clock } from 'lucide-react';
import type { Match } from '../services/api';
import ColorPips from './ColorPips';

interface RecentMatchesProps {
  matches: Match[];
  loading?: boolean;
}

function RecentMatches({ matches, loading = false }: RecentMatchesProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    // Format as "Oct 15, 2025"
    return date.toLocaleDateString('en-US', {
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
      <div className="card">
        <h2 className="card-title">Recent Matches</h2>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading matches...</p>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Recent Matches</h2>
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h3>No matches yet</h3>
          <p>Record your first match to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Recent Matches</h2>
      <div className="recent-matches-container">
        {matches.map((match) => {
          const winner = getWinner(match);
          const durationText = formatDuration(match.duration_seconds);

          return (
            <div
              key={match.id}
              className="recent-match-card"
              onClick={() => handleMatchClick(match.id!)}
              style={{ cursor: 'pointer' }}
            >
              {/* Header Row: Winner + Time Info */}
              <div className="recent-match-header">
                <div className="recent-match-winner">
                  <Trophy className="recent-match-trophy-icon" />
                  <span className="recent-match-winner-name">{winner?.player_name || 'Unknown'}</span>
                </div>
                <div className="recent-match-time">
                  {durationText && (
                    <span className="recent-match-duration">
                      <Clock className="recent-match-clock-icon" />
                      {durationText}
                    </span>
                  )}
                  <span className="recent-match-date">{formatDate(match.match_date)}</span>
                </div>
              </div>

              {/* Winner's Deck Name */}
              <div className="recent-match-deck-name">{winner?.deck_name || 'Unknown Deck'}</div>

              {/* Player Chips Row */}
              <div className="recent-match-players">
                {match.players.map((player) => (
                  <div
                    key={`${player.player_id}-${player.deck_id}`}
                    className={`recent-match-player-chip ${player.is_winner ? 'winner' : ''}`}
                  >
                    <span className="recent-match-player-name">{player.player_name}</span>
                    <span className="recent-match-separator">•</span>
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
