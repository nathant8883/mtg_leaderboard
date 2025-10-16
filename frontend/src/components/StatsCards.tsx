import { useState, useEffect } from 'react';
import ColorPips from './ColorPips';
import { leaderboardApi, type DashboardStats } from '../services/api';

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

function StatsCards() {
  const getColorName = (color: string): string => {
    return COLOR_NAMES[color] || color;
  };
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await leaderboardApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLastGameDate = (dateStr: string | null): string => {
    if (!dateStr) return 'No games yet';

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  if (loading) {
    return (
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="loading-spinner"></div>
        </div>
        <div className="stat-card pink">
          <div className="loading-spinner"></div>
        </div>
        <div className="stat-card blue">
          <div className="loading-spinner"></div>
        </div>
        <div className="stat-card orange">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="stats-grid">
      {/* Total Games Card */}
      <div className="stat-card pink">
        <div className="stat-card-header">
          <div className="stat-icon-circle">⚔️</div>
          <div className="stat-header-text">
            <div className="stat-header-label">Total Games</div>
            <div className="stat-header-value">{stats.total_games}</div>
          </div>
        </div>
        <div className="stat-card-body">
          <div className="stat-card-details">
            Last game {formatLastGameDate(stats.last_game_date)}
          </div>
        </div>
      </div>

      {/* Most Games Played Card */}
      <div className="stat-card purple">
        <div className="stat-card-header">
          <div className="stat-icon-circle stat-icon-avatar">
            {stats.most_games_player ? (
              <div className="stat-player-avatar">
                {stats.most_games_player.player_name.charAt(0).toUpperCase()}
              </div>
            ) : (
              '👤'
            )}
          </div>
          <div className="stat-header-text">
            <div className="stat-header-label">Most Games</div>
            <div className="stat-header-value">
              {stats.most_games_player ? stats.most_games_player.player_name : '-'}
            </div>
          </div>
        </div>
        <div className="stat-card-body">
          <div className="stat-card-details">
            {stats.most_games_player ? `${stats.most_games_player.games_played} games played` : 'No data yet'}
          </div>
        </div>
      </div>

      {/* Most Played Deck Card */}
      <div className="stat-card blue">
        <div className="stat-card-header">
          <div className="stat-icon-circle stat-icon-commander">
            {stats.most_played_deck?.commander_image_url ? (
              <img
                src={stats.most_played_deck.commander_image_url}
                alt={stats.most_played_deck.deck_name}
                className="stat-commander-image"
              />
            ) : (
              '🃏'
            )}
          </div>
          <div className="stat-header-text">
            <div className="stat-header-label">Most Played</div>
            <div className="stat-header-value">
              {stats.most_played_deck ? stats.most_played_deck.deck_name : '-'}
            </div>
          </div>
        </div>
        <div className="stat-card-body">
          <div className="stat-card-details">
            {stats.most_played_deck
              ? `${stats.most_played_deck.player_name} • ${stats.most_played_deck.games_played} games`
              : 'No data yet'}
          </div>
        </div>
      </div>

      {/* Most Popular Color Card */}
      <div className="stat-card orange">
        <div className="stat-card-header">
          <div className="stat-icon-circle stat-icon-mana">
            {stats.most_popular_color ? (
              <ColorPips colors={[stats.most_popular_color.color]} />
            ) : (
              '🎨'
            )}
          </div>
          <div className="stat-header-text">
            <div className="stat-header-label">Popular Color</div>
            <div className="stat-header-value">
              {stats.most_popular_color ? getColorName(stats.most_popular_color.color) : '-'}
            </div>
          </div>
        </div>
        <div className="stat-card-body">
          <div className="stat-card-details">
            {stats.most_popular_color
              ? `${stats.most_popular_color.percentage}% of decks run ${getColorName(stats.most_popular_color.color)}`
              : 'No data yet'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsCards;
