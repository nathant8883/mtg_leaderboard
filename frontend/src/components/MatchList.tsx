import type { Match } from '../services/api';
import ColorPips from './ColorPips';

interface MatchListProps {
  matches: Match[];
  onEdit: (match: Match) => void;
  onDelete: (matchId: string) => void;
  isLoading?: boolean;
}

function MatchList({ matches, onEdit, onDelete, isLoading = false }: MatchListProps) {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading matches...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-[64px] mb-4">🎮</div>
        <h3>No matches recorded</h3>
        <p>Record your first match to get started!</p>
      </div>
    );
  }

  const handleDelete = (match: Match) => {
    const date = new Date(match.match_date).toLocaleDateString();
    if (window.confirm(`Are you sure you want to delete the match from ${date}?`)) {
      onDelete(match.id!);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Players</th>
            <th>Winner</th>
            <th className="center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const winner = match.players.find(p => p.is_winner);
            return (
              <tr key={match.id}>
                <td>
                  <span className="text-white font-medium text-[15px]">
                    {formatDate(match.match_date)}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {match.players.map((player, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-[#25262B] border border-[#2C2E33] rounded-[6px] py-1 px-2"
                      >
                        <span className="text-[#C1C2C5] text-sm font-medium">
                          {player.player_name}
                        </span>
                        <span className="text-[#909296] text-xs">
                          ({player.deck_name})
                        </span>
                        {player.deck_colors && player.deck_colors.length > 0 && (
                          <ColorPips colors={player.deck_colors} size="small" />
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  {winner && (
                    <div className="inline-flex items-center gap-2 bg-gradient-winner rounded-[6px] py-1 px-3">
                      <span className="text-white font-semibold text-sm">
                        🏆 {winner.player_name}
                      </span>
                      {winner.deck_colors && winner.deck_colors.length > 0 && (
                        <ColorPips colors={winner.deck_colors} size="small" />
                      )}
                    </div>
                  )}
                </td>
                <td className="center">
                  <div className="flex gap-2 justify-center">
                    <button
                      className="icon-btn"
                      onClick={() => onEdit(match)}
                      title="Edit match"
                    >
                      ✏️
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleDelete(match)}
                      title="Delete match"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MatchList;
