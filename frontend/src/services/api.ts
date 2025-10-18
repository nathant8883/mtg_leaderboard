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
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  deck_count: number;
}

export interface DeckLeaderboardEntry {
  deck_id: string;
  deck_name: string;
  commander: string;
  commander_image_url?: string;
  colors: string[];
  player_id: string;
  player_name: string;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
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
    games_played: number;
  } | null;
  most_played_deck: {
    deck_name: string;
    commander_image_url?: string;
    player_name: string;
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

export default api;
