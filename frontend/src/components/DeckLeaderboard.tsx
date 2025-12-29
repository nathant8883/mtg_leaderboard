import ColorPips from './ColorPips';
import type { DeckLeaderboardEntry } from '../services/api';
import TierBadge from './TierBadge';
import { getWinRateTier, TIER_CONFIG } from '../utils/tierConfig';
import { DeckLeaderboardCard } from './leaderboard';

interface DeckLeaderboardProps {
  decks: DeckLeaderboardEntry[];
  loading?: boolean;
  onPlayerClick: (playerId: string) => void;
}

const MIN_GAMES_FOR_RANKING = 4;

function DeckLeaderboard({ decks, loading = false, onPlayerClick }: DeckLeaderboardProps) {
  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'rank-badge rank-badge-gold';
    if (rank === 2) return 'rank-badge rank-badge-silver';
    if (rank === 3) return 'rank-badge rank-badge-bronze';
    return 'rank-badge';
  };

  if (loading) {
    return (
      <div className="text-center py-[60px] px-5">
        <div className="loading-spinner"></div>
        <p className="text-[#909296] text-sm">Loading deck leaderboard...</p>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="text-center py-[60px] px-5">
        <div className="text-[64px] mb-4">🃏</div>
        <h3 className="text-white text-xl mb-2">No deck data yet</h3>
        <p className="text-[#909296] text-sm">Record some matches to see the leaderboard!</p>
      </div>
    );
  }

  // Calculate ranks for both views
  const decksWithRanks = (() => {
    let rankedCount = 0;
    return decks.map((deck) => {
      const isRanked = deck.ranked;
      if (isRanked) rankedCount++;
      const rank = isRanked ? rankedCount : null;
      return { deck, rank };
    });
  })();

  return (
    <div className="mt-6">
      {/* Mobile Card View */}
      <div className="flex flex-col gap-3 md:hidden">
        {decksWithRanks.map(({ deck, rank }) => (
          <DeckLeaderboardCard
            key={deck.deck_id}
            deck={deck}
            rank={rank}
            onTap={() => onPlayerClick(deck.player_id)}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[#909296] text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Rank</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Player</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Deck</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Commander</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Colors</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Games</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Wins</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Losses</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {decksWithRanks.map(({ deck, rank }) => {
              const isRanked = deck.ranked;
              const gamesNeeded = MIN_GAMES_FOR_RANKING - deck.games_played;

              return (
                <tr key={deck.deck_id} className={`transition-all duration-200 hover:bg-[#25262B] ${!isRanked ? 'opacity-60' : ''}`}>
                  <td className="py-4 px-3 border-b border-[#2C2E33]">
                    {isRanked && rank ? (
                      <div className={getRankBadgeClass(rank)}>
                        {rank}
                      </div>
                    ) : (
                      <div className="rank-badge bg-[#2C2E33] text-[#909296]">
                        —
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33]">
                    <div className="flex items-center gap-3">
                      <div className="player-avatar-badge">
                        {deck.player_name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className="player-name-clickable text-white font-medium text-[15px]"
                        onClick={() => onPlayerClick(deck.player_id)}
                      >
                        {deck.player_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33]">
                    <span className="text-white font-medium text-[15px]">{deck.deck_name}</span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33]">
                    <div className="flex items-center gap-3">
                      {deck.commander_image_url ? (
                        <div className="w-[60px] h-[60px] rounded-[8px] overflow-hidden border-2 border-[#2C2E33] shadow-[0_2px_8px_rgba(0,0,0,0.3)] shrink-0">
                          <img
                            src={deck.commander_image_url}
                            alt={deck.commander}
                            className="w-full h-full object-cover object-[center_20%]"
                          />
                        </div>
                      ) : (
                        <div className="player-avatar-badge w-[60px] h-[60px] shrink-0 text-2xl">
                          🎴
                        </div>
                      )}
                      <span className="text-[#C1C2C5] text-[13px] opacity-70">{deck.commander}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <ColorPips colors={deck.colors} />
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <span className="text-[#C1C2C5] font-medium text-[15px]">{deck.games_played}</span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <span className="text-[#C1C2C5] font-medium text-[15px]">{deck.wins}</span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <span className="text-[#C1C2C5] font-medium text-[15px]">{deck.losses}</span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    {isRanked ? (
                      (() => {
                        const tier = getWinRateTier(deck.win_rate / 100);
                        const tierConfig = TIER_CONFIG[tier];
                        return (
                          <div className={`winrate-compact ${tierConfig.cssClass}`}>
                            <TierBadge tier={tier} variant="compact" size="lg" />
                            <div className="text-left">
                              <div className="text-[10px] text-[#909296] uppercase font-semibold mb-[2px] tracking-[0.5px]">{tier} Tier</div>
                              <div className="text-lg font-bold text-white">{deck.win_rate.toFixed(1)}%</div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-left">
                        <div className="text-[10px] text-[#909296] uppercase font-semibold mb-[2px] tracking-[0.5px]">Unranked</div>
                        <div className="text-sm text-[#909296]">Needs {gamesNeeded} more game{gamesNeeded !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DeckLeaderboard;
