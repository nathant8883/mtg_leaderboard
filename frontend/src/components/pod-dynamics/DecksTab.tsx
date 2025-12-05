import { useState, useEffect } from 'react';
import { CommanderTierList } from './CommanderTierList';
import { ColorPerformance } from './ColorPerformance';
import { podDynamicsApi } from '../../services/api';
import type { DeckStatsData, ColorStatsData } from '../../services/api';
import { Trophy, Palette } from 'lucide-react';

interface DecksTabProps {
  playerName?: string;
}

export function DecksTab({ playerName }: DecksTabProps) {
  const [deckStats, setDeckStats] = useState<DeckStatsData | null>(null);
  const [colorStats, setColorStats] = useState<ColorStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [decks, colors] = await Promise.all([
        podDynamicsApi.getDeckStats(),
        podDynamicsApi.getColorStats(),
      ]);
      setDeckStats(decks);
      setColorStats(colors);
    } catch (err) {
      console.error('Error loading decks data:', err);
      setError('Failed to load decks data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#667eea]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-[#FF6B6B] mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-[#667eea] text-white rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  const hasDeckData = deckStats && (deckStats.commanders.length > 0 || deckStats.player_decks.length > 0);
  const hasColorData = colorStats && colorStats.total_games > 0;

  if (!hasDeckData && !hasColorData) {
    return (
      <div className="text-center py-12 text-[#909296]">
        <p>Play some games to see deck and color analytics!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commander Tier List */}
      {hasDeckData && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-[#667eea]" />
            Commander Performance
          </h3>
          <p className="text-[#909296] text-sm mb-4">
            All decks in your pod ranked by win rate. Tiers require 5+ games.
          </p>
          <CommanderTierList
            commanders={deckStats.commanders}
            playerDecks={deckStats.player_decks}
            currentPlayerName={playerName}
          />
        </div>
      )}

      {/* Color Performance */}
      {hasColorData && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Palette size={18} className="text-[#667eea]" />
            Color Analysis
          </h3>
          <p className="text-[#909296] text-sm mb-4">
            How different colors perform in your pod's meta.
          </p>
          <ColorPerformance data={colorStats} />
        </div>
      )}
    </div>
  );
}
