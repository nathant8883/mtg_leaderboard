import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Player Types
export interface Player {
  id?: string;
  name: string;
  avatar?: string;
  deck_ids?: string[];
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
};

// Deck Types
export interface Deck {
  id?: string;
  name: string;
  player_id: string;
  commander: string;
  commander_image_url?: string;
  colors: string[];
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

export default api;
