import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Player {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  picture?: string;
  custom_avatar?: string;
  deck_ids: string[];
  is_superuser: boolean;
  created_at: string;
}

interface AuthContextType {
  currentPlayer: Player | null;
  loading: boolean;
  isGuest: boolean;
  login: (token: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'mtg_auth_token';
const GUEST_MODE_KEY = 'mtg_guest_mode';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchCurrentPlayer = async (token: string): Promise<Player | null> => {
    try {
      // Add 5-second timeout to prevent long hangs when offline
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
    localStorage.removeItem(GUEST_MODE_KEY); // Clear guest mode on login
    setIsGuest(false);
    const player = await fetchCurrentPlayer(token);
    setCurrentPlayer(player);
  };

  const loginAsGuest = () => {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    localStorage.removeItem(TOKEN_KEY); // Clear any existing token
    setIsGuest(true);
    setCurrentPlayer(null);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(GUEST_MODE_KEY);
    setCurrentPlayer(null);
    setIsGuest(false);
  };

  const refreshPlayer = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !isGuest) {
      const player = await fetchCurrentPlayer(token);
      setCurrentPlayer(player);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const guestMode = localStorage.getItem(GUEST_MODE_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      const isOnline = navigator.onLine;

      if (guestMode === 'true') {
        // User is in guest mode
        setIsGuest(true);
        setCurrentPlayer(null);
      } else if (!isOnline) {
        // User is offline at startup - automatically enable guest mode
        console.log('App started offline - enabling guest mode automatically');
        localStorage.setItem(GUEST_MODE_KEY, 'true');
        setIsGuest(true);
        setCurrentPlayer(null);
      } else if (token) {
        // User has a valid token and is online
        const player = await fetchCurrentPlayer(token);
        if (player) {
          setCurrentPlayer(player);
        } else {
          // Token is invalid/expired or fetch failed, switch to guest mode gracefully
          localStorage.removeItem(TOKEN_KEY);
          localStorage.setItem(GUEST_MODE_KEY, 'true');
          setIsGuest(true);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ currentPlayer, loading, isGuest, login, loginAsGuest, logout, refreshPlayer }}>
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
