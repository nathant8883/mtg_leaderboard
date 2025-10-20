import { useState, useEffect } from 'react';
import { Clock, Users, Calendar } from 'lucide-react';
import ColorPips from './ColorPips';
import { matchApi, type Match, type MatchPlayer } from '../services/api';

interface MatchDetailProps {
  matchId: string;
  onBack: () => void;
}

function MatchDetail({ matchId, onBack }: MatchDetailProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatchDetail();
  }, [matchId]);

  const loadMatchDetail = async () => {
    try {
      setLoading(true);
      const data = await matchApi.getById(matchId);
      setMatch(data);
    } catch (err) {
      console.error('Error loading match detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    // Parse date string as local date to avoid UTC timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Duration not recorded';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPlacementBadge = (placement: number): string => {
    const badges = ['🥇', '🥈', '🥉', '4️⃣'];
    return badges[placement - 1] || '';
  };

  const getPlacementText = (placement: number): string => {
    const texts = ['1st Place', '2nd Place', '3rd Place', '4th Place'];
    return texts[placement - 1] || `${placement}th Place`;
  };

  // Sort players by elimination_order if available
  const getSortedPlayers = (): MatchPlayer[] => {
    if (!match) return [];

    // Check if elimination order is available
    const hasEliminationOrder = match.players.some(p => p.elimination_order !== undefined && p.elimination_order !== null);

    if (hasEliminationOrder) {
      // Sort by elimination_order
      return [...match.players].sort((a, b) => {
        const orderA = a.elimination_order ?? 999;
        const orderB = b.elimination_order ?? 999;
        return orderA - orderB;
      });
    } else {
      // Only winner known - show winner first, then others
      return [...match.players].sort((a, b) => {
        if (a.is_winner) return -1;
        if (b.is_winner) return 1;
        return 0;
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen">
        <div className="text-center py-[60px] px-5">
          <div className="loading-spinner"></div>
          <p className="text-[#909296] text-sm">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="w-full min-h-screen">
        <div className="text-center py-[60px] px-5">
          <div className="text-[64px] mb-4">❌</div>
          <h3 className="text-white text-xl mb-2">Match not found</h3>
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  const sortedPlayers = getSortedPlayers();
  const hasEliminationOrder = match.players.some(p => p.elimination_order !== undefined && p.elimination_order !== null);

  return (
    <div className="w-full min-h-screen">
      {/* Navigation Bar - Hidden on mobile */}
      <div className="player-nav-bar max-md:hidden">
        <div className="player-nav-content">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <span className="nav-title">
            Match Details • {formatDate(match.match_date)}
          </span>
        </div>
      </div>

      {/* Match Info Section */}
      <div className="max-w-[1400px] mx-auto mb-8 px-6">
        <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-8 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
          <div className="flex items-center gap-4">
            <Calendar className="text-[#667eea] flex-shrink-0" size={20} />
            <div>
              <div className="text-xs text-[#909296] uppercase tracking-[0.5px] mb-1">Date</div>
              <div className="text-lg font-semibold text-white">{formatDate(match.match_date)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Clock className="text-[#667eea] flex-shrink-0" size={20} />
            <div>
              <div className="text-xs text-[#909296] uppercase tracking-[0.5px] mb-1">Duration</div>
              <div className="text-lg font-semibold text-white">{formatDuration(match.duration_seconds)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Users className="text-[#667eea] flex-shrink-0" size={20} />
            <div>
              <div className="text-xs text-[#909296] uppercase tracking-[0.5px] mb-1">Players</div>
              <div className="text-lg font-semibold text-white">{match.players.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final Standings Section */}
      <div className="max-w-[1400px] mx-auto px-6 pb-24 md:pb-10">
        <h2 className="text-2xl font-semibold text-white mb-6">
          {hasEliminationOrder ? 'Final Standings' : 'Match Result'}
        </h2>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {sortedPlayers.map((player) => (
            <div
              key={`${player.player_id}-${player.deck_id}`}
              className={`bg-[linear-gradient(135deg,#25262B_0%,#27282D_100%)] border border-[#2C2E33] rounded-[16px] p-6 transition-all duration-300 relative hover:border-[#667eea] hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${
                player.is_winner ? 'border-[#FFA500]' : ''
              }`}
            >
              {hasEliminationOrder && player.elimination_order && (
                <div className="flex items-center gap-2 mb-4 py-2 px-4 rounded-[8px] bg-[rgba(102,126,234,0.1)] border border-[rgba(102,126,234,0.2)]">
                  <span className="text-2xl">{getPlacementBadge(player.elimination_order)}</span>
                  <span className="text-sm font-semibold text-[#667eea] uppercase tracking-[0.5px]">{getPlacementText(player.elimination_order)}</span>
                </div>
              )}
              {!hasEliminationOrder && player.is_winner && (
                <div className="flex items-center gap-2 mb-4 py-2 px-4 rounded-[8px] bg-[rgba(255,165,0,0.1)] border border-[rgba(255,165,0,0.3)]">
                  <span className="text-2xl">🏆</span>
                  <span className="text-sm font-semibold text-[#FFA500] uppercase tracking-[0.5px]">Winner</span>
                </div>
              )}
              {!hasEliminationOrder && !player.is_winner && (
                <div className="text-xs text-[#909296] uppercase tracking-[0.5px] mb-4">Participant</div>
              )}

              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-white mb-2">{player.player_name}</h3>
                  <div className="text-sm text-[#909296]">{player.deck_name}</div>
                </div>
                <div className="flex-shrink-0">
                  <ColorPips colors={player.deck_colors} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MatchDetail;
