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
        setSelectedDeckId(playerDecks[0].id!);
      }
    } catch (err) {
      console.error('Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedDeckId) return;

    const selectedDeck = decks.find((d) => d.id === selectedDeckId);
    if (selectedDeck) {
      onSelect({
        deckId: selectedDeck.id!,
        deckName: selectedDeck.name,
        commander: selectedDeck.commander,
        commanderImageUrl: selectedDeck.commander_image_url || '',
        colors: selectedDeck.colors,
      });
    }
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

  return (
    <div className="modal-overlay">
      <div className="modal-content deck-selector-modal">
        <h2>Select Deck for {playerName}</h2>

        <div className="deck-wheel-container">
          <div className="deck-wheel">
            {decks.map((deck) => (
              <button
                key={deck.id}
                className={`deck-wheel-card ${selectedDeckId === deck.id ? 'selected' : ''}`}
                onClick={() => setSelectedDeckId(deck.id!)}
              >
                <div className="deck-card-image">
                  {deck.commander_image_url ? (
                    <img
                      src={deck.commander_image_url}
                      alt={deck.commander}
                      className="commander-image"
                    />
                  ) : (
                    <div className="commander-placeholder">🎴</div>
                  )}
                </div>
                <div className="deck-card-info">
                  <div className="deck-card-name">{deck.name}</div>
                  <div className="deck-card-commander">{deck.commander}</div>
                  <div className="deck-card-colors">
                    <ColorPips colors={deck.colors} />
                  </div>
                </div>
                {selectedDeckId === deck.id && (
                  <div className="deck-selected-indicator">✓</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!selectedDeckId}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeckWheelSelector;
