export type TierLetter = 'S' | 'A' | 'B' | 'C' | 'D';

export interface TierConfig {
  letter: TierLetter;
  icon: string;
  color: string;
  colorLight: string;
  cssClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

export const TIER_CONFIG: Record<TierLetter, TierConfig> = {
  S: {
    letter: 'S',
    icon: '🏆',
    color: '#FFD700',
    colorLight: '#FFA500',
    cssClass: 's-tier',
    textClass: 'text-[#FFD700]',
    bgClass: 'bg-[#FFD700]/20',
    borderClass: 'border-[#FFD700]/30',
  },
  A: {
    letter: 'A',
    icon: '⭐',
    color: '#33D9B2',
    colorLight: '#00C9A7',
    cssClass: 'a-tier',
    textClass: 'text-[#33D9B2]',
    bgClass: 'bg-[#33D9B2]/20',
    borderClass: 'border-[#33D9B2]/30',
  },
  B: {
    letter: 'B',
    icon: '💎',
    color: '#4FACFE',
    colorLight: '#00F2FE',
    cssClass: 'b-tier',
    textClass: 'text-[#4FACFE]',
    bgClass: 'bg-[#4FACFE]/20',
    borderClass: 'border-[#4FACFE]/30',
  },
  C: {
    letter: 'C',
    icon: '🔵',
    color: '#FFA500',
    colorLight: '#FF8C00',
    cssClass: 'c-tier',
    textClass: 'text-[#FFA500]',
    bgClass: 'bg-[#FFA500]/20',
    borderClass: 'border-[#FFA500]/30',
  },
  D: {
    letter: 'D',
    icon: '📉',
    color: '#FF6B6B',
    colorLight: '#FF5252',
    cssClass: 'd-tier',
    textClass: 'text-[#FF6B6B]',
    bgClass: 'bg-[#FF6B6B]/20',
    borderClass: 'border-[#FF6B6B]/30',
  },
};

/**
 * Calculate tier based on win rate thresholds (for decks)
 * Thresholds calibrated for 4-player commander (25% baseline)
 * @param winRate - Win rate as decimal (0-1) or percentage (0-100)
 */
export function getWinRateTier(winRate: number): TierLetter {
  const rate = winRate > 1 ? winRate / 100 : winRate;

  if (rate >= 0.35) return 'S'; // 35%+ (too strong)
  if (rate >= 0.28) return 'A'; // 28-35% (above baseline)
  if (rate >= 0.22) return 'B'; // 22-28% (balanced)
  return 'D'; // Below 22% (underperforming)
}

/**
 * Calculate tier based on Elo percentile (for players)
 * @param elo - Player's Elo rating
 * @param rankedElos - Array of all ranked player Elos (for percentile calculation)
 */
export function getEloTier(
  elo: number | undefined,
  rankedElos: number[]
): TierLetter {
  if (!elo || rankedElos.length === 0) {
    return 'D';
  }

  // Sort descending if not already
  const sortedElos = [...rankedElos].sort((a, b) => b - a);

  // Find position (handle ties by finding first occurrence)
  const position = sortedElos.findIndex((e) => e <= elo);
  const percentile = position === -1 ? 1 : position / sortedElos.length;

  // Top 25% = S, 25-50% = A, 50-75% = B, Bottom 25% = D
  if (percentile < 0.25) return 'S';
  if (percentile < 0.5) return 'A';
  if (percentile < 0.75) return 'B';
  return 'D';
}

/**
 * Get full tier configuration for a tier letter
 */
export function getTierConfig(tier: TierLetter): TierConfig {
  return TIER_CONFIG[tier];
}
