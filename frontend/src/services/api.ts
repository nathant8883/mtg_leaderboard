import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mtg_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Player Types
export interface Player {
  id?: string;
  name: string;
  avatar?: string;
  deck_ids?: string[];
  email?: string;
  google_id?: string;
  picture?: string;
  custom_avatar?: string;
  pod_ids?: string[];
  current_pod_id?: string;
  is_superuser?: boolean;
  is_guest?: boolean;
  created_at?: string;
}

// Player API Functions
export const playerApi = {
  getAll: async (): Promise<Player[]> => {
    const response = await api.get('/players/');
    return response.data;
  },

  getById: async (id: string): Promise<Player> => {
    const response = await api.get(`/players/${id}`);
    return response.data;
  },

  getDetail: async (id: string): Promise<PlayerDetail> => {
    const response = await api.get(`/players/${id}/detail`);
    return response.data;
  },

  search: async (query: string): Promise<Player[]> => {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const response = await api.get('/players/search', {
      params: { q: query }
    });
    return response.data;
  },

  create: async (player: Omit<Player, 'id' | 'created_at'>): Promise<Player> => {
    const response = await api.post('/players/', player);
    return response.data;
  },

  update: async (id: string, player: Partial<Player>): Promise<Player> => {
    const response = await api.put(`/players/${id}`, player);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/players/${id}`);
  },

  createGuest: async (name: string): Promise<Player> => {
    const response = await api.post('/players/guest', null, {
      params: { name }
    });
    return response.data;
  },

  updateProfile: async (name: string, customAvatar: string | null): Promise<Player> => {
    const response = await api.put('/auth/profile', {
      name,
      custom_avatar: customAvatar
    });
    return response.data;
  },
};

// Deck Types
export interface Deck {
  id?: string;
  name: string;
  player_id: string;
  commander: string;
  commander_image_url?: string;
  colors: string[];
  disabled?: boolean;
  created_at?: string;
}

// Scryfall Commander Types
export interface CommanderCard {
  name: string;
  image_small?: string;
  image_normal?: string;
  image_art_crop?: string;
  color_identity: string[];
  type_line: string;
  mana_cost: string;
}

// Commander Printing/Art Version Type
export interface CommanderPrinting {
  name: string;
  set_name: string;
  set_code: string;
  collector_number: string;
  illustration_id: string | null;
  image_small?: string;
  image_normal?: string;
  image_art_crop?: string;
}

// Match Types
export interface MatchPlayer {
  player_id: string;
  player_name: string;
  deck_id: string;
  deck_name: string;
  deck_colors: string[];  // Deck color identity (W/U/B/R/G)
  elimination_order?: number;  // Player placement (1=winner, 2=2nd, 3=3rd, 4=4th). Undefined if only winner is known
  is_winner: boolean;
}

export interface Match {
  id?: string;
  players: MatchPlayer[];
  winner_player_id: string;
  winner_deck_id: string;
  match_date: string;  // ISO date string
  duration_seconds?: number;  // Game duration in seconds
  notes?: string;
  created_at?: string;
}

export interface CreateMatchRequest {
  player_deck_pairs: Array<{ player_id: string; deck_id: string }>;
  winner_player_id: string;
  winner_deck_id: string;
  match_date: string;  // ISO date string (YYYY-MM-DD)
}

// Leaderboard Types
export interface PlayerLeaderboardEntry {
  player_id: string;
  player_name: string;
  avatar?: string;
  picture?: string;
  custom_avatar?: string;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  deck_count: number;
  ranked: boolean;
  // Elo analytics
  elo?: number;
  elo_change?: number;
}

export interface DeckLeaderboardEntry {
  deck_id: string;
  deck_name: string;
  commander: string;
  commander_image_url?: string;
  colors: string[];
  player_id: string;
  player_name: string;
  player_picture?: string;
  player_custom_avatar?: string;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  ranked: boolean;
}

export interface DashboardStats {
  total_games: number;
  total_players: number;
  total_decks: number;
  avg_pod_size: number;
  current_leader: PlayerLeaderboardEntry | null;
  last_game_date: string | null;
  most_games_player: {
    player_name: string;
    player_picture?: string;
    player_custom_avatar?: string;
    games_played: number;
  } | null;
  most_played_deck: {
    deck_name: string;
    commander_image_url?: string;
    player_name: string;
    player_picture?: string;
    player_custom_avatar?: string;
    games_played: number;
  } | null;
  most_popular_color: {
    color: string;
    percentage: number;
  } | null;
  most_popular_identity: {
    colors: string[];
    name: string;
    count: number;
    percentage: number;
  } | null;
  // Analytics
  elo_leader?: {
    player_id: string;
    player_name: string;
    picture?: string;
    custom_avatar?: string;
    elo: number;
    games_rated: number;
  } | null;
  rising_star?: {
    player: {
      player_id: string;
      player_name: string;
      picture?: string;
      custom_avatar?: string;
    };
    elo_gain: number;
    current_elo: number;
  } | null;
  pod_balance?: {
    score: number;
    status: 'Healthy' | 'Uneven' | 'Dominated';
    games_analyzed: number;
    unique_winners: number;
  } | null;
}

export interface PlayerDeckStats {
  deck_id: string;
  deck_name: string;
  commander: string;
  commander_image_url?: string;
  colors: string[];
  disabled?: boolean;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface PlayerDetail {
  player_id: string;
  player_name: string;
  avatar?: string;
  picture?: string;
  custom_avatar?: string;
  rank: number | null;
  total_games: number;
  wins: number;
  losses: number;
  win_rate: number;
  active_decks: number;
  member_since: string;
  favorite_single_color: string | null;
  favorite_color_combo: string[] | null;
  decks: PlayerDeckStats[];
}

// Analytics Types
export interface KingmakerRelationship {
  player_id: string;
  player_name: string;
  picture?: string;
  custom_avatar?: string;
  win_rate_with: number;
  win_rate_without: number;
  lift_percentage: number;
  games_together: number;
}

export interface KingmakerData {
  kingmaker_for: KingmakerRelationship[];
  analyzed_games: number;
}

// Deck API Functions
export const deckApi = {
  getAll: async (): Promise<Deck[]> => {
    const response = await api.get('/decks/');
    return response.data;
  },

  getById: async (id: string): Promise<Deck> => {
    const response = await api.get(`/decks/${id}`);
    return response.data;
  },

  create: async (deck: Omit<Deck, 'id' | 'created_at'>): Promise<Deck> => {
    const response = await api.post('/decks/', deck);
    return response.data;
  },

  update: async (id: string, deck: Partial<Deck>): Promise<Deck> => {
    const response = await api.put(`/decks/${id}`, deck);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/decks/${id}`);
  },
};

// Scryfall API Functions
export const scryfallApi = {
  searchCommanders: async (query: string): Promise<CommanderCard[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    const response = await api.get('/scryfall/commanders/search', {
      params: { q: query, limit: 20 }
    });
    return response.data.results || [];
  },

  getCommanderDetails: async (name: string): Promise<CommanderCard | null> => {
    try {
      const response = await api.get(`/scryfall/commanders/${encodeURIComponent(name)}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  getCommanderPrintings: async (name: string): Promise<CommanderPrinting[]> => {
    try {
      const response = await api.get(`/scryfall/commanders/${encodeURIComponent(name)}/printings`);
      return response.data.printings || [];
    } catch (error) {
      console.error('Error fetching commander printings:', error);
      return [];
    }
  },
};

// Match API Functions
export const matchApi = {
  getRecent: async (limit: number = 10): Promise<Match[]> => {
    const response = await api.get(`/matches/recent?limit=${limit}`);
    return response.data;
  },

  getAll: async (limit: number = 50, skip: number = 0): Promise<Match[]> => {
    const response = await api.get(`/matches/?limit=${limit}&skip=${skip}`);
    return response.data;
  },

  getById: async (id: string): Promise<Match> => {
    const response = await api.get(`/matches/${id}`);
    return response.data;
  },

  create: async (match: CreateMatchRequest): Promise<Match> => {
    const response = await api.post('/matches/', match);
    return response.data;
  },

  update: async (id: string, match: Partial<CreateMatchRequest>): Promise<Match> => {
    const response = await api.put(`/matches/${id}`, match);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/matches/${id}`);
  },
};

// Leaderboard API Functions
export const leaderboardApi = {
  getPlayerLeaderboard: async (): Promise<PlayerLeaderboardEntry[]> => {
    const response = await api.get('/leaderboard/players');
    return response.data;
  },

  getDeckLeaderboard: async (): Promise<DeckLeaderboardEntry[]> => {
    const response = await api.get('/leaderboard/decks');
    return response.data;
  },

  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/leaderboard/stats');
    return response.data;
  },
};

// Analytics API Functions
export const analyticsApi = {
  getKingmaker: async (playerId: string): Promise<KingmakerData> => {
    const response = await api.get(`/analytics/players/${playerId}/kingmaker`);
    return response.data;
  },

  getPodBalance: async (): Promise<DashboardStats['pod_balance']> => {
    const response = await api.get('/analytics/pod-balance');
    return response.data;
  },

  getRisingStar: async (): Promise<DashboardStats['rising_star']> => {
    const response = await api.get('/analytics/rising-star');
    return response.data;
  },

  getEloLeader: async (): Promise<DashboardStats['elo_leader']> => {
    const response = await api.get('/analytics/elo/leader');
    return response.data;
  },
};

// Pod Types
export interface Pod {
  id?: string;
  name: string;
  description?: string;
  custom_image?: string;
  creator_id: string;
  admin_ids: string[];
  member_ids: string[];
  member_count?: number;
  is_admin?: boolean;
  is_creator?: boolean;
  created_at?: string;
}

export interface PodInvite {
  id?: string;
  pod_id: string;
  pod_name?: string;
  pod_description?: string;
  inviter_id: string;
  inviter_name?: string;
  invitee_email?: string;
  invitee_player_id?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at?: string;
  responded_at?: string;
}

export interface PodMember {
  player_id: string;
  player_name: string;
  avatar?: string;
  picture?: string;
  custom_avatar?: string;
  is_creator: boolean;
  is_admin: boolean;
  is_superuser: boolean;
}

// Pod API Functions
export const podApi = {
  getAll: async (): Promise<Pod[]> => {
    const response = await api.get('/pods/');
    return response.data;
  },

  getById: async (id: string): Promise<Pod> => {
    const response = await api.get(`/pods/${id}`);
    return response.data;
  },

  create: async (name: string, description?: string): Promise<Pod> => {
    const response = await api.post('/pods/', null, {
      params: { name, description }
    });
    return response.data;
  },

  update: async (id: string, name?: string, description?: string, custom_image?: string): Promise<Pod> => {
    const response = await api.put(`/pods/${id}`, null, {
      params: { name, description, custom_image }
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/pods/${id}`);
  },

  leave: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/pods/${id}/leave`);
    return response.data;
  },

  getMembers: async (id: string): Promise<PodMember[]> => {
    const response = await api.get(`/pods/${id}/members`);
    return response.data;
  },

  removeMember: async (podId: string, playerId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/pods/${podId}/members/${playerId}`);
    return response.data;
  },

  promoteToAdmin: async (podId: string, playerId: string): Promise<{ message: string }> => {
    const response = await api.post(`/pods/${podId}/members/${playerId}/promote`);
    return response.data;
  },

  demoteFromAdmin: async (podId: string, playerId: string): Promise<{ message: string }> => {
    const response = await api.post(`/pods/${podId}/members/${playerId}/demote`);
    return response.data;
  },

  invite: async (podId: string, email?: string, playerId?: string): Promise<PodInvite> => {
    const params: { invitee_email?: string; invitee_player_id?: string } = {};
    if (email) params.invitee_email = email;
    if (playerId) params.invitee_player_id = playerId;

    const response = await api.post(`/pods/${podId}/invite`, null, { params });
    return response.data;
  },

  getPendingInvites: async (): Promise<PodInvite[]> => {
    const response = await api.get('/pods/invites/');
    return response.data;
  },

  acceptInvite: async (inviteId: string): Promise<{ message: string; pod_id: string; pod_name: string }> => {
    const response = await api.post(`/pods/invites/${inviteId}/accept`);
    return response.data;
  },

  declineInvite: async (inviteId: string): Promise<{ message: string }> => {
    const response = await api.post(`/pods/invites/${inviteId}/decline`);
    return response.data;
  },
};

// Auth API Functions
export const authApi = {
  switchPod: async (podId: string): Promise<{ message: string; current_pod_id: string; pod_name: string }> => {
    const response = await api.post('/auth/switch-pod', null, {
      params: { pod_id: podId }
    });
    return response.data;
  },

  getMe: async (): Promise<Player & { pod_ids: string[]; current_pod_id?: string; is_superuser: boolean }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Pod Dynamics Types
export interface EloHistoryPoint {
  match_id: string;
  elo: number;
  change: number;
  date: string;
}

export interface EloHistoryData {
  history: EloHistoryPoint[];
  current_elo: number;
  peak_elo: number;
  lowest_elo: number;
  games_rated: number;
}

export interface PodSizePerformance {
  games: number;
  wins: number;
  win_rate: number;
}

export interface PlacementData {
  count: number;
  percentage: number;
}

export interface FirstPlayerStats {
  as_first: {
    games: number;
    wins: number;
    win_rate: number;
  };
  not_first: {
    games: number;
    wins: number;
    win_rate: number;
  };
}

export interface WinRateTrendPoint {
  game_number: number;
  date: string;
  win_rate: number;
}

export interface ConsistencyData {
  average_placement: number;
  standard_deviation: number;
  label: string;
  games_analyzed: number;
}

export interface PlayerTrendsData {
  pod_size_performance: Record<string, PodSizePerformance>;
  placement_distribution: Record<string, PlacementData>;
  first_player_stats: FirstPlayerStats;
  win_rate_trend: WinRateTrendPoint[];
  consistency: ConsistencyData;
  total_games: number;
}

export interface PodDynamicsOverview {
  total_games: number;
  unique_winners: number;
  avg_duration_minutes: number | null;
  pod_balance_score: number | null;
}

// Head-to-Head Matchup Types
export interface MatchupStats {
  wins: number;
  losses: number;
  games: number;
  win_rate: number;
}

export interface MatchupPlayer {
  id: string;
  name: string;
}

export interface MatchupsData {
  players: MatchupPlayer[];
  matchups: Record<string, Record<string, MatchupStats>>;
}

// Games Together Types
export interface PartnerStats {
  player_id: string;
  player_name: string;
  games_together: number;
  my_wins: number;
  their_wins: number;
  my_win_rate: number;
  their_win_rate: number;
}

export interface GamesTogetherData {
  total_games: number;
  partners: PartnerStats[];
  most_played_with: PartnerStats | null;
  best_partner: PartnerStats | null;
  nemesis: PartnerStats | null;
}

// Deck Stats Types
export interface CommanderStats {
  name: string;
  games: number;
  wins: number;
  win_rate: number;
  tier: string;
  players: string[];
  colors: string[];
}

export interface PlayerDeckStats {
  deck_id: string;
  name: string;
  colors: string[];
  games: number;
  wins: number;
  win_rate: number;
}

export interface DeckStatsData {
  commanders: CommanderStats[];
  player_decks: PlayerDeckStats[];
  total_games: number;
}

// Color Stats Types
export interface ColorStat {
  games: number;
  wins: number;
  win_rate: number;
}

export interface MetaCompositionEntry {
  count: number;
  percentage: number;
}

export interface ColorStatsData {
  by_color: Record<string, ColorStat>;
  by_color_count: Record<string, ColorStat>;
  meta_composition: Record<string, MetaCompositionEntry>;
  total_games: number;
}

// Insights Types
export interface Insight {
  type: string;
  icon: string;
  title: string;
  description: string;
  priority: number;
}

export interface PodHealth {
  variety_score: number;
  unique_winners_recent: number;
  unique_winners_total: number;
  total_players: number;
  underdog_wins_recent: number;
  games_analyzed: number;
}

export interface InsightsData {
  insights: Insight[];
  pod_health: PodHealth;
}

// Calendar Types
export interface CalendarDay {
  date: string;
  count: number;
  weekday: number;
  month: number;
}

export interface CalendarStats {
  total_days_played: number;
  total_games: number;
  best_weekday: string | null;
  best_weekday_count: number;
  longest_gap_days: number;
  days_since_last_game: number | null;
  busiest_month: string | null;
  busiest_month_count: number;
  avg_games_per_play_day: number;
}

export interface CalendarData {
  calendar: CalendarDay[];
  stats: CalendarStats;
}

// Pod Dynamics API Functions
export const podDynamicsApi = {
  getEloHistory: async (playerId?: string): Promise<EloHistoryData> => {
    const response = await api.get('/pod-dynamics/elo-history', {
      params: playerId ? { player_id: playerId } : undefined
    });
    return response.data;
  },

  getPlayerTrends: async (playerId?: string): Promise<PlayerTrendsData> => {
    const response = await api.get('/pod-dynamics/player-trends', {
      params: playerId ? { player_id: playerId } : undefined
    });
    return response.data;
  },

  getOverview: async (): Promise<PodDynamicsOverview> => {
    const response = await api.get('/pod-dynamics/overview');
    return response.data;
  },

  getMatchups: async (): Promise<MatchupsData> => {
    const response = await api.get('/pod-dynamics/matchups');
    return response.data;
  },

  getGamesTogether: async (playerId?: string): Promise<GamesTogetherData> => {
    const response = await api.get('/pod-dynamics/games-together', {
      params: playerId ? { player_id: playerId } : undefined
    });
    return response.data;
  },

  getDeckStats: async (): Promise<DeckStatsData> => {
    const response = await api.get('/pod-dynamics/deck-stats');
    return response.data;
  },

  getColorStats: async (): Promise<ColorStatsData> => {
    const response = await api.get('/pod-dynamics/color-stats');
    return response.data;
  },

  getInsights: async (): Promise<InsightsData> => {
    const response = await api.get('/pod-dynamics/insights');
    return response.data;
  },

  getCalendar: async (): Promise<CalendarData> => {
    const response = await api.get('/pod-dynamics/calendar');
    return response.data;
  },
};

export default api;
