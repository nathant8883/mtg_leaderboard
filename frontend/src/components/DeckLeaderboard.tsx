import ColorPips from './ColorPips';
import type { DeckLeaderboardEntry } from '../services/api';

interface DeckLeaderboardProps {
  decks: DeckLeaderboardEntry[];
  loading?: boolean;
}

function DeckLeaderboard({ decks, loading = false }: DeckLeaderboardProps) {
  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string } => {
    // S-Tier: 35%+ (too strong)
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆' };
    // A-Tier: 28-35% (above baseline)
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐' };
    // B-Tier: 22-28% (balanced, around 25% baseline)
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎' };
    // D-Tier: Below 22% (underperforming)
    return { class: 'd-tier', letter: 'D', icon: '📉' };
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading deck leaderboard...</p>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🃏</div>
        <h3>No deck data yet</h3>
        <p>Record some matches to see the leaderboard!</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-table-container">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Deck</th>
            <th>Commander</th>
            <th className="center">Colors</th>
            <th className="center">Games</th>
            <th className="center">Wins</th>
            <th className="center">Losses</th>
            <th className="center">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {decks.map((deck, index) => {
            const rank = index + 1;
            return (
              <tr key={deck.deck_id}>
                <td>
                  <div className={getRankBadgeClass(rank)}>
                    {rank}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="player-avatar-badge">
                      {deck.player_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="player-name">{deck.player_name}</span>
                  </div>
                </td>
                <td>
                  <span className="deck-name">{deck.deck_name}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {deck.commander_image_url ? (
                      <div
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '2px solid #2C2E33',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={deck.commander_image_url}
                          alt={deck.commander}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center 20%',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="player-avatar-badge"
                        style={{
                          width: '60px',
                          height: '60px',
                          flexShrink: 0,
                          fontSize: '24px',
                        }}
                      >
                        🎴
                      </div>
                    )}
                    <span className="commander-name">{deck.commander}</span>
                  </div>
                </td>
                <td className="center">
                  <ColorPips colors={deck.colors} />
                </td>
                <td className="center">
                  <span className="stat-value">{deck.games_played}</span>
                </td>
                <td className="center">
                  <span className="stat-value">{deck.wins}</span>
                </td>
                <td className="center">
                  <span className="stat-value">{deck.losses}</span>
                </td>
                <td className="center">
                  {(() => {
                    const tier = getWinRateTier(deck.win_rate / 100);
                    return (
                      <div className={`winrate-compact ${tier.class}`}>
                        <div className="tier-icon-compact">{tier.icon}</div>
                        <div className="winrate-info-compact">
                          <div className="tier-name-compact">{tier.letter} Tier</div>
                          <div className="winrate-value-compact">{deck.win_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DeckLeaderboard;
