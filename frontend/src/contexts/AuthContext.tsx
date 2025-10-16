import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Player {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  picture?: string;
  deck_ids: string[];
  created_at: string;
}

interface AuthContextType {
  currentPlayer: Player | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'mtg_auth_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentPlayer = async (token: string): Promise<Player | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch current player');
      }

      const player = await response.json();
      return player;
    } catch (error) {
      console.error('Error fetching current player:', error);
      return null;
    }
  };

  const login = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    const player = await fetchCurrentPlayer(token);
    setCurrentPlayer(player);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setCurrentPlayer(null);
  };

  const refreshPlayer = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const player = await fetchCurrentPlayer(token);
      setCurrentPlayer(player);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        const player = await fetchCurrentPlayer(token);
        setCurrentPlayer(player);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ currentPlayer, loading, login, logout, refreshPlayer }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
