import type { Deck, Player } from '../services/api';
import ColorPips from './ColorPips';

interface DeckListProps {
  decks: Deck[];
  players: Player[];
  matchCounts?: Record<string, number>;
  onEdit: (deck: Deck) => void;
  onDelete: (deckId: string) => void;
}

function DeckList({ decks, players, matchCounts = {}, onEdit, onDelete }: DeckListProps) {
  const getPlayerName = (playerId: string): string => {
    const player = players.find((p) => p.id === playerId);
    return player ? player.name : 'Unknown Player';
  };

  const handleDelete = (deck: Deck) => {
    if (window.confirm(`Are you sure you want to permanently delete "${deck.name}"? This action cannot be undone.`)) {
      onDelete(deck.id!);
    }
  };

  if (decks.length === 0) {
    return (
      <div className="text-center py-[60px] px-5">
        <div className="text-[64px] mb-4">🎴</div>
        <h3 className="text-white text-xl mb-2">No Decks Yet</h3>
        <p className="text-[#909296] text-sm">Create your first deck to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-left uppercase border-b border-[#2C2E33]">Commander</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-left uppercase border-b border-[#2C2E33]">Deck Name</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-left uppercase border-b border-[#2C2E33]">Commander Name</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-left uppercase border-b border-[#2C2E33]">Player</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Colors</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Status</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {decks.map((deck) => (
            <tr
              key={deck.id}
              className={`transition-all duration-200 hover:bg-[#25262B] ${deck.disabled ? 'opacity-60' : ''}`}
            >
              <td className="py-4 px-3 border-b border-[#2C2E33]">
                {deck.commander_image_url ? (
                  <div className="w-[60px] h-[60px] rounded-[8px] overflow-hidden border-2 border-[#2C2E33] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                    <img
                      src={deck.commander_image_url}
                      alt={deck.commander}
                      className="w-full h-full object-cover object-[center_20%]"
                    />
                  </div>
                ) : (
                  <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white inline-flex items-center justify-center text-lg font-semibold">
                    🎴
                  </div>
                )}
              </td>
              <td className="py-4 px-3 border-b border-[#2C2E33]">
                <span className="text-white font-medium text-[15px]">{deck.name}</span>
              </td>
              <td className="py-4 px-3 border-b border-[#2C2E33]">
                <span className="text-white font-medium text-[15px]">{deck.commander}</span>
              </td>
              <td className="py-4 px-3 border-b border-[#2C2E33]">
                <span className="text-[#C1C2C5] font-medium">{getPlayerName(deck.player_id)}</span>
              </td>
              <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                {deck.colors.length > 0 ? <ColorPips colors={deck.colors} /> : '-'}
              </td>
              <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                {deck.disabled ? (
                  <span className="status-badge status-disabled">Disabled</span>
                ) : (
                  <span className="status-badge status-active">Active</span>
                )}
              </td>
              <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => onEdit(deck)}
                    className="bg-transparent border-none text-lg cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:bg-[rgba(102,126,234,0.2)] hover:scale-110"
                    title="Edit deck"
                  >
                    ✏️
                  </button>
                  {!matchCounts[deck.id!] && (
                    <button
                      onClick={() => handleDelete(deck)}
                      className="bg-transparent border-none text-lg cursor-pointer py-1 px-2 rounded transition-all duration-200 hover:bg-[rgba(102,126,234,0.2)] hover:scale-110"
                      title="Delete deck"
                    >
                      🗑️
                    </button>
                  )}
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
