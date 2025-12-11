import type { PendingQuickDeck } from '../services/api';
import ColorPips from './ColorPips';

interface PendingDeckReviewProps {
  pendingDecks: PendingQuickDeck[];
  onAccept: (deckId: string) => void;
  onDelete: (deckId: string) => void;
  isLoading?: boolean;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function PendingDeckReview({ pendingDecks, onAccept, onDelete, isLoading }: PendingDeckReviewProps) {
  if (pendingDecks.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="p-4 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] rounded-t-[12px] flex items-center gap-3">
        <span className="text-xl">⚡</span>
        <div>
          <h3 className="text-[#f59e0b] font-semibold text-base m-0">
            Pending Review ({pendingDecks.length})
          </h3>
          <p className="text-[#909296] text-sm m-0 mt-0.5">
            These decks were created for you by other players
          </p>
        </div>
      </div>

      {/* Deck List */}
      <div className="bg-[#1A1B1E] border border-t-0 border-[rgba(245,158,11,0.3)] rounded-b-[12px] divide-y divide-[#2C2E33]">
        {pendingDecks.map((deck) => (
          <div key={deck.id} className="p-4 flex items-center gap-4">
            {/* Commander Image */}
            {deck.commander_image_url ? (
              <img
                src={deck.commander_image_url}
                alt={deck.commander}
                className="w-16 h-16 rounded-[8px] object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-[8px] bg-[#25262B] flex items-center justify-center flex-shrink-0">
                <span className="text-[#667eea] text-2xl">?</span>
              </div>
            )}

            {/* Deck Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-white font-semibold text-sm m-0 truncate">
                  {deck.name}
                </h4>
                {deck.colors && deck.colors.length > 0 && (
                  <ColorPips colors={deck.colors} />
                )}
              </div>
              <div className="text-[#909296] text-xs truncate mb-1">
                {deck.commander}
              </div>
              <div className="text-[#667eea] text-xs">
                Created by <strong>{deck.created_by_player_name}</strong> on {formatDate(deck.created_at)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => onAccept(deck.id!)}
                disabled={isLoading}
                className="py-2 px-4 rounded-[6px] bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#22c55e] font-semibold text-xs cursor-pointer transition-all hover:bg-[rgba(34,197,94,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep
              </button>
              <button
                onClick={() => onDelete(deck.id!)}
                disabled={isLoading}
                className="py-2 px-4 rounded-[6px] bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] font-semibold text-xs cursor-pointer transition-all hover:bg-[rgba(239,68,68,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PendingDeckReview;
