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
  pod_ids?: string[];
  current_pod_id?: string;
  is_superuser: boolean;
  is_guest?: boolean;
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

type AuthCheckResult = {
  player: Player | null;
  isAuthFailure: boolean; // true if 401, false if network error
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchCurrentPlayer = async (token: string, retryCount = 0): Promise<AuthCheckResult> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // 401 means token is actually invalid/expired
        if (response.status === 401) {
          console.log('Token is invalid or expired (401)');
          return { player: null, isAuthFailure: true };
        }
        // Other errors (500, 503, etc.) are server issues, not auth failures
        throw new Error(`Server error: ${response.status}`);
      }

      const player = await response.json();
      return { player, isAuthFailure: false };
    } catch (error) {
      console.error('Error fetching current player:', error);

      // Retry logic with exponential backoff (max 2 retries)
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        console.log(`Retrying auth check in ${delay}ms (attempt ${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchCurrentPlayer(token, retryCount + 1);
      }

      // After retries exhausted, treat as network error (not auth failure)
      return { player: null, isAuthFailure: false };
    }
  };

  const login = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(GUEST_MODE_KEY); // Clear guest mode on login
    setIsGuest(false);
    const { player } = await fetchCurrentPlayer(token);
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
      const { player } = await fetchCurrentPlayer(token);
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
        // User has a token and is online - verify it
        const { player, isAuthFailure } = await fetchCurrentPlayer(token);
        if (player) {
          setCurrentPlayer(player);
        } else if (isAuthFailure) {
          // Token is actually invalid/expired (401) - clear it and switch to guest mode
          console.log('Token expired or invalid - clearing and switching to guest mode');
          localStorage.removeItem(TOKEN_KEY);
          localStorage.setItem(GUEST_MODE_KEY, 'true');
          setIsGuest(true);
        } else {
          // Network error - keep token but switch to guest mode temporarily
          console.log('Network error during auth check - keeping token and enabling guest mode temporarily');
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
