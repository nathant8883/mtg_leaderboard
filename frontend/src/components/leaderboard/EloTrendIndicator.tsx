import { TIER_CONFIG, type TierLetter } from '../../utils/tierConfig';

interface EloTrendIndicatorProps {
  elo: number;
  eloChange?: number;
  tier: TierLetter;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_STYLES = {
  sm: {
    elo: 'text-lg font-bold',
    change: 'text-[10px] font-semibold px-1.5 py-0.5',
    gap: 'gap-1.5',
  },
  md: {
    elo: 'text-2xl font-bold',
    change: 'text-xs font-semibold px-2 py-0.5',
    gap: 'gap-2',
  },
  lg: {
    elo: 'text-3xl font-bold',
    change: 'text-sm font-semibold px-2.5 py-1',
    gap: 'gap-2.5',
  },
};

export function EloTrendIndicator({
  elo,
  eloChange,
  tier,
  size = 'md',
}: EloTrendIndicatorProps) {
  const tierConfig = TIER_CONFIG[tier];
  const styles = SIZE_STYLES[size];

  const hasChange = eloChange !== undefined && eloChange !== 0;
  const isPositive = eloChange !== undefined && eloChange > 0;

  return (
    <div className={`inline-flex items-center ${styles.gap}`}>
      <span
        className={styles.elo}
        style={{ color: tierConfig.color }}
      >
        {elo}
      </span>

      {hasChange && (
        <span
          className={`${styles.change} rounded-full inline-flex items-center gap-0.5 ${
            isPositive
              ? 'bg-[#33D9B2]/20 text-[#33D9B2]'
              : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
          }`}
        >
          <span className="elo-trend-arrow">
            {isPositive ? '▲' : '▼'}
          </span>
          {isPositive ? '+' : ''}{Math.round(eloChange!)}
        </span>
      )}
    </div>
  );
}

export default EloTrendIndicator;
