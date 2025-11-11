import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerLeaderboard from './PlayerLeaderboard';
import DeckLeaderboard from './DeckLeaderboard';
import { leaderboardApi, type PlayerLeaderboardEntry, type DeckLeaderboardEntry } from '../services/api';

type LeaderboardTab = 'players' | 'decks';

function Leaderboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('players');
  const [players, setPlayers] = useState<PlayerLeaderboardEntry[]>([]);
  const [decks, setDecks] = useState<DeckLeaderboardEntry[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(true);

  useEffect(() => {
    loadPlayerLeaderboard();
    loadDeckLeaderboard();

    // Listen for pod switch events to refresh leaderboards
    const handlePodSwitch = () => {
      loadPlayerLeaderboard();
      loadDeckLeaderboard();
    };

    window.addEventListener('podSwitched', handlePodSwitch);
    return () => {
      window.removeEventListener('podSwitched', handlePodSwitch);
    };
  }, []);

  const loadPlayerLeaderboard = async () => {
    try {
      setLoadingPlayers(true);
      const data = await leaderboardApi.getPlayerLeaderboard();
      setPlayers(data);
    } catch (err) {
      console.error('Error loading player leaderboard:', err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const loadDeckLeaderboard = async () => {
    try {
      setLoadingDecks(true);
      const data = await leaderboardApi.getDeckLeaderboard();
      setDecks(data);
    } catch (err) {
      console.error('Error loading deck leaderboard:', err);
    } finally {
      setLoadingDecks(false);
    }
  };

  return (
    <div className="bg-gradient-card rounded-[12px] p-6 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
      <h2 className="text-white m-0 text-2xl font-semibold">Leaderboard</h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-[#2C2E33] pb-0">
        <button
          className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => setActiveTab('players')}
        >
          👥 Players
        </button>
        <button
          className={`tab-btn ${activeTab === 'decks' ? 'active' : ''}`}
          onClick={() => setActiveTab('decks')}
        >
          🃏 Decks
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-0">
        {activeTab === 'players' && (
          <PlayerLeaderboard players={players} loading={loadingPlayers} onPlayerClick={(id) => navigate(`/players/${id}`)} />
        )}
        {activeTab === 'decks' && (
          <DeckLeaderboard decks={decks} loading={loadingDecks} onPlayerClick={(id) => navigate(`/players/${id}`)} />
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
