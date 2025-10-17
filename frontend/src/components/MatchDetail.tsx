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
    const date = new Date(dateString);
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
      <div className="match-detail-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="match-detail-container">
        <div className="empty-state">
          <div className="empty-icon">❌</div>
          <h3>Match not found</h3>
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
    <div className="match-detail-container">
      {/* Navigation Bar */}
      <div className="player-nav-bar">
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
      <div className="match-metadata-section">
        <div className="match-metadata-card">
          <div className="metadata-item">
            <Calendar className="metadata-icon" size={20} />
            <div>
              <div className="metadata-label">Date</div>
              <div className="metadata-value">{formatDate(match.match_date)}</div>
            </div>
          </div>
          <div className="metadata-item">
            <Clock className="metadata-icon" size={20} />
            <div>
              <div className="metadata-label">Duration</div>
              <div className="metadata-value">{formatDuration(match.duration_seconds)}</div>
            </div>
          </div>
          <div className="metadata-item">
            <Users className="metadata-icon" size={20} />
            <div>
              <div className="metadata-label">Players</div>
              <div className="metadata-value">{match.players.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final Standings Section */}
      <div className="match-standings-section">
        <h2 className="section-title">
          {hasEliminationOrder ? 'Final Standings' : 'Match Result'}
        </h2>

        <div className="match-players-grid">
          {sortedPlayers.map((player) => (
            <div
              key={`${player.player_id}-${player.deck_id}`}
              className={`match-player-card ${player.is_winner ? 'winner' : ''}`}
            >
              {hasEliminationOrder && player.elimination_order && (
                <div className="placement-badge">
                  <span className="placement-emoji">{getPlacementBadge(player.elimination_order)}</span>
                  <span className="placement-text">{getPlacementText(player.elimination_order)}</span>
                </div>
              )}
              {!hasEliminationOrder && player.is_winner && (
                <div className="placement-badge winner-badge">
                  <span className="placement-emoji">🏆</span>
                  <span className="placement-text">Winner</span>
                </div>
              )}
              {!hasEliminationOrder && !player.is_winner && (
                <div className="participant-label">Participant</div>
              )}

              <div className="match-player-info">
                <div className="player-name-section">
                  <h3 className="match-player-name">{player.player_name}</h3>
                  <div className="match-deck-name">{player.deck_name}</div>
                </div>
                <div className="match-deck-colors">
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
