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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Player' : 'Add New Player'}</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="playerName">
              Player Name *
            </label>
            <input
              id="playerName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter player name"
              className="form-input"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="playerAvatar">
              Avatar (optional)
            </label>
            <input
              id="playerAvatar"
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="Single letter or emoji (e.g., S or 🎮)"
              className="form-input"
              maxLength={2}
              disabled={isSubmitting}
            />
            <div className="form-help">
              Leave empty for default or enter a single character/emoji
            </div>
          </div>

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
              {isSubmitting ? 'Saving...' : (isEdit ? 'Update Player' : 'Create Player')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PlayerForm;
