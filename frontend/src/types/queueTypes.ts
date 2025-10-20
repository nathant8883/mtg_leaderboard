import { CreateMatchRequest } from '../services/api';

/**
 * Status of a queued match in the offline queue
 */
export type QueueStatus = 'pending' | 'syncing' | 'error';

/**
 * Player snapshot stored with each queued match
 * Preserves player information at the time the match was created
 */
export interface PlayerSnapshot {
  id: string;
  name: string;
}

/**
 * Deck snapshot stored with each queued match
 * Preserves deck information at the time the match was created
 */
export interface DeckSnapshot {
  id: string;
  name: string;
}

/**
 * Error information for failed sync attempts
 */
export interface QueueError {
  code: number;        // HTTP status code or custom error code
  message: string;     // Human-readable error message
  timestamp: number;   // When the error occurred (milliseconds since epoch)
}

/**
 * Metadata stored with each queued match
 * Contains timing information and snapshots of related entities
 */
export interface QueueMetadata {
  queuedAt: number;                    // When user created match (ms since epoch)
  submittedAt?: number;                // When sync was last attempted (ms since epoch)
  playerSnapshots: PlayerSnapshot[];   // Player names at time of creation
  deckSnapshots: DeckSnapshot[];       // Deck names at time of creation
}

/**
 * A match queued for offline sync
 * Stored in IndexedDB until successfully synced to server
 */
export interface QueuedMatch {
  id: string;                    // UUID v4 for client-side tracking
  matchData: CreateMatchRequest; // The actual match data to be synced
  metadata: QueueMetadata;       // Timing and snapshot information
  status: QueueStatus;           // Current sync status
  retryCount: number;            // Number of sync attempts made
  lastError?: QueueError;        // Error from most recent failed sync
  hash?: string;                 // SHA-256 hash for deduplication (optional for older entries)
}

/**
 * Options for syncing a single match
 */
export interface SyncMatchOptions {
  onProgress?: (status: QueueStatus) => void;  // Called when sync status changes
  onSuccess?: (serverId: string) => void;      // Called with server-assigned ID on success
  onError?: (error: QueueError) => void;       // Called when sync fails
}

/**
 * Options for syncing all queued matches
 */
export interface SyncAllOptions {
  onProgress?: (completed: number, total: number) => void;  // Progress callback
  onComplete?: (succeeded: number, failed: number) => void; // Completion callback
}

/**
 * Error handling strategy for different HTTP status codes
 */
export interface ErrorStrategy {
  retry: boolean;                // Whether to retry this error
  userAction?: 'edit' | 'reauth' | 'remove' | 'resolve';  // Required user action
  message: string;               // User-facing error message
  backoff?: 'exponential';       // Backoff strategy
  maxAttempts?: number;          // Maximum retry attempts (Infinity for unlimited)
}
