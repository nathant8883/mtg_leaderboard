import { useState, useEffect } from 'react';
import { MatchupMatrix } from './MatchupMatrix';
import { GamesTogetherStats } from './GamesTogetherStats';
import { podDynamicsApi } from '../../services/api';
import type { MatchupsData, GamesTogetherData } from '../../services/api';
import { Grid3X3, Users } from 'lucide-react';

interface RelationshipsTabProps {
  playerId?: string;
}

export function RelationshipsTab({ playerId }: RelationshipsTabProps) {
  const [matchupsData, setMatchupsData] = useState<MatchupsData | null>(null);
  const [gamesTogetherData, setGamesTogetherData] = useState<GamesTogetherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [matchups, gamesTogether] = await Promise.all([
        podDynamicsApi.getMatchups(),
        podDynamicsApi.getGamesTogether(playerId),
      ]);
      setMatchupsData(matchups);
      setGamesTogetherData(gamesTogether);
    } catch (err) {
      console.error('Error loading relationships data:', err);
      setError('Failed to load relationships data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#667eea]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-[#FF6B6B] mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-[#667eea] text-white rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  const hasMatchupData = matchupsData && matchupsData.players.length > 0;
  const hasPartnerData = gamesTogetherData && gamesTogetherData.partners.length > 0;

  if (!hasMatchupData && !hasPartnerData) {
    return (
      <div className="text-center py-12 text-[#909296]">
        <p>Play some games to see your relationships data!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Head-to-Head Matrix */}
      {hasMatchupData && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Grid3X3 size={18} className="text-[#667eea]" />
            Head-to-Head Matchups
          </h3>
          <MatchupMatrix data={matchupsData} currentPlayerId={playerId} />
        </div>
      )}

      {/* Games Together Stats */}
      {hasPartnerData && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={18} className="text-[#667eea]" />
            Your Opponents
          </h3>
          <GamesTogetherStats data={gamesTogetherData} />
        </div>
      )}
    </div>
  );
}
