import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RecentMatches from '../components/RecentMatches';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import type { Match, Deck, EloHistoryPoint } from '../services/api';
import { matchApi, deckApi, podDynamicsApi } from '../services/api';

/**
 * Match History page - shows all matches for the current pod
 */
export function MatchHistory() {
  const navigate = useNavigate();
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod, loading: podLoading } = usePod();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [eloHistoryByPlayer, setEloHistoryByPlayer] = useState<Map<string, EloHistoryPoint[]>>(new Map());

  useEffect(() => {
    loadMatches();
    loadDecks();
  }, [currentPod]);

  const loadMatches = async () => {
    try {
      setLoadingMatches(true);
      // Load all matches (no limit)
      const matchesData = await matchApi.getAll();
      setMatches(matchesData);

      // Load ELO history for all unique players in these matches
      loadEloHistoryForMatches(matchesData);
    } catch (err) {
      console.error('Error loading matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const loadDecks = async () => {
    try {
      const decksData = await deckApi.getAll();
      setDecks(decksData);
    } catch (err) {
      console.error('Error loading decks:', err);
    }
  };

  const loadEloHistoryForMatches = async (matchesData: Match[]) => {
    try {
      // Get unique player IDs from matches
      const playerIds = new Set<string>();
      matchesData.forEach((match) => {
        match.players.forEach((player) => {
          playerIds.add(player.player_id);
        });
      });

      // Fetch ELO history for each player
      const historyMap = new Map<string, EloHistoryPoint[]>();
      await Promise.all(
        Array.from(playerIds).map(async (playerId) => {
          try {
            const data = await podDynamicsApi.getEloHistory(playerId);
            if (data.history && data.history.length > 0) {
              historyMap.set(playerId, data.history);
            }
          } catch (err) {
            // Silently fail for individual player - ELO just won't show
            console.debug(`Failed to load ELO history for player ${playerId}:`, err);
          }
        })
      );

      setEloHistoryByPlayer(historyMap);
    } catch (err) {
      console.error('Error loading ELO history:', err);
    }
  };

  // Create deck lookup map for RecentMatches
  const deckMap = useMemo(() => {
    const map = new Map<string, Deck>();
    decks.forEach((deck) => {
      if (deck.id) {
        map.set(deck.id, deck);
      }
    });
    return map;
  }, [decks]);

  // Show placeholder if authenticated but no pod selected
  if (!isGuest && currentPlayer && !currentPod && !podLoading) {
    return <NoPodPlaceholder />;
  }

  return (
    <div>
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-[8px] bg-[#25262B] border border-[#2C2E33] hover:bg-[#2C2E33] hover:border-[#667eea] transition-all"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-[#C1C2C5]" />
        </button>
        <h1 className="text-2xl font-bold text-white m-0">Match History</h1>
        <span className="text-[#909296] text-sm">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
      </div>

      <RecentMatches
        matches={matches}
        deckMap={deckMap}
        eloHistoryByPlayer={eloHistoryByPlayer}
        loading={loadingMatches}
      />
    </div>
  );
}
