import { Flame, Snowflake, TrendingUp, Star, Crown, Swords, Clock, Zap } from 'lucide-react';
import type { Insight } from '../../services/api';

interface InsightCardProps {
  insight: Insight;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; iconColor: string }> = {
  streak: { bg: 'bg-[#FF6B6B]/10', border: 'border-[#FF6B6B]/30', iconColor: 'text-[#FF6B6B]' },
  cold_streak: { bg: 'bg-[#667eea]/10', border: 'border-[#667eea]/30', iconColor: 'text-[#667eea]' },
  rising: { bg: 'bg-[#33D9B2]/10', border: 'border-[#33D9B2]/30', iconColor: 'text-[#33D9B2]' },
  underdog: { bg: 'bg-[#FFD700]/10', border: 'border-[#FFD700]/30', iconColor: 'text-[#FFD700]' },
  dominant: { bg: 'bg-[#764ba2]/10', border: 'border-[#764ba2]/30', iconColor: 'text-[#764ba2]' },
  rivalry: { bg: 'bg-[#FFA500]/10', border: 'border-[#FFA500]/30', iconColor: 'text-[#FFA500]' },
  duration: { bg: 'bg-[#909296]/10', border: 'border-[#909296]/30', iconColor: 'text-[#909296]' },
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  flame: Flame,
  snowflake: Snowflake,
  'trending-up': TrendingUp,
  star: Star,
  crown: Crown,
  swords: Swords,
  clock: Clock,
  zap: Zap,
};

export function InsightCard({ insight }: InsightCardProps) {
  const style = TYPE_STYLES[insight.type] || TYPE_STYLES.duration;
  const IconComponent = ICON_MAP[insight.icon] || Star;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl ${style.bg} border ${style.border} transition-all hover:scale-[1.02]`}
    >
      <div className={`flex-shrink-0 ${style.iconColor}`}>
        <IconComponent size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-semibold text-sm mb-0.5">{insight.title}</h4>
        <p className="text-[#909296] text-xs leading-relaxed">{insight.description}</p>
      </div>
    </div>
  );
}
