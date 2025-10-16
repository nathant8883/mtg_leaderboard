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
  commander?: string;
  colors?: string[];
  created_at?: string;
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

export default api;
