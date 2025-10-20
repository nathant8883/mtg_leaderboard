import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, Trash2, Edit, LogIn, AlertTriangle, RefreshCw, X } from 'lucide-react';
import offlineQueue, { ERROR_STRATEGIES } from '../services/offlineQueue';
import { QueuedMatch } from '../types/queueTypes';

interface SyncQueueProps {
  onClose: () => void;
  onEditMatch?: (match: QueuedMatch) => void;
  onReauth?: () => void;
}

/**
 * SyncQueue Component
 *
 * Displays all pending and failed matches in the offline queue
 * Provides user actions for resolving sync errors:
 * - edit: Allow user to modify match data
 * - reauth: Redirect to login
 * - remove: Delete match from queue
 * - resolve: Show conflict resolution UI
 */
function SyncQueue({ onClose, onEditMatch, onReauth }: SyncQueueProps) {
  const [queuedMatches, setQueuedMatches] = useState<QueuedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // Load queued matches on mount and set up polling
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const matches = await offlineQueue.getPendingMatches();
      setQueuedMatches(matches);
    } catch (err) {
      console.error('Error loading queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (matchId: string) => {
    setSyncingIds(prev => new Set(prev).add(matchId));

    await offlineQueue.syncMatch(matchId, {
      onSuccess: () => {
        setSyncingIds(prev => {
          const next = new Set(prev);
          next.delete(matchId);
          return next;
        });
        loadQueue();
      },
      onError: () => {
        setSyncingIds(prev => {
          const next = new Set(prev);
          next.delete(matchId);
          return next;
        });
        loadQueue();
      },
    });
  };

  const handleRetryAll = async () => {
    const failed = queuedMatches.filter(m => m.status === 'error');
    for (const match of failed) {
      await handleRetry(match.id);
    }
  };

  const handleDeleteAll = async () => {
    if (confirm(`Are you sure you want to delete all ${queuedMatches.length} pending matches? This cannot be undone.`)) {
      await offlineQueue.clearAll();
      loadQueue();
      onClose(); // Close the modal after clearing
    }
  };

  const handleRemove = async (matchId: string) => {
    if (confirm('Are you sure you want to remove this match from the queue?')) {
      await offlineQueue.deleteMatch(matchId);
      loadQueue();
    }
  };

  const handleEdit = (match: QueuedMatch) => {
    if (onEditMatch) {
      onEditMatch(match);
      onClose();
    }
  };

  const handleReauth = () => {
    if (onReauth) {
      onReauth();
      onClose();
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getStatusIcon = (status: QueuedMatch['status']) => {
    switch (status) {
      case 'syncing':
        return <Loader2 className="w-5 h-5 text-[#667eea] animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-[#FF6B6B]" />;
      case 'pending':
        return <AlertTriangle className="w-5 h-5 text-[#FFA500]" />;
      default:
        return <CheckCircle className="w-5 h-5 text-[#33D9B2]" />;
    }
  };

  const getActionButton = (match: QueuedMatch) => {
    if (!match.lastError) return null;

    const strategy = ERROR_STRATEGIES[match.lastError.code] || ERROR_STRATEGIES[500];
    const isSyncing = syncingIds.has(match.id);

    if (strategy.retry && match.retryCount < (strategy.maxAttempts || Infinity)) {
      return (
        <button
          onClick={() => handleRetry(match.id)}
          disabled={isSyncing}
          className="px-3 py-1.5 bg-[#667eea] text-white rounded-[6px] text-sm font-semibold hover:bg-[#5568d3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Retry
            </>
          )}
        </button>
      );
    }

    // Non-retryable errors require user action
    switch (strategy.userAction) {
      case 'edit':
        return (
          <button
            onClick={() => handleEdit(match)}
            className="px-3 py-1.5 bg-[#FFA500] text-white rounded-[6px] text-sm font-semibold hover:bg-[#FF8C00] transition-colors flex items-center gap-1.5"
          >
            <Edit className="w-4 h-4" />
            Edit Match
          </button>
        );
      case 'reauth':
        return (
          <button
            onClick={handleReauth}
            className="px-3 py-1.5 bg-[#667eea] text-white rounded-[6px] text-sm font-semibold hover:bg-[#5568d3] transition-colors flex items-center gap-1.5"
          >
            <LogIn className="w-4 h-4" />
            Log In Again
          </button>
        );
      case 'remove':
      case 'resolve':
        return (
          <button
            onClick={() => handleRemove(match.id)}
            className="px-3 py-1.5 bg-[#FF6B6B] text-white rounded-[6px] text-sm font-semibold hover:bg-[#E55555] transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[1000] flex items-center justify-center">
        <div className="bg-[#1A1B1E] rounded-[12px] p-8 max-w-md w-full mx-4 border border-[#2C2E33]">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#667eea] animate-spin" />
            <span className="text-white text-lg">Loading queue...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-4">
      <div className="bg-[#1A1B1E] rounded-[12px] max-w-3xl w-full max-h-[90vh] flex flex-col border border-[#2C2E33] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2C2E33]">
          <div>
            <h2 className="text-white text-2xl font-bold m-0">Sync Queue</h2>
            <p className="text-[#909296] text-sm mt-1">
              {queuedMatches.length} {queuedMatches.length === 1 ? 'match' : 'matches'} pending sync
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[6px] hover:bg-[#25262B] transition-colors text-[#909296] hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {queuedMatches.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-[#33D9B2] mx-auto mb-4" />
              <h3 className="text-white text-xl font-semibold mb-2">All synced!</h3>
              <p className="text-[#909296] text-sm">No matches waiting to be synced.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queuedMatches.map((match) => {
                const winner = match.metadata.playerSnapshots.find(
                  p => p.id === match.matchData.winner_player_id
                );
                const winnerDeck = match.metadata.deckSnapshots.find(
                  d => d.id === match.matchData.winner_deck_id
                );

                return (
                  <div
                    key={match.id}
                    className={`bg-[rgba(37,38,43,0.5)] rounded-[12px] p-4 border transition-all ${
                      match.status === 'error'
                        ? 'border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.05)]'
                        : match.status === 'syncing'
                        ? 'border-[rgba(102,126,234,0.4)] bg-[rgba(102,126,234,0.05)]'
                        : 'border-[rgba(255,165,0,0.4)] bg-[rgba(255,165,0,0.05)]'
                    }`}
                  >
                    {/* Status Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(match.status)}
                        <div className="flex-1">
                          <div className="text-white font-semibold text-sm">
                            {winner?.name || 'Unknown'} won
                          </div>
                          <div className="text-[#909296] text-xs mt-0.5">
                            {winnerDeck?.name || 'Unknown Deck'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-[#909296] text-right">
                        {formatDate(match.metadata.queuedAt)}
                        {match.retryCount > 0 && (
                          <div className="text-[#FFA500] mt-1">
                            {match.retryCount} {match.retryCount === 1 ? 'retry' : 'retries'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error Message */}
                    {match.lastError && (
                      <div className="mb-3 p-3 bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.2)] rounded-[8px]">
                        <div className="text-[#FF6B6B] text-sm font-medium">
                          {match.lastError.message}
                        </div>
                      </div>
                    )}

                    {/* Players */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {match.matchData.player_deck_pairs.map((pair, idx) => {
                        const player = match.metadata.playerSnapshots.find(p => p.id === pair.player_id);
                        const isWinner = pair.player_id === match.matchData.winner_player_id;

                        return (
                          <div
                            key={`${pair.player_id}-${pair.deck_id}-${idx}`}
                            className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-[12px] text-xs ${
                              isWinner
                                ? 'bg-[rgba(102,126,234,0.2)] border border-[rgba(102,126,234,0.3)] text-[#667eea]'
                                : 'bg-[rgba(44,46,51,0.5)] text-[#C1C2C5]'
                            }`}
                          >
                            <span className="font-medium">{player?.name || 'Unknown'}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#2C2E33]">
                      {getActionButton(match)}
                      <button
                        onClick={() => handleRemove(match.id)}
                        className="p-1.5 rounded-[6px] hover:bg-[rgba(255,107,107,0.1)] transition-colors text-[#909296] hover:text-[#FF6B6B]"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {queuedMatches.length > 0 && (
          <div className="flex items-center justify-between p-6 border-t border-[#2C2E33]">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetryAll}
                className="px-4 py-2 bg-[#667eea] text-white rounded-[8px] font-semibold hover:bg-[#5568d3] transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry All Failed
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 bg-[rgba(255,107,107,0.15)] text-[#FF6B6B] border border-[rgba(255,107,107,0.3)] rounded-[8px] font-semibold hover:bg-[rgba(255,107,107,0.25)] transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#25262B] text-white rounded-[8px] font-semibold hover:bg-[#2C2E33] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SyncQueue;
