import { useState, useEffect, type FormEvent } from 'react';
import { deckApi, type Deck } from '../services/api';
import CommanderAutocomplete from './CommanderAutocomplete';
import ColorPips from './ColorPips';

// Detect if we're in landscape mobile mode
// Most phones in landscape are under 1000px wide, tablets can be larger
const isLandscapeMobile = () =>
  window.innerWidth > window.innerHeight && window.innerHeight < 500;

interface QuickDeckFormProps {
  targetPlayerId: string;
  targetPlayerName: string;
  onSubmit: (deck: Deck) => void;
  onCancel: () => void;
}

function QuickDeckForm({ targetPlayerId, targetPlayerName, onSubmit, onCancel }: QuickDeckFormProps) {
  const [name, setName] = useState('');
  const [commander, setCommander] = useState('');
  const [commanderImageUrl, setCommanderImageUrl] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLandscape, setIsLandscape] = useState(isLandscapeMobile);

  // Update landscape state on resize/orientation change
  useEffect(() => {
    const handleResize = () => setIsLandscape(isLandscapeMobile());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

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

    if (!commander.trim()) {
      setError('Commander is required');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const newDeck = await deckApi.createQuick(targetPlayerId, name.trim(), commander.trim());
      onSubmit(newDeck);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to create deck';
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Landscape mobile: compact bottom bar layout
  if (isLandscape) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[1001]" onClick={onCancel}>
        <form
          onSubmit={handleSubmit}
          className="quick-deck-landscape"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact header row */}
          <div className="quick-deck-header-compact">
            <span>
              Quick Add for <strong className="text-white">{targetPlayerName}</strong>
            </span>
            <button
              type="button"
              className="bg-transparent border-none text-[#909296] text-lg cursor-pointer p-1 rounded-[4px] hover:text-white"
              onClick={onCancel}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Horizontal inputs row */}
          <div className="quick-deck-inputs-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deck Name"
              className="quick-deck-input-compact"
              disabled={isSubmitting}
              autoFocus
            />
            <div className="quick-deck-commander-wrapper">
              <CommanderAutocomplete
                value={commander}
                onChange={handleCommanderChange}
                disabled={isSubmitting}
                dropdownDirection="down"
              />
            </div>
            <button
              type="submit"
              className={`quick-deck-submit-compact ${isSubmitting ? 'disabled' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? '...' : 'Create'}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-[#FF6B6B] text-xs mt-2 px-1">
              {error}
            </div>
          )}
        </form>
      </div>
    );
  }

  // Portrait/Desktop: original vertical modal layout
  return (
    <div className="fixed inset-0 bg-black/70 flex items-start md:items-center justify-center z-[1001] p-3 md:p-6" onClick={onCancel}>
      <div className="bg-gradient-card rounded-[16px] md:rounded-[12px] p-0 md:p-6 w-full max-w-full md:max-w-[450px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] min-h-0 max-h-[calc(100vh-24px)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2C2E33] md:border-b-0 p-4 px-5 md:p-0 md:mb-4 flex-shrink-0">
          <div>
            <h2 className="text-white m-0 text-lg md:text-xl font-semibold">Quick Add Deck</h2>
            <p className="text-[#909296] text-sm m-0 mt-1">for {targetPlayerName}</p>
          </div>
          <button
            type="button"
            className="bg-transparent border-none text-[#909296] text-xl cursor-pointer p-1 px-2 items-center justify-center rounded-[6px] transition-all hover:bg-[rgba(144,146,150,0.1)] hover:text-white active:scale-95"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-0 pb-3 md:pb-0">
          <div className="mb-4">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="quickDeckName">
              Deck Name *
            </label>
            <input
              id="quickDeckName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Atraxa Superfriends"
              className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="quickCommander">
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
            <div className="mb-4">
              <div className="flex items-center gap-3 p-3 bg-[#25262B] rounded-[8px] border border-[#2C2E33]">
                <img
                  src={commanderImageUrl}
                  alt={commander}
                  className="w-[60px] h-auto rounded-[6px]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm truncate">
                    {commander}
                  </div>
                  {colors.length > 0 && (
                    <div className="mt-1">
                      <ColorPips colors={colors} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] rounded-[8px] mb-4">
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0">⚡</span>
              <p className="text-[#f59e0b] text-xs m-0">
                This deck will need to be reviewed by <strong>{targetPlayerName}</strong>. They can keep or delete it from their profile.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] p-3 rounded-[6px] text-sm mb-4">
              {error}
            </div>
          )}
        </form>

        {/* Action Buttons */}
        <div className="border-t border-[#2C2E33] md:border-t-0 p-4 px-5 md:p-0 md:mt-4 flex-shrink-0">
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="py-2.5 px-5 rounded-[6px] bg-transparent border border-[#2C2E33] text-[#C1C2C5] cursor-pointer font-medium text-sm transition-all hover:bg-[#25262B] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className={`py-2.5 px-5 rounded-[6px] border-none text-white font-semibold text-sm transition-all ${
                isSubmitting
                  ? 'bg-[#2C2E33] cursor-not-allowed opacity-50'
                  : 'bg-gradient-purple cursor-pointer opacity-100 hover:-translate-y-0.5'
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Quick Deck'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickDeckForm;
