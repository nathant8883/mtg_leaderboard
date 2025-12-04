import { useState, useEffect } from 'react';
import { IconCards, IconTrophy, IconSword, IconScale, IconChartBar, IconCrown } from '@tabler/icons-react';
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

// Arranges color pips in shapes based on count
const ArrangedColorPips: React.FC<{ colors: string[]; size?: string }> = ({ colors, size = 'text-sm' }) => {
  if (!colors || colors.length === 0) {
    return <i className={`ms ms-c ms-cost ms-shadow ${size}`} title="Colorless" />;
  }

  // Sort colors in WUBRG order
  const sortOrder = ['W', 'U', 'B', 'R', 'G'];
  const sortedColors = [...colors].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));

  const renderPip = (color: string, index: number) => (
    <i
      key={`${color}-${index}`}
      className={`ms ${COLOR_MAP[color]} ms-cost ms-shadow ${size}`}
      title={color}
    />
  );

  // Single pip - centered
  if (sortedColors.length === 1) {
    return renderPip(sortedColors[0], 0);
  }

  // Two pips - horizontal row
  if (sortedColors.length === 2) {
    return (
      <div className="flex gap-0.5">
        {sortedColors.map((c, i) => renderPip(c, i))}
      </div>
    );
  }

  // Three pips - triangle (1 top, 2 bottom)
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

  // Four pips - 2x2 grid
  if (sortedColors.length === 4) {
    return (
      <div className="grid grid-cols-2 gap-0">
        {sortedColors.map((c, i) => renderPip(c, i))}
      </div>
    );
  }

  // Five pips - 2 top, 3 bottom (pentagon-ish)
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

  // Fallback - horizontal row
  return (
    <div className="flex gap-0.5">
      {sortedColors.map((c, i) => renderPip(c, i))}
    </div>
  );
};

type CardColor = 'blue' | 'purple' | 'orange' | 'yellow' | 'gray';

const colorMap: Record<CardColor, { bg: string; border: string; text: string; iconColor: string }> = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', iconColor: '#3b82f6' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400', iconColor: '#a855f7' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400', iconColor: '#f97316' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', iconColor: '#eab308' },
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', iconColor: '#6b7280' },
};

interface MetricPillProps {
  label: string;
  value: string;
  analytic: string;
  analyticLabel: string;
  color: CardColor;
  icon?: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
  avatar?: React.ReactNode;
  commanderImage?: string;
  customIcon?: React.ReactNode;
}

// Data structure for building metric card array
interface MetricCardData extends Omit<MetricPillProps, 'avatar' | 'customIcon'> {
  id: string;
  visible: boolean;
  avatarData?: {
    playerName: string;
    customAvatar?: string;
    picture?: string;
  };
  customIconData?: {
    type: 'colorPip' | 'arrangedPips';
    colors: string[];
  };
}

const MetricPill: React.FC<MetricPillProps> = ({
  label,
  value,
  analytic,
  analyticLabel,
  color,
  icon: Icon,
  avatar,
  commanderImage,
  customIcon,
}) => {
  const colors = colorMap[color];
  return (
    <div className={`bg-gray-800/90 rounded-2xl border ${colors.border} min-w-fit flex overflow-hidden`}>
      {/* Primary section */}
      <div className="flex items-center gap-3 px-4 py-3">
        {avatar ? (
          avatar
        ) : commanderImage ? (
          <img src={commanderImage} className="w-9 h-9 rounded-full object-cover object-[center_20%]" alt="" />
        ) : customIcon ? (
          <div className={`w-9 h-9 rounded-full ${colors.bg} flex items-center justify-center`}>
            {customIcon}
          </div>
        ) : Icon ? (
          <div className={`w-9 h-9 rounded-full ${colors.bg} flex items-center justify-center`}>
            <Icon size={20} color={colors.iconColor} stroke={1.5} />
          </div>
        ) : null}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold text-white whitespace-nowrap">{value}</p>
        </div>
      </div>
      {/* Analytic section */}
      <div className={`${colors.bg} px-4 py-3 flex flex-col items-center justify-center border-l border-gray-700/50`}>
        <p className={`text-lg font-bold ${colors.text}`}>{analytic}</p>
        <p className="text-[10px] text-gray-500">{analyticLabel}</p>
      </div>
    </div>
  );
};

const SkeletonPill: React.FC = () => (
  <div className="bg-gray-800/90 rounded-2xl border border-gray-700/50 min-w-fit flex overflow-hidden animate-pulse">
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-gray-700"></div>
      <div>
        <div className="h-2 w-16 bg-gray-700 rounded mb-2"></div>
        <div className="h-4 w-24 bg-gray-700 rounded"></div>
      </div>
    </div>
    <div className="bg-gray-700/30 px-4 py-3 flex flex-col items-center justify-center border-l border-gray-700/50">
      <div className="h-5 w-8 bg-gray-700 rounded mb-1"></div>
      <div className="h-2 w-10 bg-gray-700 rounded"></div>
    </div>
  </div>
);

function StatsCards() {
  const getColorName = (color: string): string => {
    return COLOR_NAMES[color] || color;
  };
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    loadStats();

    // Listen for pod switch events to refresh stats
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
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };


  const formatLastGameDate = (dateStr: string | null): { display: string; analytic: string; label: string } => {
    if (!dateStr) return { display: 'No games yet', analytic: '-', label: '' };

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { display: 'Today', analytic: '0', label: 'days ago' };
    if (diffDays === 1) return { display: '1 day ago', analytic: '1', label: 'day ago' };
    return { display: `${diffDays} days ago`, analytic: String(diffDays), label: 'days ago' };
  };

  if (loading) {
    return (
      <div className="stats-carousel-container mb-8">
        <div className="stats-carousel-track">
          <SkeletonPill />
          <SkeletonPill />
          <SkeletonPill />
          <SkeletonPill />
          <SkeletonPill />
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const lastGameInfo = formatLastGameDate(stats.last_game_date);

  // Build array of metric cards for infinite carousel cloning
  const metricCards: MetricCardData[] = [
    {
      id: 'total-games',
      label: 'Total Games',
      value: String(stats.total_games),
      analytic: lastGameInfo.analytic,
      analyticLabel: lastGameInfo.label,
      color: 'blue' as const,
      icon: IconCards,
      visible: true,
    },
    {
      id: 'most-games',
      label: 'Most Games',
      value: stats.most_games_player ? stats.most_games_player.player_name : '-',
      analytic: stats.most_games_player ? String(stats.most_games_player.games_played) : '-',
      analyticLabel: 'games',
      color: 'purple' as const,
      icon: IconTrophy,
      visible: true,
      avatarData: stats.most_games_player ? {
        playerName: stats.most_games_player.player_name,
        customAvatar: stats.most_games_player.player_custom_avatar,
        picture: stats.most_games_player.player_picture,
      } : undefined,
    },
    {
      id: 'most-played',
      label: 'Most Played',
      value: stats.most_played_deck ? stats.most_played_deck.deck_name : '-',
      analytic: stats.most_played_deck ? String(stats.most_played_deck.games_played) : '-',
      analyticLabel: 'games',
      color: 'orange' as const,
      commanderImage: stats.most_played_deck?.commander_image_url,
      icon: IconSword,
      visible: true,
    },
    {
      id: 'popular-color',
      label: 'Popular Color',
      value: stats.most_popular_color ? getColorName(stats.most_popular_color.color) : '-',
      analytic: stats.most_popular_color ? `${stats.most_popular_color.percentage}%` : '-',
      analyticLabel: 'of decks',
      color: 'yellow' as const,
      icon: IconCards,
      visible: true,
      customIconData: stats.most_popular_color ? {
        type: 'colorPip' as const,
        colors: [stats.most_popular_color.color],
      } : undefined,
    },
    {
      id: 'top-identity',
      label: 'Top Identity',
      value: stats.most_popular_identity ? stats.most_popular_identity.name : '-',
      analytic: stats.most_popular_identity ? String(stats.most_popular_identity.count) : '-',
      analyticLabel: 'decks',
      color: 'gray' as const,
      icon: IconCards,
      visible: true,
      customIconData: stats.most_popular_identity ? {
        type: 'arrangedPips' as const,
        colors: stats.most_popular_identity.colors,
      } : undefined,
    },
    {
      id: 'elo-leader',
      label: 'Elo Leader',
      value: stats.elo_leader?.player_name || '-',
      analytic: stats.elo_leader ? String(stats.elo_leader.elo) : '-',
      analyticLabel: 'rating',
      color: 'purple' as const,
      icon: IconTrophy,
      visible: !!stats.elo_leader,
      avatarData: stats.elo_leader ? {
        playerName: stats.elo_leader.player_name,
        customAvatar: stats.elo_leader.custom_avatar,
        picture: stats.elo_leader.picture,
      } : undefined,
    },
    {
      id: 'rising-star',
      label: 'Rising Star',
      value: stats.rising_star?.player?.player_name || '-',
      analytic: stats.rising_star ? `+${stats.rising_star.elo_gain}` : '-',
      analyticLabel: 'Elo gain',
      color: 'orange' as const,
      icon: IconTrophy,
      visible: !!(stats.rising_star?.player),
      avatarData: stats.rising_star?.player ? {
        playerName: stats.rising_star.player.player_name,
        customAvatar: stats.rising_star.player.custom_avatar,
        picture: stats.rising_star.player.picture,
      } : undefined,
    },
    {
      id: 'pod-balance',
      label: 'Pod Balance',
      value: stats.pod_balance?.status || '-',
      analytic: stats.pod_balance ? `${stats.pod_balance.score}%` : '-',
      analyticLabel: 'parity',
      color: (stats.pod_balance?.status === 'Healthy' ? 'blue' : stats.pod_balance?.status === 'Uneven' ? 'orange' : 'purple') as CardColor,
      icon: stats.pod_balance?.status === 'Healthy' ? IconScale : stats.pod_balance?.status === 'Uneven' ? IconChartBar : IconCrown,
      visible: !!(stats.pod_balance && stats.pod_balance.score > 0),
    },
  ].filter(card => card.visible);

  // Helper to render a metric card from data
  const renderMetricCard = (card: MetricCardData, keyPrefix: string) => {
    let avatar: React.ReactNode | undefined;
    let customIcon: React.ReactNode | undefined;

    if (card.avatarData) {
      avatar = (
        <PlayerAvatar
          playerName={card.avatarData.playerName}
          customAvatar={card.avatarData.customAvatar}
          picture={card.avatarData.picture}
          size="small"
          className="w-9 h-9"
        />
      );
    }

    if (card.customIconData) {
      if (card.customIconData.type === 'colorPip') {
        customIcon = (
          <div className="text-2xl">
            <ColorPips colors={card.customIconData.colors} />
          </div>
        );
      } else if (card.customIconData.type === 'arrangedPips') {
        customIcon = <ArrangedColorPips colors={card.customIconData.colors} size="text-base" />;
      }
    }

    return (
      <MetricPill
        key={`${keyPrefix}-${card.id}`}
        label={card.label}
        value={card.value}
        analytic={card.analytic}
        analyticLabel={card.analyticLabel}
        color={card.color}
        icon={card.icon}
        avatar={avatar}
        commanderImage={card.commanderImage}
        customIcon={customIcon}
      />
    );
  };

  // For infinite carousel on mobile - duplicate cards for seamless loop
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Render cards (duplicated on mobile for infinite animation)
  const cardsToRender = isMobile
    ? [
        ...metricCards.map((card) => renderMetricCard(card, 'set1')),
        ...metricCards.map((card) => renderMetricCard(card, 'set2')),
      ]
    : metricCards.map((card) => renderMetricCard(card, 'original'));

  // Calculate animation duration based on card count (slower = more readable)
  const animationDuration = metricCards.length * 8; // 8 seconds per card

  // When user interacts, switch to manual scroll mode
  const handleInteractionStart = () => {
    setIsPaused(true);
  };

  return (
    <div
      className={`stats-carousel-container mb-8 ${isPaused ? 'scrollable' : ''}`}
      onMouseEnter={handleInteractionStart}
      onTouchStart={handleInteractionStart}
    >
      <div
        className={`stats-carousel-track ${isPaused ? 'paused' : ''}`}
        style={{ '--animation-duration': `${animationDuration}s` } as React.CSSProperties}
      >
        {cardsToRender}
      </div>
    </div>
  );
}

export default StatsCards;
