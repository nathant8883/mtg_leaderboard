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
      <div className="modal-overlay">
        <div className="modal-content deck-selector-modal">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading decks...</p>
          </div>
        </div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal-content deck-selector-modal">
          <h2>No Decks Found</h2>
          <p>{playerName} doesn't have any decks registered yet.</p>
          <p>Please add a deck from the player's profile before starting a match.</p>
          <div className="modal-actions">
            <button className="btn-primary" onClick={onCancel}>
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
    <div className="modal-overlay">
      <div className="modal-content deck-selector-modal">
        <div className="deck-wheel-header">
          <h2>Select Deck for {playerName}</h2>
        </div>

        <div className="deck-wheel-container">
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
                    <ColorPips colors={deck.colors} size="small" />
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
