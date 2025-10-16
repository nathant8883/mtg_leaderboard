import type { Deck, Player } from '../services/api';

interface DeckListProps {
  decks: Deck[];
  players: Player[];
  onEdit: (deck: Deck) => void;
  onDelete: (deckId: string) => void;
}

function DeckList({ decks, players, onEdit, onDelete }: DeckListProps) {
  const getPlayerName = (playerId: string): string => {
    const player = players.find((p) => p.id === playerId);
    return player ? player.name : 'Unknown Player';
  };

  const getColorSymbols = (colorList: string[]) => {
    const colorMap: Record<string, string> = {
      W: '⚪',
      U: '🔵',
      B: '⚫',
      R: '🔴',
      G: '🟢',
    };
    return colorList.map((c) => colorMap[c] || c).join(' ');
  };

  const handleDelete = (deck: Deck) => {
    if (window.confirm(`Are you sure you want to delete "${deck.name}"? This action cannot be undone.`)) {
      onDelete(deck.id!);
    }
  };

  if (decks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎴</div>
        <h3>No Decks Yet</h3>
        <p>Create your first deck to get started</p>
      </div>
    );
  }

  return (
    <div className="player-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Commander</th>
            <th>Deck Name</th>
            <th>Commander Name</th>
            <th>Player</th>
            <th className="center">Colors</th>
            <th className="center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {decks.map((deck) => (
            <tr key={deck.id}>
              <td>
                {deck.commander_image_url ? (
                  <img
                    src={deck.commander_image_url}
                    alt={deck.commander}
                    style={{
                      width: '50px',
                      height: '70px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    className="player-avatar-badge"
                    style={{ width: '50px', height: '50px' }}
                  >
                    🎴
                  </div>
                )}
              </td>
              <td>
                <span className="player-name">{deck.name}</span>
              </td>
              <td>
                <span className="player-name">{deck.commander}</span>
              </td>
              <td>
                <span className="deck-count">{getPlayerName(deck.player_id)}</span>
              </td>
              <td className="center">
                <span style={{ fontSize: '20px' }}>
                  {deck.colors.length > 0 ? getColorSymbols(deck.colors) : '-'}
                </span>
              </td>
              <td className="center">
                <div className="action-buttons">
                  <button
                    onClick={() => onEdit(deck)}
                    className="icon-btn"
                    title="Edit deck"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(deck)}
                    className="icon-btn"
                    title="Delete deck"
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

export default DeckList;
