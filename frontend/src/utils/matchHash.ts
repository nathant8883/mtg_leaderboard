import type { CreateMatchRequest } from '../services/api';

/**
 * Generate a deterministic hash for a match to detect duplicates
 *
 * Hash is based on:
 * - All player/deck pairs (sorted to ensure consistency)
 * - Winner player and deck IDs
 * - Match date
 *
 * This prevents duplicate submissions from:
 * - Multiple clicks on submit button
 * - Network retries
 * - User re-submitting same match within deduplication window
 *
 * @param matchData - The match data to hash
 * @returns SHA-256 hash as hex string
 */
export async function generateMatchHash(matchData: CreateMatchRequest): Promise<string> {
  // Sort player/deck pairs by player_id to ensure consistent ordering
  const sortedPairs = [...matchData.player_deck_pairs].sort((a, b) =>
    a.player_id.localeCompare(b.player_id)
  );

  // Create a canonical string representation of the match
  const canonical = JSON.stringify({
    pairs: sortedPairs,
    winner_player_id: matchData.winner_player_id,
    winner_deck_id: matchData.winner_deck_id,
    match_date: matchData.match_date,
  });

  // Generate SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Check if two matches would generate the same hash
 * Useful for testing and debugging
 *
 * @param match1 - First match
 * @param match2 - Second match
 * @returns True if matches would generate the same hash
 */
export async function matchesAreEqual(
  match1: CreateMatchRequest,
  match2: CreateMatchRequest
): Promise<boolean> {
  const hash1 = await generateMatchHash(match1);
  const hash2 = await generateMatchHash(match2);
  return hash1 === hash2;
}

/**
 * Deduplication window in milliseconds (5 minutes)
 * Matches with the same hash within this window are considered duplicates
 */
export const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000;
