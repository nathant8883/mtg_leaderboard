import type { Deck, Player } from '../services/api';
import ColorPips from './ColorPips';

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
            <th className="center">Status</th>
            <th className="center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {decks.map((deck) => (
            <tr key={deck.id} className={deck.disabled ? 'deck-row-disabled' : ''}>
              <td>
                {deck.commander_image_url ? (
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '2px solid #2C2E33',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    <img
                      src={deck.commander_image_url}
                      alt={deck.commander}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center 20%',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="player-avatar-badge"
                    style={{ width: '60px', height: '60px' }}
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
                {deck.colors.length > 0 ? <ColorPips colors={deck.colors} /> : '-'}
              </td>
              <td className="center">
                {deck.disabled ? (
                  <span className="status-badge status-disabled">Disabled</span>
                ) : (
                  <span className="status-badge status-active">Active</span>
                )}
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
