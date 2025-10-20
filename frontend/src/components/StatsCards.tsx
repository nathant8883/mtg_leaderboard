import { useState, useEffect } from 'react';
import ColorPips from './ColorPips';
import PlayerAvatar from './PlayerAvatar';
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mb-8 stats-grid-mobile">
        <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] overflow-hidden flex flex-col stat-card-purple">
          <div className="loading-spinner"></div>
        </div>
        <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] overflow-hidden flex flex-col stat-card-pink">
          <div className="loading-spinner"></div>
        </div>
        <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] overflow-hidden flex flex-col stat-card-blue">
          <div className="loading-spinner"></div>
        </div>
        <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] overflow-hidden flex flex-col stat-card-orange">
          <div className="loading-spinner"></div>
        </div>
        <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] overflow-hidden flex flex-col stat-card-purple">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mb-8 stats-grid-mobile">
      {/* Total Games Card */}
      <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] transition-all duration-150 ease-out overflow-hidden flex flex-col stat-card-hover stat-card-pink">
        <div className="bg-[var(--stat-color)] px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-[rgba(0,0,0,0.15)] rounded-full flex items-center justify-center text-[28px] flex-shrink-0 overflow-hidden relative">⚔️</div>
          <div className="flex-1 text-white">
            <div className="text-xs opacity-90 font-semibold uppercase tracking-wider mb-1">Total Games</div>
            <div className="text-2xl font-bold text-white">{stats.total_games}</div>
          </div>
        </div>
        <div className="px-6 py-5 bg-[#1A1B1E]">
          <div className="text-[#909296] text-[13px]">
            Last game {formatLastGameDate(stats.last_game_date)}
          </div>
        </div>
      </div>

      {/* Most Games Played Card */}
      <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] transition-all duration-150 ease-out overflow-hidden flex flex-col stat-card-hover stat-card-purple">
        <div className="bg-[var(--stat-color)] px-6 py-5 flex items-center gap-4">
          <div className="flex-shrink-0">
            {stats.most_games_player ? (
              <PlayerAvatar
                playerName={stats.most_games_player.player_name}
                customAvatar={stats.most_games_player.player_custom_avatar}
                picture={stats.most_games_player.player_picture}
                size="large"
                className="w-14 h-14"
              />
            ) : (
              <div className="w-14 h-14 bg-[rgba(0,0,0,0.15)] rounded-full flex items-center justify-center text-[28px]">
                👤
              </div>
            )}
          </div>
          <div className="flex-1 text-white">
            <div className="text-xs opacity-90 font-semibold uppercase tracking-wider mb-1">Most Games</div>
            <div className="text-2xl font-bold text-white">
              {stats.most_games_player ? stats.most_games_player.player_name : '-'}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 bg-[#1A1B1E]">
          <div className="text-[#909296] text-[13px]">
            {stats.most_games_player ? `${stats.most_games_player.games_played} games played` : 'No data yet'}
          </div>
        </div>
      </div>

      {/* Most Played Deck Card */}
      <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] transition-all duration-150 ease-out overflow-hidden flex flex-col stat-card-hover stat-card-blue">
        <div className="bg-[var(--stat-color)] px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-[rgba(0,0,0,0.15)] rounded-full flex items-center justify-center text-[28px] flex-shrink-0 overflow-hidden relative">
            {stats.most_played_deck?.commander_image_url ? (
              <img
                src={stats.most_played_deck.commander_image_url}
                alt={stats.most_played_deck.deck_name}
                className="w-full h-full object-cover object-[center_20%]"
              />
            ) : (
              '🃏'
            )}
          </div>
          <div className="flex-1 text-white">
            <div className="text-xs opacity-90 font-semibold uppercase tracking-wider mb-1">Most Played</div>
            <div className="text-2xl font-bold text-white">
              {stats.most_played_deck ? stats.most_played_deck.deck_name : '-'}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 bg-[#1A1B1E]">
          <div className="text-[#909296] text-[13px]">
            {stats.most_played_deck
              ? `${stats.most_played_deck.player_name} • ${stats.most_played_deck.games_played} games`
              : 'No data yet'}
          </div>
        </div>
      </div>

      {/* Most Popular Color Card */}
      <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] transition-all duration-150 ease-out overflow-hidden flex flex-col stat-card-hover stat-card-orange">
        <div className="bg-[var(--stat-color)] px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-[rgba(0,0,0,0.15)] rounded-full flex items-center justify-center text-[28px] flex-shrink-0 overflow-hidden relative stat-icon-mana">
            {stats.most_popular_color ? (
              <ColorPips colors={[stats.most_popular_color.color]} />
            ) : (
              '🎨'
            )}
          </div>
          <div className="flex-1 text-white">
            <div className="text-xs opacity-90 font-semibold uppercase tracking-wider mb-1">Popular Color</div>
            <div className="text-2xl font-bold text-white">
              {stats.most_popular_color ? getColorName(stats.most_popular_color.color) : '-'}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 bg-[#1A1B1E]">
          <div className="text-[#909296] text-[13px]">
            {stats.most_popular_color
              ? `${stats.most_popular_color.percentage}% of decks run ${getColorName(stats.most_popular_color.color)}`
              : 'No data yet'}
          </div>
        </div>
      </div>

      {/* Most Popular Identity Card */}
      <div className="bg-gradient-card rounded-[16px] border border-[#2C2E33] transition-all duration-150 ease-out overflow-hidden flex flex-col stat-card-hover stat-card-purple">
        <div className="bg-[var(--stat-color)] px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-[rgba(0,0,0,0.15)] rounded-full flex items-center justify-center text-[28px] flex-shrink-0 overflow-hidden relative">
            ✨
          </div>
          <div className="flex-1 text-white">
            <div className="text-xs opacity-90 font-semibold uppercase tracking-wider mb-1">Popular Identity</div>
            <div className="text-2xl font-bold flex items-center gap-2 min-h-[28px] stat-header-value-colors">
              {stats.most_popular_identity ? (
                <>
                  <span>{stats.most_popular_identity.name}</span>
                  <ColorPips colors={stats.most_popular_identity.colors} />
                </>
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 bg-[#1A1B1E]">
          <div className="text-[#909296] text-[13px]">
            {stats.most_popular_identity
              ? `${stats.most_popular_identity.count} deck${stats.most_popular_identity.count !== 1 ? 's' : ''} • ${stats.most_popular_identity.percentage}% of pool`
              : 'No data yet'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsCards;
