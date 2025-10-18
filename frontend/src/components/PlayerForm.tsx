import { useState, type FormEvent } from 'react';
import type { Player } from '../services/api';

interface PlayerFormProps {
  onSubmit: (player: Omit<Player, 'id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
  initialData?: Player;
  isEdit?: boolean;
}

function PlayerForm({ onSubmit, onCancel, initialData, isEdit = false }: PlayerFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Player name is required');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        avatar: avatar.trim() || undefined,
        deck_ids: initialData?.deck_ids || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save player');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start md:items-center justify-center z-[1000] p-3 md:p-6" onClick={onCancel}>
      <div className="bg-gradient-card rounded-[16px] md:rounded-[12px] p-0 md:p-8 w-full max-w-full md:max-w-[500px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] min-h-[calc(100vh-24px)] md:min-h-0 max-h-[calc(100vh-24px)] md:max-h-none flex flex-col md:block overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="mb-0 md:mb-6 flex items-center justify-between sticky md:static top-0 bg-gradient-card border-b border-[#2C2E33] md:border-b-0 p-4 px-5 md:p-0 z-10 flex-shrink-0">
          <h2 className="text-white m-0 text-xl md:text-2xl font-semibold flex-1">{isEdit ? 'Edit Player' : 'Add New Player'}</h2>
          <button
            type="button"
            className="flex md:hidden bg-transparent border-none text-[#909296] text-2xl cursor-pointer p-1 px-2 items-center justify-center rounded-[6px] transition-all hover:bg-[rgba(144,146,150,0.1)] hover:text-white active:scale-95 ml-3"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto md:overflow-y-visible p-5 md:p-0 pb-10 md:pb-0 flex flex-col md:block">
          <div className="mb-5">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="playerName">
              Player Name *
            </label>
            <input
              id="playerName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter player name"
              className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="mb-5">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="playerAvatar">
              Avatar (optional)
            </label>
            <input
              id="playerAvatar"
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="Single letter or emoji (e.g., S or 🎮)"
              className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={2}
              disabled={isSubmitting}
            />
            <div className="text-[#909296] text-xs mt-1">
              Leave empty for default or enter a single character/emoji
            </div>
          </div>

          {error && (
            <div className="bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] p-3 rounded-[6px] text-sm mb-5">
              {error}
            </div>
          )}

          <div className="flex gap-2 md:gap-3 justify-end mt-auto md:mt-6 pt-5 md:pt-0 flex-shrink-0">
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
              className={`py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] border-none text-white font-semibold text-sm transition-all ${
                isSubmitting
                  ? 'bg-[#2C2E33] cursor-not-allowed opacity-50'
                  : 'bg-gradient-purple cursor-pointer opacity-100 hover:-translate-y-0.5'
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEdit ? 'Update Player' : 'Create Player')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PlayerForm;
