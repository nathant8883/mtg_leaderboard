import { useState, type FormEvent } from 'react';
import type { Deck, Player } from '../services/api';
import CommanderAutocomplete from './CommanderAutocomplete';
import ColorPips from './ColorPips';

interface DeckFormProps {
  onSubmit: (deck: Omit<Deck, 'id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
  players?: Player[];  // Optional - only needed for admin panel
  initialData?: Deck;
  isEdit?: boolean;
  showPlayerSelector?: boolean;  // Whether to show player selection (for admin panel)
}

function DeckForm({ onSubmit, onCancel, players = [], initialData, isEdit = false, showPlayerSelector = false }: DeckFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [playerId, setPlayerId] = useState(initialData?.player_id || '');
  const [commander, setCommander] = useState(initialData?.commander || '');
  const [commanderImageUrl, setCommanderImageUrl] = useState(initialData?.commander_image_url || '');
  const [colors, setColors] = useState<string[]>(initialData?.colors || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCommanderChange = (
    commanderName: string,
    imageUrl?: string,
    colorIdentity?: string[]
  ) => {
    setCommander(commanderName);
    if (imageUrl) setCommanderImageUrl(imageUrl);
    if (colorIdentity) setColors(colorIdentity);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Deck name is required');
      return;
    }

    if (showPlayerSelector && !playerId) {
      setError('Please select a player');
      return;
    }

    if (!commander.trim()) {
      setError('Commander is required');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const deckData: any = {
        name: name.trim(),
        commander: commander.trim(),
        commander_image_url: commanderImageUrl,
        colors: colors,
      };

      // Only include player_id if player selector is shown (admin panel)
      if (showPlayerSelector && playerId) {
        deckData.player_id = playerId;
      }

      await onSubmit(deckData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deck');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Deck' : 'Add New Deck'}</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="deckName">
              Deck Name *
            </label>
            <input
              id="deckName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter deck name (e.g., Atraxa Superfriends)"
              className="form-input"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {showPlayerSelector && (
            <div className="form-group">
              <label className="form-label" htmlFor="player">
                Player *
              </label>
              <select
                id="player"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="form-input"
                disabled={isSubmitting}
              >
                <option value="">Select a player...</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.avatar || ''} {player.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="commander">
              Commander *
            </label>
            <CommanderAutocomplete
              value={commander}
              onChange={handleCommanderChange}
              disabled={isSubmitting}
            />
            <div className="form-help">
              Start typing to search for legendary creatures
            </div>
          </div>

          {commanderImageUrl && (
            <div className="form-group">
              <label className="form-label">Commander Preview</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={commanderImageUrl}
                  alt={commander}
                  style={{
                    width: '100px',
                    height: 'auto',
                    borderRadius: '8px',
                    border: '2px solid #2C2E33',
                  }}
                />
                <div>
                  <div style={{ color: '#fff', fontWeight: 500, marginBottom: '4px' }}>
                    {commander}
                  </div>
                  {colors.length > 0 && (
                    <ColorPips colors={colors} />
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="button-group">
            <button
              type="button"
              className="secondary-btn"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`submit-btn ${!isSubmitting ? 'enabled' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEdit ? 'Update Deck' : 'Create Deck')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeckForm;
