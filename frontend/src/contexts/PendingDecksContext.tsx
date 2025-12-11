import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { deckApi, type PendingQuickDeck } from '../services/api';
import { useAuth } from './AuthContext';

interface PendingDecksContextType {
  pendingCount: number;
  pendingDecks: PendingQuickDeck[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const PendingDecksContext = createContext<PendingDecksContextType>({
  pendingCount: 0,
  pendingDecks: [],
  loading: false,
  refresh: async () => {},
});

export const usePendingDecks = () => useContext(PendingDecksContext);

interface PendingDecksProviderProps {
  children: React.ReactNode;
}

export const PendingDecksProvider: React.FC<PendingDecksProviderProps> = ({ children }) => {
  const { currentPlayer } = useAuth();
  const [pendingDecks, setPendingDecks] = useState<PendingQuickDeck[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPendingDecks = useCallback(async () => {
    if (!currentPlayer) {
      setPendingDecks([]);
      return;
    }

    try {
      setLoading(true);
      const decks = await deckApi.getPending();
      setPendingDecks(decks);
    } catch (err) {
      console.error('Error loading pending decks:', err);
      setPendingDecks([]);
    } finally {
      setLoading(false);
    }
  }, [currentPlayer]);

  // Load pending decks when user logs in or changes
  useEffect(() => {
    loadPendingDecks();
  }, [loadPendingDecks]);

  // Listen for custom events that indicate decks may have changed
  useEffect(() => {
    const handleRefresh = () => {
      loadPendingDecks();
    };

    window.addEventListener('refreshPendingDecks', handleRefresh);
    window.addEventListener('podSwitched', handleRefresh);

    return () => {
      window.removeEventListener('refreshPendingDecks', handleRefresh);
      window.removeEventListener('podSwitched', handleRefresh);
    };
  }, [loadPendingDecks]);

  return (
    <PendingDecksContext.Provider
      value={{
        pendingCount: pendingDecks.length,
        pendingDecks,
        loading,
        refresh: loadPendingDecks,
      }}
    >
      {children}
    </PendingDecksContext.Provider>
  );
};

export default PendingDecksContext;
