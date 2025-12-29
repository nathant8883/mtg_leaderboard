/**
 * Win rate tier color utilities matching TopDecks dashboard styling.
 * Thresholds are calibrated for 4-player commander games (25% baseline).
 *
 * @deprecated Import from './tierConfig' for new code.
 * These functions are kept for backward compatibility with MatchupMatrix
 * and other components that use the direct color class approach.
 */

import { getWinRateTier, TIER_CONFIG } from './tierConfig';

export function getWinRateTierColor(winRate: number): string {
  const tier = getWinRateTier(winRate);
  return TIER_CONFIG[tier].textClass;
}

export function getWinRateTierBgColor(winRate: number): string {
  const tier = getWinRateTier(winRate);
  return TIER_CONFIG[tier].bgClass;
}

// Re-export from tierConfig for convenience
export { getWinRateTier, getEloTier, getTierConfig, TIER_CONFIG } from './tierConfig';
export type { TierLetter, TierConfig } from './tierConfig';
