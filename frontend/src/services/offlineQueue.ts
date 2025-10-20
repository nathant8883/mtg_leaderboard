import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type { CreateMatchRequest, Player, Deck } from './api';
import { matchApi } from './api';
import type {
  QueuedMatch,
  QueueStatus,
  QueueError,
  SyncMatchOptions,
  SyncAllOptions,
  ErrorStrategy,
  PlayerSnapshot,
  DeckSnapshot,
} from '../types/queueTypes';
import { generateMatchHash, DEDUPLICATION_WINDOW_MS } from '../utils/matchHash';

/**
 * Error handling strategies for different HTTP status codes and network errors
 */
export const ERROR_STRATEGIES: Record<number | string, ErrorStrategy> = {
  400: { retry: false, userAction: 'edit', message: 'Invalid match data. Please check your entries.' },
  401: { retry: false, userAction: 'reauth', message: 'Session expired. Please log in again.' },
  404: { retry: false, userAction: 'remove', message: 'Player or deck no longer exists.' },
  409: { retry: false, userAction: 'resolve', message: 'This match may already exist.' },
  429: { retry: true, backoff: 'exponential', message: 'Too many requests. Retrying...', maxAttempts: 5 },
  500: { retry: true, backoff: 'exponential', message: 'Server error. Retrying...', maxAttempts: 3 },
  503: { retry: true, backoff: 'exponential', message: 'Service unavailable. Retrying...', maxAttempts: 5 },
  network: { retry: true, backoff: 'exponential', message: 'No internet connection. Will retry when online.', maxAttempts: Infinity },
};

/**
 * Maximum backoff delay in milliseconds (30 seconds)
 */
const MAX_BACKOFF_MS = 30 * 1000;

/**
 * Calculate exponential backoff delay
 * @param retryCount - Number of retries attempted
 * @returns Delay in milliseconds, capped at MAX_BACKOFF_MS
 */
function calculateBackoff(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
  const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
  return delay;
}

/**
 * Dexie database for offline queue
 */
class OfflineQueueDB extends Dexie {
  queuedMatches!: Table<QueuedMatch, string>;

  constructor() {
    super('OfflineQueueDB');

    // Define schema
    this.version(1).stores({
      queuedMatches: 'id, status, hash, metadata.queuedAt',
    });
  }
}

// Singleton database instance
const db = new OfflineQueueDB();

/**
 * Callbacks to be invoked when all matches are synced
 * Used for service worker updates and other cleanup
 */
const allSyncedCallbacks: Array<() => void> = [];

/**
 * Offline queue service for managing match sync
 */
export const offlineQueue = {
  /**
   * Add a new match to the offline queue
   *
   * Features:
   * - Generates unique client-side ID (UUID v4)
   * - Creates content hash for deduplication
   * - Checks for duplicate submissions within 5-minute window
   * - Stores player/deck snapshots for historical accuracy
   *
   * @param matchData - The match to queue
   * @param players - All players for snapshot lookup
   * @param decks - All decks for snapshot lookup
   * @returns The queued match with generated ID, or null if duplicate detected
   */
  async addMatch(
    matchData: CreateMatchRequest,
    players: Player[],
    decks: Deck[]
  ): Promise<QueuedMatch | null> {
    // Generate hash for deduplication
    const hash = await generateMatchHash(matchData);

    // Check for duplicates within deduplication window
    const cutoffTime = Date.now() - DEDUPLICATION_WINDOW_MS;
    const existingMatch = await db.queuedMatches
      .where('hash')
      .equals(hash)
      .filter(match => match.metadata.queuedAt > cutoffTime)
      .first();

    if (existingMatch) {
      console.log('[OfflineQueue] Duplicate match detected, skipping:', existingMatch.id);
      return null; // Duplicate detected
    }

    // Create player snapshots
    const playerSnapshots: PlayerSnapshot[] = matchData.player_deck_pairs.map(pair => {
      const player = players.find(p => p.id === pair.player_id);
      return {
        id: pair.player_id,
        name: player?.name || 'Unknown Player',
      };
    });

    // Create deck snapshots
    const deckSnapshots: DeckSnapshot[] = matchData.player_deck_pairs.map(pair => {
      const deck = decks.find(d => d.id === pair.deck_id);
      return {
        id: pair.deck_id,
        name: deck?.name || 'Unknown Deck',
      };
    });

    // Create queued match
    const queuedMatch: QueuedMatch = {
      id: uuidv4(),
      matchData,
      metadata: {
        queuedAt: Date.now(),
        playerSnapshots,
        deckSnapshots,
      },
      status: 'pending',
      retryCount: 0,
      hash,
    };

    // Store in IndexedDB
    await db.queuedMatches.add(queuedMatch);
    console.log('[OfflineQueue] Match queued:', queuedMatch.id);

    return queuedMatch;
  },

  /**
   * Get all pending matches (not yet synced)
   * @returns Array of queued matches with status 'pending' or 'error'
   */
  async getPendingMatches(): Promise<QueuedMatch[]> {
    return await db.queuedMatches
      .where('status')
      .anyOf(['pending', 'error'])
      .sortBy('metadata.queuedAt');
  },

  /**
   * Get all matches regardless of status
   * @returns Array of all queued matches
   */
  async getAllMatches(): Promise<QueuedMatch[]> {
    return await db.queuedMatches.toArray();
  },

  /**
   * Mark a match as successfully synced and remove from queue
   * @param id - Client-side match ID
   * @param serverId - Server-assigned match ID (optional, for logging)
   */
  async markSynced(id: string, serverId?: string): Promise<void> {
    await db.queuedMatches.delete(id);
    console.log('[OfflineQueue] Match synced and removed:', id, serverId ? `-> ${serverId}` : '');

    // Check if all matches are synced
    const remaining = await db.queuedMatches.count();
    if (remaining === 0) {
      console.log('[OfflineQueue] All matches synced, invoking callbacks');
      allSyncedCallbacks.forEach(callback => callback());
    }
  },

  /**
   * Delete a match from the queue (user-initiated removal)
   * @param id - Client-side match ID
   */
  async deleteMatch(id: string): Promise<void> {
    await db.queuedMatches.delete(id);
    console.log('[OfflineQueue] Match deleted:', id);
  },

  /**
   * Update match status and error information
   * @param id - Client-side match ID
   * @param status - New status
   * @param error - Error information (if status is 'error')
   */
  async updateMatchStatus(id: string, status: QueueStatus, error?: QueueError): Promise<void> {
    const match = await db.queuedMatches.get(id);
    if (!match) return;

    const updatedMetadata = { ...match.metadata, submittedAt: Date.now() };
    await db.queuedMatches.update(id, {
      status,
      lastError: error,
      metadata: updatedMetadata,
    });
  },

  /**
   * Increment retry count for a match
   * @param id - Client-side match ID
   */
  async incrementRetryCount(id: string): Promise<void> {
    const match = await db.queuedMatches.get(id);
    if (match) {
      await db.queuedMatches.update(id, { retryCount: match.retryCount + 1 });
    }
  },

  /**
   * Sync a single match to the server
   *
   * Features:
   * - ID-based conflict detection (validates players/decks still exist)
   * - Exponential backoff for retryable errors
   * - Error strategy lookup for different status codes
   * - Automatic retry count tracking
   * - Status updates during sync process
   *
   * @param id - Client-side match ID
   * @param options - Sync options with callbacks
   * @returns True if sync succeeded, false otherwise
   */
  async syncMatch(id: string, options?: SyncMatchOptions): Promise<boolean> {
    const match = await db.queuedMatches.get(id);
    if (!match) {
      console.error('[OfflineQueue] Match not found:', id);
      return false;
    }

    // Update status to syncing
    await this.updateMatchStatus(id, 'syncing');
    options?.onProgress?.('syncing');

    try {
      // Step 1: Conflict Detection - Validate all player IDs and deck IDs still exist
      const { playerApi, deckApi } = await import('./api');
      const playerIds = new Set(match.matchData.player_deck_pairs.map(p => p.player_id));
      const deckIds = new Set(match.matchData.player_deck_pairs.map(p => p.deck_id));

      const missingPlayers: string[] = [];
      const missingDecks: string[] = [];

      // Check each player ID
      for (const playerId of playerIds) {
        try {
          await playerApi.getById(playerId);
        } catch (error: any) {
          if (error.response?.status === 404) {
            const snapshot = match.metadata.playerSnapshots.find(p => p.id === playerId);
            missingPlayers.push(snapshot?.name || playerId);
          }
          // Other errors (401, 500) will be caught in main catch block
          else {
            throw error;
          }
        }
      }

      // Check each deck ID
      for (const deckId of deckIds) {
        try {
          await deckApi.getById(deckId);
        } catch (error: any) {
          if (error.response?.status === 404) {
            const snapshot = match.metadata.deckSnapshots.find(d => d.id === deckId);
            missingDecks.push(snapshot?.name || deckId);
          }
          // Other errors (401, 500) will be caught in main catch block
          else {
            throw error;
          }
        }
      }

      // If any IDs are missing, fail with conflict error
      if (missingPlayers.length > 0 || missingDecks.length > 0) {
        const errorParts: string[] = [];
        if (missingPlayers.length > 0) {
          errorParts.push(`Players deleted: ${missingPlayers.join(', ')}`);
        }
        if (missingDecks.length > 0) {
          errorParts.push(`Decks deleted: ${missingDecks.join(', ')}`);
        }

        const conflictError: QueueError = {
          code: 404,
          message: errorParts.join('. '),
          timestamp: Date.now(),
        };

        await this.updateMatchStatus(id, 'error', conflictError);
        options?.onError?.(conflictError);
        options?.onProgress?.('error');

        console.warn('[OfflineQueue] Conflict detected for match:', id, conflictError.message);
        return false;
      }

      // Step 2: Attempt to sync with server (all IDs validated)
      const response = await matchApi.create(match.matchData);

      // Success - mark as synced
      await this.markSynced(id, response.id);
      options?.onSuccess?.(response.id || '');
      console.log('[OfflineQueue] Match synced successfully:', id, '-> server ID:', response.id);

      return true;

    } catch (error: any) {
      console.error('[OfflineQueue] Sync failed for match:', id, error);

      // Increment retry count
      await this.incrementRetryCount(id);
      const updatedMatch = await db.queuedMatches.get(id);
      const retryCount = updatedMatch?.retryCount || 0;

      // Determine error code
      let errorCode: number | string;
      let errorMessage: string;

      if (error.response) {
        // HTTP error
        errorCode = error.response.status;
        errorMessage = error.response.data?.detail || error.response.statusText || 'Server error';
      } else if (error.request) {
        // Network error (no response received)
        errorCode = 'network';
        errorMessage = 'No internet connection';
      } else {
        // Other error
        errorCode = 500;
        errorMessage = error.message || 'Unknown error';
      }

      // Get error strategy
      const strategy = ERROR_STRATEGIES[errorCode] || ERROR_STRATEGIES[500];

      // Check if we should retry
      const shouldRetry = strategy.retry && (
        strategy.maxAttempts === Infinity || retryCount < (strategy.maxAttempts || 1)
      );

      // Create error object
      const queueError: QueueError = {
        code: typeof errorCode === 'number' ? errorCode : 0,
        message: errorMessage,
        timestamp: Date.now(),
      };

      // Update match with error
      await this.updateMatchStatus(id, 'error', queueError);
      options?.onError?.(queueError);
      options?.onProgress?.('error');

      // Log retry decision
      if (shouldRetry) {
        const delay = calculateBackoff(retryCount);
        console.log(`[OfflineQueue] Will retry match ${id} in ${delay}ms (attempt ${retryCount + 1}/${strategy.maxAttempts})`);
      } else {
        console.log(`[OfflineQueue] Match ${id} requires user action: ${strategy.userAction}`);
      }

      return false;
    }
  },

  /**
   * Sync all pending matches with exponential backoff
   *
   * Features:
   * - Processes matches sequentially (not in parallel)
   * - Implements backoff delays between retries
   * - Progress tracking via callback
   * - Continues on individual failures
   *
   * @param options - Sync options with progress/completion callbacks
   */
  async syncAll(options?: SyncAllOptions): Promise<void> {
    const pendingMatches = await this.getPendingMatches();

    if (pendingMatches.length === 0) {
      console.log('[OfflineQueue] No pending matches to sync');
      options?.onComplete?.(0, 0);
      return;
    }

    console.log(`[OfflineQueue] Syncing ${pendingMatches.length} pending matches`);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < pendingMatches.length; i++) {
      const match = pendingMatches[i];

      // Calculate backoff delay if this is a retry
      if (match.retryCount > 0) {
        const delay = calculateBackoff(match.retryCount);
        console.log(`[OfflineQueue] Waiting ${delay}ms before retrying match ${match.id}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Attempt sync
      const success = await this.syncMatch(match.id);

      if (success) {
        succeeded++;
      } else {
        failed++;
      }

      // Report progress
      options?.onProgress?.(i + 1, pendingMatches.length);
    }

    console.log(`[OfflineQueue] Sync complete: ${succeeded} succeeded, ${failed} failed`);
    options?.onComplete?.(succeeded, failed);
  },

  /**
   * Register a callback to be invoked when all matches are synced
   * Useful for service worker updates and other cleanup tasks
   *
   * @param callback - Function to call when queue is empty
   */
  onAllSynced(callback: () => void): void {
    allSyncedCallbacks.push(callback);
  },

  /**
   * Clear all synced callbacks (useful for cleanup)
   */
  clearSyncedCallbacks(): void {
    allSyncedCallbacks.length = 0;
  },

  /**
   * Get count of pending matches
   * @returns Number of matches with status 'pending' or 'error'
   */
  async getPendingCount(): Promise<number> {
    return await db.queuedMatches
      .where('status')
      .anyOf(['pending', 'error'])
      .count();
  },

  /**
   * Clear all matches from queue (use with caution!)
   * Only for development/testing
   */
  async clearAll(): Promise<void> {
    await db.queuedMatches.clear();
    console.log('[OfflineQueue] All matches cleared');
  },
};

export default offlineQueue;
