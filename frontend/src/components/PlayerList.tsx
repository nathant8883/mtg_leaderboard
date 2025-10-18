import type { Player } from '../services/api';

interface PlayerListProps {
  players: Player[];
  onEdit: (player: Player) => void;
  onDelete: (playerId: string) => void;
  isLoading?: boolean;
}

function PlayerList({ players, onEdit, onDelete, isLoading = false }: PlayerListProps) {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading players...</p>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-[64px] mb-4">👥</div>
        <h3>No players yet</h3>
        <p>Add your first player to get started!</p>
      </div>
    );
  }

  const handleDelete = (player: Player) => {
    if (window.confirm(`Are you sure you want to delete ${player.name}?`)) {
      onDelete(player.id!);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Avatar</th>
            <th>Player Name</th>
            <th className="center">Decks</th>
            <th className="center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>
                <div className="player-avatar-badge">
                  {player.avatar || player.name.charAt(0).toUpperCase()}
                </div>
              </td>
              <td>
                <span className="text-white font-medium text-[15px]">{player.name}</span>
              </td>
              <td className="center">
                <span className="text-[#C1C2C5] font-medium">{player.deck_ids?.length || 0}</span>
              </td>
              <td className="center">
                <div className="flex gap-2 justify-center">
                  <button
                    className="icon-btn"
                    onClick={() => onEdit(player)}
                    title="Edit player"
                  >
                    ✏️
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleDelete(player)}
                    title="Delete player"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerList;
