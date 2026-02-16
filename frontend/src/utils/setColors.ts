import type { DraftSet } from '../services/api';

// 12 curated color pairs for dark-theme set branding
// Each has a primary color and a lighter accent
const SET_PALETTE: Array<{ color: string; accent: string }> = [
  { color: '#667eea', accent: '#8b9cf7' }, // Indigo
  { color: '#e03131', accent: '#ff6b6b' }, // Red
  { color: '#2b8a3e', accent: '#51cf66' }, // Green
  { color: '#e8590c', accent: '#ff922b' }, // Orange
  { color: '#9c36b5', accent: '#cc5de8' }, // Purple
  { color: '#1098ad', accent: '#3bc9db' }, // Teal
  { color: '#c2255c', accent: '#f06595' }, // Pink
  { color: '#f59f00', accent: '#ffd43b' }, // Yellow
  { color: '#1864ab', accent: '#4dabf7' }, // Blue
  { color: '#5c940d', accent: '#94d82d' }, // Lime
  { color: '#862e9c', accent: '#da77f2' }, // Violet
  { color: '#0b7285', accent: '#22b8cf' }, // Cyan
];

/**
 * Simple string hash that deterministically maps a set code to a palette index.
 * Same code = same color every time.
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get color pair for a set code. Deterministic — same code always returns same colors.
 */
export function getSetColors(code: string): { color: string; accent: string } {
  const idx = hashCode(code.toUpperCase()) % SET_PALETTE.length;
  return SET_PALETTE[idx];
}

/**
 * Build a CSS gradient string for the header background based on draft sets.
 * - Single set: subtle tint from that set's color
 * - Multi-set: blend of first two set colors
 * - No sets: returns empty string (use default background)
 */
export function getSetGradientCSS(sets: DraftSet[]): string {
  if (!sets || sets.length === 0) return '';

  if (sets.length === 1) {
    const { color } = getSetColors(sets[0].code);
    return `linear-gradient(135deg, ${color}18 0%, transparent 60%)`;
  }

  // Multi-set: blend first two
  const c1 = getSetColors(sets[0].code).color;
  const c2 = getSetColors(sets[1].code).color;
  return `linear-gradient(135deg, ${c1}15 0%, ${c2}12 50%, transparent 80%)`;
}
