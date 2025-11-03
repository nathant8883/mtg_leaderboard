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
  const [disabled, setDisabled] = useState(initialData?.disabled || false);
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start md:items-center justify-center z-[1000] p-3 md:p-6" onClick={onCancel}>
      <div className="bg-gradient-card rounded-[16px] md:rounded-[12px] p-0 md:p-8 w-full max-w-full md:max-w-[500px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] min-h-[calc(100vh-24px)] md:min-h-0 max-h-[calc(100vh-24px)] md:max-h-none flex flex-col md:block overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Sticky Header */}
        <div className="mb-0 md:mb-6 flex items-center justify-between sticky md:static top-0 bg-gradient-card border-b border-[#2C2E33] md:border-b-0 p-4 px-5 md:p-0 z-10 flex-shrink-0">
          <h2 className="text-white m-0 text-xl md:text-2xl font-semibold flex-1">{isEdit ? 'Edit Deck' : 'Add New Deck'}</h2>
          <button
            type="button"
            className="flex md:hidden bg-transparent border-none text-[#909296] text-2xl cursor-pointer p-1 px-2 items-center justify-center rounded-[6px] transition-all hover:bg-[rgba(144,146,150,0.1)] hover:text-white active:scale-95 ml-3"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto md:overflow-y-visible p-5 md:p-0 pb-3 md:pb-0 flex flex-col md:block">
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
                <img
                  src={commanderImageUrl}
                  alt={commander}
                  className="w-[100px] h-auto rounded-[8px] border-2 border-[#2C2E33]"
                />
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

        {/* Sticky Action Buttons (Mobile) / Regular Buttons (Desktop) */}
        <div className="sticky md:static bottom-0 bg-gradient-card border-t border-[#2C2E33] md:border-t-0 p-4 px-5 md:p-0 z-10 flex-shrink-0 md:mt-6">
          <div className="flex gap-2 md:gap-3 justify-end">
            <button
              type="button"
              className="py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] bg-transparent border border-[#2C2E33] text-[#C1C2C5] cursor-pointer font-medium text-sm transition-all hover:bg-[#25262B] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className={`py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] border-none text-white font-semibold text-sm transition-all ${
                isSubmitting
                  ? 'bg-[#2C2E33] cursor-not-allowed opacity-50'
                  : 'bg-gradient-purple cursor-pointer opacity-100 hover:-translate-y-0.5'
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEdit ? 'Update Deck' : 'Create Deck')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeckForm;
