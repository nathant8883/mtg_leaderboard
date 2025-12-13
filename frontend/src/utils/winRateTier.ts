/**
 * Win rate tier color utilities matching TopDecks dashboard styling.
 * Thresholds are calibrated for 4-player commander games (25% baseline).
 */

export function getWinRateTierColor(winRate: number): string {
  if (winRate >= 35) return 'text-[#FFD700]';  // S-tier Gold
  if (winRate >= 28) return 'text-[#33D9B2]';  // A-tier Cyan
  if (winRate >= 22) return 'text-[#4FACFE]';  // B-tier Blue
  return 'text-[#FF6B6B]';                      // D-tier Red
}

export function getWinRateTierBgColor(winRate: number): string {
  if (winRate >= 35) return 'bg-[#FFD700]/20';  // S-tier Gold
  if (winRate >= 28) return 'bg-[#33D9B2]/20';  // A-tier Cyan
  if (winRate >= 22) return 'bg-[#4FACFE]/20';  // B-tier Blue
  return 'bg-[#FF6B6B]/20';                      // D-tier Red
}
