import { useState, useEffect } from 'react';
import { deckApi, type Deck } from '../../services/api';
import ColorPips from '../ColorPips';

export interface DeckInfo {
  deckId: string;
  deckName: string;
  commander: string;
  commanderImageUrl: string;
  colors: string[];
}

interface DeckWheelSelectorProps {
  playerId: string;
  playerName: string;
  onSelect: (deckInfo: DeckInfo) => void;
  onCancel: () => void;
}

function DeckWheelSelector({ playerId, playerName, onSelect, onCancel }: DeckWheelSelectorProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  useEffect(() => {
    loadPlayerDecks();
  }, [playerId]);

  const loadPlayerDecks = async () => {
    try {
      setLoading(true);
      const allDecks = await deckApi.getAll();
      const playerDecks = allDecks.filter((deck) => deck.player_id === playerId);
      setDecks(playerDecks);

      // Auto-select first deck if only one
      if (playerDecks.length === 1) {
        const deck = playerDecks[0];
        setTimeout(() => {
          onSelect({
            deckId: deck.id!,
            deckName: deck.name,
            commander: deck.commander,
            commanderImageUrl: deck.commander_image_url || '',
            colors: deck.colors,
          });
        }, 300);
      }
    } catch (err) {
      console.error('Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeckSelect = (deck: Deck) => {
    setSelectedDeckId(deck.id!);
    // Brief delay to show selection animation
    setTimeout(() => {
      onSelect({
        deckId: deck.id!,
        deckName: deck.name,
        commander: deck.commander,
        commanderImageUrl: deck.commander_image_url || '',
        colors: deck.colors,
      });
    }, 300);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4">
        <div className="bg-transparent border-none p-3 max-w-full w-full max-h-screen h-screen flex flex-col overflow-hidden">
          <div className="text-center py-[60px] px-5">
            <div className="loading-spinner"></div>
            <p className="text-[#909296] text-sm">Loading decks...</p>
          </div>
        </div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4">
        <div className="bg-[#1a1b1e] border border-[#2c2e33] rounded-[12px] p-6 max-w-[500px] w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">No Decks Found</h2>
          <p className="mb-4">{playerName} doesn't have any decks registered yet.</p>
          <p className="mb-6">Please add a deck from the player's profile before starting a match.</p>
          <div className="flex gap-3 mt-6">
            <button className="flex-1 py-3 px-6 border-none rounded-[8px] text-sm font-semibold cursor-pointer transition-all bg-gradient-purple text-white hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)]" onClick={onCancel}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate positions in a circle for wheel layout
  const calculatePosition = (index: number, total: number) => {
    const radius = 100; // Distance from center
    const angleStep = (2 * Math.PI) / total;
    const startAngle = 0; // Start at right (3 o'clock position)
    const angle = startAngle + (angleStep * index);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4">
      <div className="bg-transparent border-none p-3 max-w-full w-full max-h-screen h-screen flex flex-col overflow-hidden">
        <div className="text-center mb-3 bg-[rgba(26,27,30,0.95)] backdrop-blur-[10px] py-[10px] px-4 rounded-[12px] border border-[#2c2e33] flex-shrink-0">
          <h2 className="m-0 text-base font-semibold">Select Deck for {playerName}</h2>
        </div>

        <div className="flex-1 flex items-center justify-center relative overflow-visible min-h-0">
          <div className="deck-wheel">
            {/* Center circle */}
            <div className="deck-wheel-center"></div>

            {/* Deck items positioned in circle */}
            {decks.map((deck, index) => {
              const { x, y } = calculatePosition(index, decks.length);
              return (
                <button
                  key={deck.id}
                  className={`deck-wheel-item ${selectedDeckId === deck.id ? 'selected' : ''}`}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  onClick={() => handleDeckSelect(deck)}
                >
                  <div className="deck-icon-circle">
                    {deck.commander_image_url ? (
                      <img
                        src={deck.commander_image_url}
                        alt={deck.commander}
                        className="deck-commander-image"
                      />
                    ) : (
                      <div className="deck-commander-placeholder">🎴</div>
                    )}
                  </div>
                  <div className="deck-item-name">{deck.name}</div>
                  <div className="deck-item-colors">
                    <ColorPips colors={deck.colors} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeckWheelSelector;
