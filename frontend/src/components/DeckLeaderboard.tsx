import ColorPips from './ColorPips';
import type { DeckLeaderboardEntry } from '../services/api';

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

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string } => {
    // S-Tier: 35%+ (too strong)
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆' };
    // A-Tier: 28-35% (above baseline)
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐' };
    // B-Tier: 22-28% (balanced, around 25% baseline)
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎' };
    // D-Tier: Below 22% (underperforming)
    return { class: 'd-tier', letter: 'D', icon: '📉' };
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

  return (
    <div className="overflow-x-auto mt-6">
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
          {(() => {
            let rankedCount = 0;
            return decks.map((deck) => {
              const isRanked = deck.ranked;
              if (isRanked) rankedCount++;
              const rank = isRanked ? rankedCount : null;
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
                        return (
                          <div className={`winrate-compact ${tier.class}`}>
                            <div className="tier-icon-compact">{tier.icon}</div>
                            <div className="text-left">
                              <div className="text-[10px] text-[#909296] uppercase font-semibold mb-[2px] tracking-[0.5px]">{tier.letter} Tier</div>
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
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default DeckLeaderboard;
