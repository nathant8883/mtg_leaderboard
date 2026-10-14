import type { SeasonBadgeRef } from '../services/api';

export interface SeasonBadgeStyle {
  label: string;       // "Season Champion"
  emoji: string;
  color: string;
  glow: string;
}

const PLACEMENT_COLORS = {
  1: { color: '#FFD700', glow: 'rgba(255, 215, 0, 0.5)', emoji: '👑' },
  2: { color: '#C0C0C0', glow: 'rgba(192, 192, 192, 0.4)', emoji: '🥈' },
  3: { color: '#CD7F32', glow: 'rgba(205, 127, 50, 0.4)', emoji: '🥉' },
} as const;

const PEAK_ELO_STYLE = { color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.45)', emoji: '⚡' };

const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

export function getSeasonBadgeStyle(badge: Pick<SeasonBadgeRef, 'award_type' | 'placement'>): SeasonBadgeStyle {
  if (badge.award_type === 'peak_elo') {
    return { label: 'Peak Elo', ...PEAK_ELO_STYLE };
  }
  const placement = PLACEMENT_COLORS[badge.placement as 1 | 2 | 3] ?? PLACEMENT_COLORS[3];
  if (badge.award_type === 'deck_placement') {
    const deckEmoji = badge.placement === 1 ? '🏆' : placement.emoji;
    return {
      label: badge.placement === 1 ? 'Top Deck' : `${ORDINAL[badge.placement] ?? `#${badge.placement}`} Deck`,
      ...placement,
      emoji: deckEmoji,
    };
  }
  return {
    label: badge.placement === 1 ? 'Season Champion' : `${ORDINAL[badge.placement] ?? `#${badge.placement}`} Place`,
    ...placement,
  };
}

/** Short chip text, e.g. "S1 #1" or "S2 ⚡" */
export function shortBadgeLabel(badge: SeasonBadgeRef): string {
  return badge.award_type === 'peak_elo' ? `S${badge.season} Peak` : `S${badge.season} #${badge.placement}`;
}

/** Most prestigious badges first: champion > top deck > 2nd/3rd > peak, newest season first */
export function sortBadges<T extends SeasonBadgeRef>(badges: T[]): T[] {
  const rank = (b: SeasonBadgeRef) => (b.award_type === 'peak_elo' ? 4 : b.placement);
  return [...badges].sort((a, b) => rank(a) - rank(b) || b.season - a.season);
}
