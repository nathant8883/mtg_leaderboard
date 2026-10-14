import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { seasonApi, type Season, type SeasonParam } from '../services/api';
import { useAuth } from './AuthContext';
import { usePod } from './PodContext';

interface SeasonContextType {
  /** Seasons that have started, newest first */
  seasons: Season[];
  currentSeason: Season | null;
  /** What stats are scoped to: 'current', 'all', or a season number */
  selected: SeasonParam;
  setSelected: (value: SeasonParam) => void;
  /** The Season object for the selection (null for all time / preseason) */
  selectedSeason: Season | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

// sessionStorage, not localStorage: every new visit starts on the current season
const SELECTED_SEASON_KEY = 'mtg_selected_season';

const readStoredSelection = (): SeasonParam => {
  try {
    const raw = sessionStorage.getItem(SELECTED_SEASON_KEY);
    if (raw === 'all' || raw === 'current' || raw === null) return (raw ?? 'current') as SeasonParam;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 'current';  // 0 = Founder's Season
  } catch {
    return 'current';
  }
};

export const SeasonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod } = usePod();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [selected, setSelectedState] = useState<SeasonParam>(readStoredSelection);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await seasonApi.list();
      setSeasons(data.seasons);
      setCurrentSeason(data.current);
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on login and pod switch (finalization status is per pod)
  useEffect(() => {
    if (currentPlayer || isGuest) {
      refresh();
    }
  }, [currentPlayer?.id, isGuest, currentPod?.id, refresh]);

  const setSelected = useCallback((value: SeasonParam) => {
    // Picking the current season by number is the same as "current"
    const normalized = typeof value === 'number' && value === currentSeason?.number ? 'current' : value;
    setSelectedState(normalized);
    try {
      sessionStorage.setItem(SELECTED_SEASON_KEY, String(normalized));
    } catch {
      // Storage unavailable (private mode) - selection just won't persist
    }
  }, [currentSeason?.number]);

  // Drop a stored season number that doesn't exist (e.g. stale session)
  useEffect(() => {
    if (!loading && typeof selected === 'number' && !seasons.some(s => s.number === selected)) {
      setSelected('current');
    }
  }, [loading, selected, seasons, setSelected]);

  const selectedSeason = useMemo(() => {
    if (selected === 'all') return null;
    if (selected === 'current') return currentSeason;
    return seasons.find(s => s.number === selected) ?? null;
  }, [selected, currentSeason, seasons]);

  return (
    <SeasonContext.Provider
      value={{ seasons, currentSeason, selected, setSelected, selectedSeason, loading, refresh }}
    >
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error('useSeason must be used within a SeasonProvider');
  }
  return context;
};
