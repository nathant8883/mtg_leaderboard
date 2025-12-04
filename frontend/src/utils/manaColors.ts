import type { CSSProperties } from 'react';

// MTG mana color definitions
export const MANA_COLORS = {
  W: { primary: '#F9FAF4', glow: 'rgba(249, 250, 244, 0.5)', name: 'White' },
  U: { primary: '#0E68AB', glow: 'rgba(14, 104, 171, 0.5)', name: 'Blue' },
  B: { primary: '#3D2F24', glow: 'rgba(61, 47, 36, 0.5)', name: 'Black' },
  R: { primary: '#D3202A', glow: 'rgba(211, 32, 42, 0.5)', name: 'Red' },
  G: { primary: '#00733E', glow: 'rgba(0, 115, 62, 0.5)', name: 'Green' },
} as const;

// Colorless fallback
const COLORLESS = {
  primary: '#6B7280',
  glow: 'rgba(107, 114, 128, 0.4)',
};

// WUBRG order for consistent sorting
const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G'];

type ManaColor = keyof typeof MANA_COLORS;

/**
 * Sort colors in WUBRG order
 */
function sortColors(colors: string[]): ManaColor[] {
  return [...colors]
    .filter((c): c is ManaColor => c in MANA_COLORS)
    .sort((a, b) => WUBRG_ORDER.indexOf(a) - WUBRG_ORDER.indexOf(b));
}

/**
 * Generate CSS custom properties for color identity border styling.
 * These properties are used by the player-card-border class.
 */
export function getColorIdentityStyle(colors: string[]): CSSProperties {
  const sortedColors = sortColors(colors);

  if (sortedColors.length === 0) {
    // Colorless - gray border with subtle glow
    return {
      '--border-gradient': `linear-gradient(135deg, ${COLORLESS.primary} 0%, #4B5563 100%)`,
      '--border-glow': `0 0 12px ${COLORLESS.glow}`,
    } as CSSProperties;
  }

  if (sortedColors.length === 1) {
    // Single color - solid with matching glow
    const color = MANA_COLORS[sortedColors[0]];
    return {
      '--border-gradient': `linear-gradient(135deg, ${color.primary} 0%, ${color.primary}dd 100%)`,
      '--border-glow': `0 0 15px ${color.glow}, 0 0 30px ${color.glow}`,
    } as CSSProperties;
  }

  // Multi-color - smooth gradient blend
  const gradientStops = sortedColors.map((c, i) => {
    const percentage = (i / (sortedColors.length - 1)) * 100;
    return `${MANA_COLORS[c].primary} ${percentage}%`;
  }).join(', ');

  // Use first and last colors for glow
  const firstColor = MANA_COLORS[sortedColors[0]];
  const lastColor = MANA_COLORS[sortedColors[sortedColors.length - 1]];

  return {
    '--border-gradient': `linear-gradient(135deg, ${gradientStops})`,
    '--border-glow': `0 0 12px ${firstColor.glow}, 0 0 12px ${lastColor.glow}`,
  } as CSSProperties;
}

/**
 * Get the dominant color for simpler styling contexts
 */
export function getDominantColor(colors: string[]): string {
  const sortedColors = sortColors(colors);
  if (sortedColors.length === 0) return COLORLESS.primary;
  return MANA_COLORS[sortedColors[0]].primary;
}
