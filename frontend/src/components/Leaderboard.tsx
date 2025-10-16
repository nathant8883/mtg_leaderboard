import { useState, useEffect } from 'react';
import PlayerLeaderboard from './PlayerLeaderboard';
import DeckLeaderboard from './DeckLeaderboard';
import { leaderboardApi, type PlayerLeaderboardEntry, type DeckLeaderboardEntry } from '../services/api';

type LeaderboardTab = 'players' | 'decks';

interface LeaderboardProps {
  onPlayerClick: (playerId: string) => void;
}

function Leaderboard({ onPlayerClick }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('players');
  const [players, setPlayers] = useState<PlayerLeaderboardEntry[]>([]);
  const [decks, setDecks] = useState<DeckLeaderboardEntry[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(true);

  useEffect(() => {
    loadPlayerLeaderboard();
    loadDeckLeaderboard();
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
    <div className="card">
      <h2 className="card-title">Leaderboard</h2>

      {/* Tab Navigation */}
      <div className="tabs">
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
      <div className="tab-content">
        {activeTab === 'players' && (
          <PlayerLeaderboard players={players} loading={loadingPlayers} onPlayerClick={onPlayerClick} />
        )}
        {activeTab === 'decks' && (
          <DeckLeaderboard decks={decks} loading={loadingDecks} onPlayerClick={onPlayerClick} />
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
