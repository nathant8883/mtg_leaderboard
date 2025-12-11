import { useState, useEffect } from 'react';
import {
  IconCards,
  IconTrophy,
  IconSword,
  IconScale,
  IconChartBar,
  IconCrown,
  IconBolt,
} from '@tabler/icons-react';
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

const COLOR_MAP: Record<string, string> = {
  W: 'ms-w',
  U: 'ms-u',
  B: 'ms-b',
  R: 'ms-r',
  G: 'ms-g',
};

// Color themes for different metric types
const colorThemes = {
  blue: {
    gradient: 'from-blue-600/30 to-blue-900/30',
    border: 'border-blue-500/50',
    glow: 'shadow-blue-500/20',
    text: 'text-blue-400',
    accent: 'text-blue-300',
    iconBg: 'bg-blue-500/30',
    iconColor: '#3b82f6',
  },
  purple: {
    gradient: 'from-purple-600/30 to-purple-900/30',
    border: 'border-purple-500/50',
    glow: 'shadow-purple-500/20',
    text: 'text-purple-400',
    accent: 'text-purple-300',
    iconBg: 'bg-purple-500/30',
    iconColor: '#a855f7',
  },
  orange: {
    gradient: 'from-orange-600/30 to-orange-900/30',
    border: 'border-orange-500/50',
    glow: 'shadow-orange-500/20',
    text: 'text-orange-400',
    accent: 'text-orange-300',
    iconBg: 'bg-orange-500/30',
    iconColor: '#f97316',
  },
  yellow: {
    gradient: 'from-yellow-600/30 to-yellow-900/30',
    border: 'border-yellow-500/50',
    glow: 'shadow-yellow-500/20',
    text: 'text-yellow-400',
    accent: 'text-yellow-300',
    iconBg: 'bg-yellow-500/30',
    iconColor: '#eab308',
  },
  gray: {
    gradient: 'from-gray-600/30 to-gray-800/30',
    border: 'border-gray-500/50',
    glow: 'shadow-gray-500/20',
    text: 'text-gray-400',
    accent: 'text-gray-300',
    iconBg: 'bg-gray-500/30',
    iconColor: '#6b7280',
  },
};

type ColorTheme = keyof typeof colorThemes;

interface MetricData {
  id: string;
  label: string;
  value: string;
  description: string;
  theme: ColorTheme;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  avatar?: {
    playerName: string;
    customAvatar?: string;
    picture?: string;
  };
  commanderImage?: string;
  colorPips?: string[];
}

// Arranges color pips in shapes based on count
const ArrangedColorPips: React.FC<{ colors: string[]; size?: string }> = ({ colors, size = 'text-xl' }) => {
  if (!colors || colors.length === 0) {
    return <i className={`ms ms-c ms-cost ms-shadow ${size}`} title="Colorless" />;
  }

  const sortOrder = ['W', 'U', 'B', 'R', 'G'];
  const sortedColors = [...colors].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));

  const renderPip = (color: string, index: number) => (
    <i
      key={`${color}-${index}`}
      className={`ms ${COLOR_MAP[color]} ms-cost ms-shadow ${size}`}
      title={color}
    />
  );

  if (sortedColors.length === 1) {
    return renderPip(sortedColors[0], 0);
  }

  if (sortedColors.length === 2) {
    return (
      <div className="flex gap-1">
        {sortedColors.map((c, i) => renderPip(c, i))}
      </div>
    );
  }

  if (sortedColors.length === 3) {
    return (
      <div className="flex flex-col items-center gap-0">
        <div>{renderPip(sortedColors[0], 0)}</div>
        <div className="flex gap-0.5 -mt-1">
          {renderPip(sortedColors[1], 1)}
          {renderPip(sortedColors[2], 2)}
        </div>
      </div>
    );
  }

  if (sortedColors.length === 4) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {sortedColors.map((c, i) => renderPip(c, i))}
      </div>
    );
  }

  if (sortedColors.length === 5) {
    return (
      <div className="flex flex-col items-center gap-0">
        <div className="flex gap-0.5">
          {renderPip(sortedColors[0], 0)}
          {renderPip(sortedColors[1], 1)}
        </div>
        <div className="flex gap-0 -mt-1">
          {renderPip(sortedColors[2], 2)}
          {renderPip(sortedColors[3], 3)}
          {renderPip(sortedColors[4], 4)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0.5">
      {sortedColors.map((c, i) => renderPip(c, i))}
    </div>
  );
};

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function selectMostDynamicMetric(stats: DashboardStats): MetricData | null {
  const scores: Array<{ score: number; data: MetricData }> = [];

  // Total Games - high score if game was today/yesterday
  if (stats.last_game_date) {
    const daysSince = getDaysSince(stats.last_game_date);
    let score = Math.max(10, 50 - daysSince * 5);
    let description = `Last game ${daysSince} days ago`;

    if (daysSince === 0) {
      score = 100;
      description = 'A game was played today!';
    } else if (daysSince === 1) {
      score = 80;
      description = 'A game was played yesterday';
    }

    scores.push({
      score,
      data: {
        id: 'total-games',
        label: 'Recent Activity',
        value: `${stats.total_games} games played`,
        description,
        theme: 'blue',
        icon: IconCards,
      },
    });
  }

  // Rising Star - score based on Elo gain magnitude
  if (stats.rising_star?.player) {
    const eloGain = stats.rising_star.elo_gain;
    scores.push({
      score: Math.min(100, eloGain * 2),
      data: {
        id: 'rising-star',
        label: 'Rising Star',
        value: stats.rising_star.player.player_name,
        description: `+${eloGain} Elo gained • Now at ${stats.rising_star.current_elo} rating`,
        theme: 'orange',
        icon: IconTrophy,
        avatar: {
          playerName: stats.rising_star.player.player_name,
          customAvatar: stats.rising_star.player.custom_avatar,
          picture: stats.rising_star.player.picture,
        },
      },
    });
  }

  // Pod Balance - high if unusual status
  if (stats.pod_balance && stats.pod_balance.score > 0) {
    const statusScores: Record<string, number> = {
      Dominated: 100,
      Uneven: 70,
      Healthy: 40,
    };
    const statusDescriptions: Record<string, string> = {
      Dominated: `Only ${stats.pod_balance.unique_winners} winner${stats.pod_balance.unique_winners !== 1 ? 's' : ''} in recent games`,
      Uneven: `${stats.pod_balance.unique_winners} different winners lately`,
      Healthy: `${stats.pod_balance.unique_winners} different winners • Great balance!`,
    };
    const statusIcons: Record<string, typeof IconScale> = {
      Dominated: IconCrown,
      Uneven: IconChartBar,
      Healthy: IconScale,
    };

    scores.push({
      score: statusScores[stats.pod_balance.status] || 30,
      data: {
        id: 'pod-balance',
        label: 'Pod Balance',
        value: `${stats.pod_balance.status} • ${stats.pod_balance.score}% parity`,
        description: statusDescriptions[stats.pod_balance.status] || '',
        theme: stats.pod_balance.status === 'Healthy' ? 'blue' : stats.pod_balance.status === 'Uneven' ? 'orange' : 'purple',
        icon: statusIcons[stats.pod_balance.status] || IconScale,
      },
    });
  }

  // Elo Leader - base interest score
  if (stats.elo_leader) {
    scores.push({
      score: 50,
      data: {
        id: 'elo-leader',
        label: 'Elo Leader',
        value: stats.elo_leader.player_name,
        description: `${stats.elo_leader.elo} rating • ${stats.elo_leader.games_rated} ranked games`,
        theme: 'purple',
        icon: IconTrophy,
        avatar: {
          playerName: stats.elo_leader.player_name,
          customAvatar: stats.elo_leader.custom_avatar,
          picture: stats.elo_leader.picture,
        },
      },
    });
  }

  // Most Games Player - moderate interest
  if (stats.most_games_player) {
    scores.push({
      score: 45,
      data: {
        id: 'most-games',
        label: 'Most Active Player',
        value: stats.most_games_player.player_name,
        description: `${stats.most_games_player.games_played} games played`,
        theme: 'purple',
        icon: IconTrophy,
        avatar: {
          playerName: stats.most_games_player.player_name,
          customAvatar: stats.most_games_player.player_custom_avatar,
          picture: stats.most_games_player.player_picture,
        },
      },
    });
  }

  // Most Played Deck - moderate interest
  if (stats.most_played_deck) {
    scores.push({
      score: 40,
      data: {
        id: 'most-played',
        label: 'Most Played Deck',
        value: stats.most_played_deck.deck_name,
        description: `${stats.most_played_deck.games_played} games • Piloted by ${stats.most_played_deck.player_name}`,
        theme: 'orange',
        icon: IconSword,
        commanderImage: stats.most_played_deck.commander_image_url,
      },
    });
  }

  // Popular Color - lower priority
  if (stats.most_popular_color) {
    scores.push({
      score: 30,
      data: {
        id: 'popular-color',
        label: 'Popular Color',
        value: COLOR_NAMES[stats.most_popular_color.color] || stats.most_popular_color.color,
        description: `${stats.most_popular_color.percentage}% of decks include this color`,
        theme: 'yellow',
        icon: IconCards,
        colorPips: [stats.most_popular_color.color],
      },
    });
  }

  // Top Identity - lower priority
  if (stats.most_popular_identity) {
    scores.push({
      score: 25,
      data: {
        id: 'top-identity',
        label: 'Top Color Identity',
        value: stats.most_popular_identity.name,
        description: `${stats.most_popular_identity.count} decks • ${stats.most_popular_identity.percentage}% of all decks`,
        theme: 'gray',
        icon: IconCards,
        colorPips: stats.most_popular_identity.colors,
      },
    });
  }

  if (scores.length === 0) return null;

  // Sort by score descending, return highest
  scores.sort((a, b) => b.score - a.score);
  return scores[0].data;
}

function FeaturedMetric() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    const handlePodSwitch = () => {
      loadStats();
    };

    window.addEventListener('podSwitched', handlePodSwitch);
    return () => {
      window.removeEventListener('podSwitched', handlePodSwitch);
    };
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await leaderboardApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats for featured metric:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-4">
        <div className="bg-gradient-to-r from-gray-700/30 to-gray-800/30 rounded-xl border border-gray-700/50 px-4 py-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <div className="h-3 w-20 bg-gray-700 rounded mb-1.5"></div>
              <div className="h-4 w-36 bg-gray-700 rounded"></div>
            </div>
            <div className="h-3 w-32 bg-gray-700 rounded hidden sm:block"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const metric = selectMostDynamicMetric(stats);
  if (!metric) return null;

  const theme = colorThemes[metric.theme];
  const Icon = metric.icon;

  return (
    <div className="mb-4">
      <div
        className={`bg-gradient-to-r ${theme.gradient} rounded-xl border ${theme.border} px-4 py-3 shadow-lg ${theme.glow}`}
      >
        {/* Single row layout */}
        <div className="flex items-center gap-3">
          {/* Icon/Avatar Section */}
          <div className="flex-shrink-0">
            {metric.avatar ? (
              <PlayerAvatar
                playerName={metric.avatar.playerName}
                customAvatar={metric.avatar.customAvatar}
                picture={metric.avatar.picture}
                size="small"
                className="w-10 h-10"
              />
            ) : metric.commanderImage ? (
              <img
                src={metric.commanderImage}
                className="w-10 h-10 rounded-full object-cover object-[center_20%] border border-white/20"
                alt=""
              />
            ) : metric.colorPips ? (
              <div className={`w-10 h-10 rounded-full ${theme.iconBg} flex items-center justify-center`}>
                <ArrangedColorPips colors={metric.colorPips} size="text-base" />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-full ${theme.iconBg} flex items-center justify-center`}>
                <Icon size={20} color={theme.iconColor} stroke={1.5} />
              </div>
            )}
          </div>

          {/* Text Section */}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${theme.accent}`}>{metric.label}</p>
            <p className="text-base font-bold text-white truncate">{metric.value}</p>
          </div>

          {/* Description on right (hidden on mobile) */}
          <p className="text-xs text-gray-400 hidden sm:block flex-shrink-0 max-w-[200px] text-right">
            {metric.description}
          </p>

          {/* Bolt icon indicator */}
          <IconBolt size={14} className={`${theme.text} flex-shrink-0`} />
        </div>
      </div>
    </div>
  );
}

export default FeaturedMetric;
