import type { Insight } from '../../services/api';

interface InsightCardProps {
  insight: Insight;
}

const TYPE_STYLES: Record<string, { bg: string; border: string }> = {
  streak: { bg: 'bg-[#FF6B6B]/10', border: 'border-[#FF6B6B]/30' },
  cold_streak: { bg: 'bg-[#667eea]/10', border: 'border-[#667eea]/30' },
  rising: { bg: 'bg-[#33D9B2]/10', border: 'border-[#33D9B2]/30' },
  underdog: { bg: 'bg-[#FFD700]/10', border: 'border-[#FFD700]/30' },
  dominant: { bg: 'bg-[#764ba2]/10', border: 'border-[#764ba2]/30' },
  rivalry: { bg: 'bg-[#FFA500]/10', border: 'border-[#FFA500]/30' },
  duration: { bg: 'bg-[#909296]/10', border: 'border-[#909296]/30' },
};

export function InsightCard({ insight }: InsightCardProps) {
  const style = TYPE_STYLES[insight.type] || TYPE_STYLES.duration;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl ${style.bg} border ${style.border} transition-all hover:scale-[1.02]`}
    >
      <div className="text-2xl flex-shrink-0">{insight.icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-semibold text-sm mb-0.5">{insight.title}</h4>
        <p className="text-[#909296] text-xs leading-relaxed">{insight.description}</p>
      </div>
    </div>
  );
}
