import { useState, useEffect, useMemo } from 'react';
import { deckApi, type Deck } from '../../../services/api';
import SmashHeader from './SmashHeader';
import DeckTile from './DeckTile';

interface SmashDeckSelectProps {
  seatNumber: number;
  playerCount: number; // Total players in game (for rotation calculation)
  playerId: string;
  playerName: string;
  onSelect: (deck: Deck) => void;
  onBack: () => void;
}

// Calculate optimal grid layout based on deck count
// Goal: Fill screen with no scrolling, Smash Bros style
function getGridLayout(deckCount: number): { cols: number; rows: number } {
  if (deckCount <= 2) return { cols: 2, rows: 1 };
  if (deckCount <= 4) return { cols: 2, rows: 2 };
  if (deckCount <= 6) return { cols: 3, rows: 2 };
  if (deckCount <= 8) return { cols: 4, rows: 2 };
  if (deckCount <= 9) return { cols: 3, rows: 3 };
  if (deckCount <= 12) return { cols: 4, rows: 3 };
  // For larger counts, allow some scrolling but keep reasonable tile sizes
  return { cols: 4, rows: Math.ceil(deckCount / 4) };
}

function SmashDeckSelect({
  seatNumber,
  playerCount,
  playerId,
  playerName,
  onSelect,
  onBack,
}: SmashDeckSelectProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine if this seat should be rotated (top row faces opposite direction)
  const shouldRotate = (() => {
    if (playerCount === 3 || playerCount === 4) {
      return seatNumber <= 2; // Positions 1-2 are top row
    } else if (playerCount === 5 || playerCount === 6) {
      return seatNumber <= 3; // Positions 1-3 are top row
    }
    return false;
  })();

  useEffect(() => {
    loadDecks();
  }, [playerId]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const allDecks = await deckApi.getAll();
      // Filter to only this player's enabled decks
      const playerDecks = allDecks.filter(
        (d) => d.player_id === playerId && !d.disabled
      );
      setDecks(playerDecks);

      // Auto-select if only one deck
      if (playerDecks.length === 1) {
        setTimeout(() => onSelect(playerDecks[0]), 200);
      }
    } catch (err) {
      console.error('[SmashDeckSelect] Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const gridLayout = useMemo(() => getGridLayout(decks.length), [decks.length]);

  return (
    <div className="smash-screen smash-slide-in">
      <div
        className="smash-screen-content"
        style={shouldRotate ? { transform: 'rotate(180deg)' } : undefined}
      >
        <SmashHeader
          seatNumber={seatNumber}
          title={playerName}
          subtitle="Choose Deck"
          onBack={onBack}
        />

        <div className="smash-deck-grid-container">
          {loading ? (
            <div className="smash-loading">
              <div className="smash-loading-spinner" />
              <div className="smash-loading-text">Loading decks...</div>
            </div>
          ) : decks.length === 0 ? (
            <div className="smash-empty">
              <div className="smash-empty-icon">🎴</div>
              <div className="smash-empty-title">No decks found</div>
              <div className="smash-empty-subtitle">
                {playerName} doesn't have any decks yet
              </div>
            </div>
          ) : (
            <div
              className="smash-deck-grid"
              style={{
                gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
                gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
              }}
            >
              {decks.map((deck, index) => (
                <DeckTile
                  key={deck.id}
                  deck={deck}
                  onSelect={onSelect}
                  animationDelay={index * 50}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SmashDeckSelect;
