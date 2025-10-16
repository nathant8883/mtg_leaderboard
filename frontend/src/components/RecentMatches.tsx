import type { Match } from '../services/api';

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

  const getWinner = (match: Match) => {
    return match.players.find(p => p.is_winner);
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
      <div className="match-list">
        {matches.map((match) => {
          const winner = getWinner(match);
          const playerNames = match.players.map(p => p.player_name).join(' • ');

          return (
            <div key={match.id} className="match-item">
              <div>
                <div className="match-players">{playerNames}</div>
                <div className="match-deck">{winner?.deck_name || 'Unknown Deck'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="match-winner">🏆 {winner?.player_name || 'Unknown'}</div>
                <div className="match-date">{formatDate(match.match_date)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecentMatches;
