import { Users, Heart, Skull, Trophy } from 'lucide-react';
import type { GamesTogetherData, PartnerStats } from '../../services/api';

interface GamesTogetherStatsProps {
  data: GamesTogetherData;
}

function PartnerCard({
  partner,
  type,
  icon,
  accentColor,
}: {
  partner: PartnerStats | null;
  type: string;
  icon: React.ReactNode;
  accentColor: string;
}) {
  if (!partner) {
    return (
      <div className="bg-[#141517] rounded-lg p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-[#909296] text-sm mb-2">
          {icon}
          <span>{type}</span>
        </div>
        <div className="text-[#909296] text-xs">Need more games</div>
      </div>
    );
  }

  return (
    <div className="bg-[#141517] rounded-lg p-4">
      <div className="flex items-center justify-center gap-2 text-[#909296] text-sm mb-2">
        {icon}
        <span>{type}</span>
      </div>
      <div className={`text-lg font-bold ${accentColor} text-center truncate`}>
        {partner.player_name}
      </div>
      <div className="text-center mt-2">
        <span className={`text-2xl font-bold ${accentColor}`}>
          {partner.my_win_rate.toFixed(0)}%
        </span>
        <span className="text-[#909296] text-xs ml-1">win rate</span>
      </div>
      <div className="text-center text-xs text-[#909296] mt-1">
        {partner.games_together} games together
      </div>
    </div>
  );
}

export function GamesTogetherStats({ data }: GamesTogetherStatsProps) {
  const { partners, most_played_with, best_partner, nemesis } = data;

  if (partners.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No partner data available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Highlight Cards */}
      <div className="grid grid-cols-3 gap-3">
        <PartnerCard
          partner={best_partner}
          type="Best Partner"
          icon={<Heart size={14} />}
          accentColor="text-[#33D9B2]"
        />
        <PartnerCard
          partner={most_played_with}
          type="Most Played"
          icon={<Users size={14} />}
          accentColor="text-[#667eea]"
        />
        <PartnerCard
          partner={nemesis}
          type="Nemesis"
          icon={<Skull size={14} />}
          accentColor="text-[#FF6B6B]"
        />
      </div>

      {/* All Partners List */}
      <div className="bg-[#141517] rounded-lg p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-[#667eea]" />
          All Opponents
        </h4>
        <div className="space-y-2">
          {[...partners].sort((a, b) => b.my_win_rate - a.my_win_rate).map((partner) => (
            <div
              key={partner.player_id}
              className="flex items-center justify-between p-2 rounded-lg bg-[#1A1B1E] hover:bg-[#2C2E33] transition-colors"
            >
              <div className="flex items-center gap-3">
                {partner.avatar ? (
                  <img
                    src={partner.avatar}
                    alt={partner.player_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#667eea]/20 flex items-center justify-center text-[#667eea] text-sm font-bold">
                    {partner.player_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-white font-medium text-sm">
                    {partner.player_name}
                  </div>
                  <div className="text-xs text-[#909296]">
                    {partner.games_together} games
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`font-bold ${
                    partner.my_win_rate >= 50 ? 'text-[#33D9B2]' : 'text-[#FF6B6B]'
                  }`}
                >
                  {partner.my_win_rate.toFixed(0)}%
                </div>
                <div className="text-xs text-[#909296]">
                  {partner.my_wins}W / {partner.their_wins}L
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
