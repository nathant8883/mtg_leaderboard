import type { Match } from '../services/api';

/**
 * PendingMatch - A match that has been queued for sync but not yet confirmed by the server
 *
 * This extends the Match type with additional client-side metadata to track
 * the pending sync state and allow for undo functionality.
 */
export interface PendingMatch extends Match {
  _pending: true;           // Flag to identify pending matches
  _tempId: string;          // Client-side temporary ID (UUID)
  _canUndo: boolean;        // Whether undo is still available (5-second window)
}
