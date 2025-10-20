import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCards from '../components/StatsCards';
import TopPlayers from '../components/TopPlayers';
import TopDecks from '../components/TopDecks';
import RecentMatches from '../components/RecentMatches';
import type { Match } from '../services/api';
import { matchApi } from '../services/api';
import type { PendingMatch } from '../App';
import offlineQueue from '../services/offlineQueue';

/**
 * Dashboard page - main landing page showing stats, top players/decks, and recent matches
 */
export function Dashboard() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    loadMatches();
    loadPendingMatches();

    // Listen for refresh events from MainLayout
    const handleRefreshMatches = () => {
      loadMatches();
      loadPendingMatches();
    };

    window.addEventListener('refreshMatches', handleRefreshMatches);
    return () => {
      window.removeEventListener('refreshMatches', handleRefreshMatches);
    };
  }, []);

  const loadMatches = async () => {
    try {
      setLoadingMatches(true);
      const matchesData = await matchApi.getRecent(3);
      setMatches(matchesData);
    } catch (err) {
      console.error('Error loading matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const loadPendingMatches = async () => {
    try {
      const allQueuedMatches = await offlineQueue.getAllMatches();
      // Convert queued matches to PendingMatch format
      const pending: PendingMatch[] = allQueuedMatches.map((qm) => ({
        id: qm.id,
        _pending: true as const,
        _tempId: qm.id,
        _canUndo: false, // Can't undo from dashboard view
        players: qm.matchData.player_deck_pairs.map((pair) => ({
          player_id: pair.player_id,
          player_name: qm.playerNames[pair.player_id] || 'Unknown Player',
          deck_id: pair.deck_id,
          deck_name: qm.deckNames[pair.deck_id] || 'Unknown Deck',
          deck_colors: qm.deckColors[pair.deck_id] || [],
          is_winner: pair.player_id === qm.matchData.winner_player_id,
        })),
        winner_player_id: qm.matchData.winner_player_id,
        winner_deck_id: qm.matchData.winner_deck_id,
        match_date: qm.matchData.match_date,
        created_at: qm.createdAt,
      }));
      setPendingMatches(pending);
    } catch (err) {
      console.error('Error loading pending matches:', err);
    }
  };

  const handleViewPlayerDetail = (playerId: string) => {
    navigate(`/players/${playerId}`);
  };

  return (
    <div>
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TopPlayers
          onViewLeaderboard={() => navigate('/leaderboard')}
          onPlayerClick={handleViewPlayerDetail}
        />
        <TopDecks
          onViewLeaderboard={() => navigate('/leaderboard')}
          onPlayerClick={handleViewPlayerDetail}
        />
      </div>

      <RecentMatches
        matches={[...pendingMatches, ...matches]}
        loading={loadingMatches}
      />
    </div>
  );
}
