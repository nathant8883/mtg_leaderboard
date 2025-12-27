import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Deck, Player } from '../services/api';
import CommanderAutocomplete from './CommanderAutocomplete';
import ColorPips from './ColorPips';
import ArtSelectorModal from './ArtSelectorModal';

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
  const [disabled, setDisabled] = useState(initialData?.disabled || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showArtSelector, setShowArtSelector] = useState(false);

  const handleCommanderChange = (
    commanderName: string,
    imageUrl?: string,
    colorIdentity?: string[]
  ) => {
    setCommander(commanderName);
    if (imageUrl) setCommanderImageUrl(imageUrl);
    if (colorIdentity) setColors(colorIdentity);
  };

  const handleArtSelect = (imageUrl: string) => {
    setCommanderImageUrl(imageUrl);
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
        disabled: disabled,
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

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '48px',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1a1b1e',
          border: '1px solid #2c2e33',
          borderRadius: '16px',
          width: '95%',
          maxWidth: '500px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          maxHeight: 'calc(100vh - 48px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #2c2e33',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white', margin: 0 }}>
            {isEdit ? 'Edit Deck' : 'Add New Deck'}
          </h2>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="mb-5">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="deckName">
              Deck Name *
            </label>
            <input
              id="deckName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter deck name (e.g., Atraxa Superfriends)"
              className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {showPlayerSelector && (
            <div className="mb-5">
              <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="player">
                Player *
              </label>
              <select
                id="player"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
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

          <div className="mb-5">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="commander">
              Commander *
            </label>
            <CommanderAutocomplete
              value={commander}
              onChange={handleCommanderChange}
              disabled={isSubmitting}
            />
            <div className="text-[#909296] text-xs mt-1">
              Start typing to search for legendary creatures
            </div>
          </div>

          {commanderImageUrl && (
            <div className="mb-5">
              <label className="text-[#C1C2C5] text-sm font-semibold block mb-2">Commander Preview</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowArtSelector(true)}
                  disabled={isSubmitting}
                  className="relative group cursor-pointer bg-transparent border-none p-0 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Click to change artwork"
                >
                  <img
                    src={commanderImageUrl}
                    alt={commander}
                    className="w-[100px] h-auto rounded-[8px] border-2 border-[#2C2E33] transition-all group-hover:border-[#667eea] group-hover:shadow-[0_0_12px_rgba(102,126,234,0.3)]"
                  />
                  <div className="absolute inset-0 rounded-[8px] bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-medium">Change Art</span>
                  </div>
                </button>
                <div>
                  <div className="text-white font-medium mb-1">
                    {commander}
                  </div>
                  {colors.length > 0 && (
                    <ColorPips colors={colors} />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="disabled">
              Deck Status
            </label>
            <div className="flex items-center gap-3">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  id="disabled"
                  checked={disabled}
                  onChange={(e) => setDisabled(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="text-[#C1C2C5] text-sm font-medium">
                {disabled ? 'Disabled (hidden from matches & stats)' : 'Active'}
              </span>
            </div>
            {disabled && (
              <div className="text-[#e74c3c] text-xs mt-2">
                ⚠️ This deck will not appear in match selection or count towards statistics
              </div>
            )}
          </div>

          {error && (
            <div className="bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] p-3 rounded-[6px] text-sm mb-5">
              {error}
            </div>
          )}
        </form>

        {/* Action Buttons */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #2c2e33',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            type="button"
            style={{
              padding: '10px 20px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              opacity: isSubmitting ? 0.5 : 1,
            }}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              opacity: isSubmitting ? 0.5 : 1,
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : (isEdit ? 'Update Deck' : 'Create Deck')}
          </button>
        </div>
      </div>

      {/* Art Selector Modal */}
      {showArtSelector && commander && (
        <ArtSelectorModal
          commanderName={commander}
          currentImageUrl={commanderImageUrl}
          onSelect={handleArtSelect}
          onClose={() => setShowArtSelector(false)}
        />
      )}
    </div>,
    document.body
  );
}

export default DeckForm;
