interface RankBadgeOverlayProps {
  rank: 1 | 2 | 3;
  size?: 'sm' | 'md' | 'lg';
}

const RANK_CONFIG = {
  1: {
    icon: '👑',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    glow: '0 0 12px rgba(255, 215, 0, 0.6)',
    glowClass: 'rank-overlay-gold',
  },
  2: {
    icon: '🥈',
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
    glow: '0 0 10px rgba(192, 192, 192, 0.5)',
    glowClass: 'rank-overlay-silver',
  },
  3: {
    icon: '🥉',
    gradient: 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)',
    glow: '0 0 10px rgba(205, 127, 50, 0.5)',
    glowClass: 'rank-overlay-bronze',
  },
} as const;

const SIZE_STYLES = {
  sm: {
    container: 'w-7 h-7 text-sm',
    number: 'text-[10px]',
  },
  md: {
    container: 'w-9 h-9 text-lg',
    number: 'text-xs',
  },
  lg: {
    container: 'w-11 h-11 text-xl',
    number: 'text-sm',
  },
};

export function RankBadgeOverlay({ rank, size = 'md' }: RankBadgeOverlayProps) {
  const config = RANK_CONFIG[rank];
  const styles = SIZE_STYLES[size];

  return (
    <div
      className={`${styles.container} ${config.glowClass} rounded-full flex items-center justify-center font-bold text-white`}
      style={{
        background: config.gradient,
        boxShadow: config.glow,
      }}
    >
      {config.icon}
    </div>
  );
}

export default RankBadgeOverlay;
