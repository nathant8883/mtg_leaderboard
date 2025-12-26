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
      '--border-glow': `0 0 4px ${COLORLESS.glow}`,
    } as CSSProperties;
  }

  if (sortedColors.length === 1) {
    // Single color - solid with matching glow
    const color = MANA_COLORS[sortedColors[0]];
    return {
      '--border-gradient': `linear-gradient(135deg, ${color.primary} 0%, ${color.primary}dd 100%)`,
      '--border-glow': `0 0 5px ${color.glow}`,
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
    '--border-glow': `0 0 4px ${firstColor.glow}, 0 0 4px ${lastColor.glow}`,
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

// Color identity names (guilds, shards, wedges, etc.)
export const COLOR_IDENTITY_NAMES: Record<string, string> = {
  // Mono-color
  'B': 'Mono-Black',
  'G': 'Mono-Green',
  'R': 'Mono-Red',
  'U': 'Mono-Blue',
  'W': 'Mono-White',
  // Guilds
  'BU': 'Dimir',
  'BW': 'Orzhov',
  'BG': 'Golgari',
  'BR': 'Rakdos',
  'GU': 'Simic',
  'GW': 'Selesnya',
  'GR': 'Gruul',
  'RU': 'Izzet',
  'RW': 'Boros',
  'UW': 'Azorius',
  // Shards
  'BUW': 'Esper',
  'BRU': 'Grixis',
  'BGR': 'Jund',
  'GRW': 'Naya',
  'GUW': 'Bant',
  // Wedges
  'BGU': 'Sultai',
  'BGW': 'Abzan',
  'BRW': 'Mardu',
  'GRU': 'Temur',
  'RUW': 'Jeskai',
  // Four-color
  'BGRW': 'Dune',
  'BGUW': 'Witch',
  'BRUW': 'Yore',
  'GRUW': 'Glint',
  // Five-color
  'BGRUW': 'WUBRG',
};

/**
 * Get the name of a color identity (e.g., "GW" -> "Selesnya")
 */
export function getColorIdentityName(identity: string): string {
  if (!identity || identity === 'C') return 'Colorless';
  // Sort letters alphabetically to match map keys
  const sorted = identity.split('').sort().join('');
  return COLOR_IDENTITY_NAMES[sorted] || `${identity.length}-Color`;
}

/**
 * Get gradient stops for multi-color identities (for SVG gradients)
 * Returns array of { offset: string, color: string }
 */
export function getColorGradientStops(identity: string): { offset: string; color: string }[] {
  if (!identity || identity === 'C' || identity === 'Colorless') {
    return [
      { offset: '0%', color: COLORLESS.primary },
      { offset: '100%', color: '#4B5563' },
    ];
  }

  const colors = sortColors(identity.split(''));
  if (colors.length === 0) {
    return [
      { offset: '0%', color: COLORLESS.primary },
      { offset: '100%', color: '#4B5563' },
    ];
  }

  if (colors.length === 1) {
    const color = MANA_COLORS[colors[0]].primary;
    return [
      { offset: '0%', color },
      { offset: '100%', color },
    ];
  }

  // Multi-color - create gradient stops
  return colors.map((c, i) => ({
    offset: `${(i / (colors.length - 1)) * 100}%`,
    color: MANA_COLORS[c].primary,
  }));
}

/**
 * Get CSS linear-gradient string for multi-color identities
 */
export function getColorGradientCSS(identity: string): string {
  const stops = getColorGradientStops(identity);
  const stopsStr = stops.map(s => `${s.color} ${s.offset}`).join(', ');
  return `linear-gradient(135deg, ${stopsStr})`;
}
