import { useState, useEffect } from 'react';
import ColorPips from './ColorPips';
import { leaderboardApi, type DeckLeaderboardEntry } from '../services/api';

interface TopDecksProps {
  onViewLeaderboard: () => void;
  onPlayerClick: (playerId: string) => void;
}

function TopDecks({ onViewLeaderboard, onPlayerClick: _onPlayerClick }: TopDecksProps) {
  const [decks, setDecks] = useState<DeckLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopDecks();
  }, []);

  const loadTopDecks = async () => {
    try {
      setLoading(true);
      const data = await leaderboardApi.getDeckLeaderboard();
      setDecks(data.slice(0, 3)); // Get top 3
    } catch (err) {
      console.error('Error loading top decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadgeClass = (rank: number): string => {
    const baseStyles = 'inline-flex items-center justify-center w-9 h-9 rounded-[20px] font-bold text-base border';
    if (rank === 1) return `${baseStyles} bg-gradient-gold text-[#1A1B1E] shadow-gold border-[rgba(255,215,0,0.3)]`;
    if (rank === 2) return `${baseStyles} bg-gradient-silver text-[#1A1B1E] shadow-silver border-[rgba(192,192,192,0.3)]`;
    if (rank === 3) return `${baseStyles} bg-gradient-bronze text-white shadow-bronze border-[rgba(205,127,50,0.3)]`;
    return `${baseStyles} bg-[#2C2E33] text-[#909296] border-[rgba(255,255,255,0.15)]`;
  };

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string } => {
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆' };
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐' };
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎' };
    return { class: 'd-tier', letter: 'D', icon: '📉' };
  };

  if (loading) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <h2 className="text-white m-0 text-2xl font-semibold">Top Decks</h2>
        <div className="text-center py-[60px] px-5">
          <div className="loading-spinner"></div>
          <p className="text-[#909296] text-sm">Loading top decks...</p>
        </div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <h2 className="text-white m-0 text-2xl font-semibold">Top Decks</h2>
        <div className="text-center py-[60px] px-5">
          <div className="text-[64px] mb-4">🃏</div>
          <h3 className="text-white text-xl mb-2">No deck data yet</h3>
          <p className="text-[#909296] text-sm">Record some matches to see the top decks!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white m-0 text-2xl font-semibold">Top Decks</h2>
        <button className="view-all-link" onClick={onViewLeaderboard}>
          View All
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[#909296] text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Rank</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Deck</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Colors</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Record</th>
              <th className="text-[#909296] text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {decks.map((deck, index) => {
              const rank = index + 1;
              const tier = getWinRateTier(deck.win_rate / 100);
              return (
                <tr key={deck.deck_id} className="transition-all duration-200 hover:bg-[#25262B]">
                  <td className="p-4 border-b border-[#2C2E33]">
                    <div className={getRankBadgeClass(rank)}>
                      {rank}
                    </div>
                  </td>
                  <td className="p-4 border-b border-[#2C2E33]">
                    <div className="flex items-center gap-3">
                      {deck.commander_image_url ? (
                        <div className="w-[50px] h-[50px] rounded-[6px] overflow-hidden border-2 border-[#2C2E33] shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex-shrink-0">
                          <img
                            src={deck.commander_image_url}
                            alt={deck.commander}
                            className="w-full h-full object-cover object-[center_20%]"
                          />
                        </div>
                      ) : (
                        <div className="w-[50px] h-[50px] flex-shrink-0 text-xl rounded-full bg-gradient-purple text-white inline-flex items-center justify-center font-semibold">
                          🎴
                        </div>
                      )}
                      <div>
                        <div className="text-white font-medium text-[15px]">{deck.deck_name}</div>
                        <div className="text-[#C1C2C5] text-[13px] opacity-70 mt-0.5">
                          {deck.commander}
                        </div>
                        <div className="text-xs mt-0.5 text-[#9ca3af]">
                          by {deck.player_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 border-b border-[#2C2E33] text-center">
                    <ColorPips colors={deck.colors} />
                  </td>
                  <td className="p-4 border-b border-[#2C2E33] text-center">
                    <span className="text-[#C1C2C5] font-medium text-[15px]">{deck.wins}-{deck.losses}</span>
                  </td>
                  <td className="p-4 border-b border-[#2C2E33] text-center">
                    <div className={`winrate-compact ${tier.class}`}>
                      <div className="tier-icon-compact">{tier.icon}</div>
                      <div className="text-left">
                        <div className="text-[10px] text-[#909296] uppercase font-semibold mb-0.5 tracking-wider">{tier.letter} Tier</div>
                        <div className="text-lg font-bold text-white">{deck.win_rate.toFixed(1)}%</div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="flex flex-col gap-3 md:hidden">
        {decks.map((deck, index) => {
          const rank = index + 1;
          const tier = getWinRateTier(deck.win_rate / 100);
          const tierColorClass = tier.class === 's-tier' ? 'text-[#FFD700]' :
                                 tier.class === 'a-tier' ? 'text-[#33D9B2]' :
                                 tier.class === 'b-tier' ? 'text-[#4FACFE]' :
                                 'text-[#FF6B6B]';
          const tierBgClass = tier.class === 's-tier' ? 'bg-[rgba(255,215,0,0.15)]' :
                              tier.class === 'a-tier' ? 'bg-[rgba(51,217,178,0.15)]' :
                              tier.class === 'b-tier' ? 'bg-[rgba(79,172,254,0.15)]' :
                              'bg-[rgba(255,107,107,0.15)]';
          return (
            <div
              key={deck.deck_id}
              className="flex items-center gap-3 bg-[linear-gradient(135deg,#25262B_0%,#27282D_100%)] border border-[#2C2E33] rounded-[12px] p-4 transition-all duration-150 active:scale-[0.98]"
            >
              <div className={getRankBadgeClass(rank)}>
                {rank}
              </div>
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#1A1B1E] border-2 border-[#2C2E33]">
                {deck.commander_image_url ? (
                  <img
                    src={deck.commander_image_url}
                    alt={deck.commander}
                    className="w-full h-full object-cover object-[center_20%]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[32px]">🎴</div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <div className="text-base font-semibold text-white">{deck.deck_name}</div>
                <div className="text-xs text-[#909296] overflow-hidden text-ellipsis whitespace-nowrap opacity-70">{deck.commander}</div>
                <div className="text-[11px] mt-0.5 text-[#9ca3af]">
                  by {deck.player_name}
                </div>
                <div className="mt-1 flex justify-start">
                  <ColorPips colors={deck.colors} />
                </div>
                <div className="text-xs text-[#909296] mt-1 opacity-70">{deck.wins}-{deck.losses}</div>
                <div className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-[20px] inline-block mt-1 border border-[rgba(255,255,255,0.15)] ${tierBgClass} ${tierColorClass}`}>
                  {tier.icon} {tier.letter} TIER
                </div>
              </div>
              <div className={`text-2xl font-bold flex-shrink-0 ml-auto ${tierColorClass}`}>
                {deck.win_rate.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TopDecks;
