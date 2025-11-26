import { useState } from 'react';
import type { Deck } from '../../../services/api';
import ColorPips from '../../ColorPips';

interface DeckTileProps {
  deck: Deck;
  onSelect: (deck: Deck) => void;
  animationDelay?: number;
}

function DeckTile({ deck, onSelect, animationDelay = 0 }: DeckTileProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <button
      className="smash-deck-tile"
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={() => onSelect(deck)}
    >
      {/* Commander art background */}
      {deck.commander_image_url && !imageError ? (
        <>
          {/* Skeleton placeholder */}
          {!imageLoaded && (
            <div className="smash-deck-skeleton" />
          )}
          <img
            src={deck.commander_image_url}
            alt={deck.commander}
            className={`smash-deck-bg-img ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <div className="smash-deck-placeholder">
          <span className="smash-deck-placeholder-icon">
            {deck.colors.length > 0 ? '⚔️' : '🎴'}
          </span>
        </div>
      )}

      {/* Dark gradient overlay for text readability */}
      <div className="smash-deck-overlay" />

      {/* Content overlay */}
      <div className="smash-deck-content">
        {/* Color pips at top-left */}
        {deck.colors.length > 0 && (
          <div className="smash-deck-colors">
            <ColorPips colors={deck.colors} size="sm" />
          </div>
        )}

        {/* Deck info at bottom */}
        <div className="smash-deck-info">
          <div className="smash-deck-name">{deck.name}</div>
          <div className="smash-deck-commander">{deck.commander}</div>
        </div>
      </div>
    </button>
  );
}

export default DeckTile;
