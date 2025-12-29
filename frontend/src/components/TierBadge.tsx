import { TIER_CONFIG, type TierLetter } from '../utils/tierConfig';

export type TierBadgeSize = 'sm' | 'md' | 'lg';
export type TierBadgeVariant = 'badge' | 'compact' | 'pill' | 'icon-only';

export interface TierBadgeProps {
  tier: TierLetter;
  size?: TierBadgeSize;
  variant?: TierBadgeVariant;
  showLetter?: boolean;
  showIcon?: boolean;
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    container: 'gap-1 px-1.5 py-0.5 rounded text-xs',
    iconSize: 'text-xs',
    letter: 'text-xs font-bold',
    compact: { width: 24, height: 24 },
  },
  md: {
    container: 'gap-1.5 px-2.5 py-1 rounded-[6px] text-sm',
    iconSize: 'text-sm',
    letter: 'text-sm font-bold',
    compact: { width: 32, height: 32 },
  },
  lg: {
    container: 'gap-2 px-3 py-1.5 rounded-lg text-base',
    iconSize: 'text-base',
    letter: 'text-base font-bold',
    compact: { width: 40, height: 40 },
  },
};

export function TierBadge({
  tier,
  size = 'md',
  variant = 'badge',
  showLetter = true,
  showIcon = true,
  className = '',
}: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const sizeStyles = SIZE_STYLES[size];

  if (variant === 'icon-only') {
    return (
      <span className={`${sizeStyles.iconSize} ${className}`} aria-label={`${tier} tier`}>
        {config.icon}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center justify-center ${config.bgClass} ${config.borderClass} border rounded-[6px] ${sizeStyles.iconSize} ${className}`}
        style={{
          width: sizeStyles.compact.width,
          height: sizeStyles.compact.height,
        }}
        aria-label={`${tier} tier`}
      >
        {showIcon && <span>{config.icon}</span>}
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center ${sizeStyles.container} ${config.bgClass} ${config.borderClass} border ${className}`}
        aria-label={`${tier} tier`}
      >
        {showIcon && <span className={sizeStyles.iconSize}>{config.icon}</span>}
        <span className={`${config.textClass} ${sizeStyles.letter}`}>{tier}</span>
      </div>
    );
  }

  // Default 'badge' variant - icon and letter with tier color background gradient
  return (
    <div
      className={`inline-flex items-center ${sizeStyles.container} ${config.cssClass} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${config.color}20 0%, ${config.color}10 100%)`,
        border: `1px solid ${config.color}30`,
      }}
      aria-label={`${tier} tier`}
    >
      {showIcon && <span className={sizeStyles.iconSize}>{config.icon}</span>}
      {showLetter && (
        <span className="font-bold" style={{ color: config.color }}>
          {tier}
        </span>
      )}
    </div>
  );
}

export default TierBadge;
