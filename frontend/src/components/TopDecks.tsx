import { useState, useEffect } from 'react';
import ColorPips from './ColorPips';
import { leaderboardApi, type DeckLeaderboardEntry } from '../services/api';

interface TopDecksProps {
  onViewLeaderboard: () => void;
}

function TopDecks({ onViewLeaderboard }: TopDecksProps) {
  const [decks, setDecks] = useState<DeckLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopDecks();
  }, []);

  const loadTopDecks = async () => {
    try {
      setLoading(true);
      const data = await leaderboardApi.getDeckLeaderboard();
      setDecks(data.slice(0, 3)); // Get top 3
    } catch (err) {
      console.error('Error loading top decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string } => {
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆' };
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐' };
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎' };
    return { class: 'd-tier', letter: 'D', icon: '📉' };
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="card-title">Top Decks</h2>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading top decks...</p>
        </div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Top Decks</h2>
        <div className="empty-state">
          <div className="empty-icon">🃏</div>
          <h3>No deck data yet</h3>
          <p>Record some matches to see the top decks!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Top Decks</h2>
        <button className="view-all-link" onClick={onViewLeaderboard}>
          View All
        </button>
      </div>
      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Deck</th>
              <th className="center">Colors</th>
              <th className="center">Record</th>
              <th className="center">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {decks.map((deck, index) => {
              const rank = index + 1;
              const tier = getWinRateTier(deck.win_rate / 100);
              return (
                <tr key={deck.deck_id}>
                  <td>
                    <div className={getRankBadgeClass(rank)}>
                      {rank}
                    </div>
                  </td>
                  <td>
                    <div>
                      <div className="deck-name">{deck.deck_name}</div>
                      <div className="commander-name" style={{ fontSize: '13px', marginTop: '2px' }}>
                        {deck.commander}
                      </div>
                    </div>
                  </td>
                  <td className="center">
                    <ColorPips colors={deck.colors} />
                  </td>
                  <td className="center">
                    <span className="stat-value">{deck.wins}-{deck.losses}</span>
                  </td>
                  <td className="center">
                    <div className={`winrate-compact ${tier.class}`}>
                      <div className="tier-icon-compact">{tier.icon}</div>
                      <div className="winrate-info-compact">
                        <div className="tier-name-compact">{tier.letter} Tier</div>
                        <div className="winrate-value-compact">{deck.win_rate.toFixed(1)}%</div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TopDecks;
