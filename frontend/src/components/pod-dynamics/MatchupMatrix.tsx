import { useState } from 'react';
import type { MatchupsData, MatchupStats } from '../../services/api';

interface MatchupMatrixProps {
  data: MatchupsData;
  currentPlayerId?: string;
}

export function MatchupMatrix({ data, currentPlayerId }: MatchupMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<{
    player1: string;
    player2: string;
    stats: MatchupStats;
  } | null>(null);

  const { players, matchups } = data;

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No matchup data available yet.
      </div>
    );
  }

  // Get win rate color based on percentage
  const getWinRateColor = (winRate: number, games: number) => {
    if (games === 0) return 'bg-[#1A1B1E]';
    if (winRate >= 60) return 'bg-[#33D9B2]/30';
    if (winRate >= 50) return 'bg-[#33D9B2]/15';
    if (winRate >= 40) return 'bg-[#FF6B6B]/15';
    return 'bg-[#FF6B6B]/30';
  };

  const getWinRateTextColor = (winRate: number, games: number) => {
    if (games === 0) return 'text-[#909296]';
    if (winRate >= 55) return 'text-[#33D9B2]';
    if (winRate >= 45) return 'text-white';
    return 'text-[#FF6B6B]';
  };

  return (
    <div className="w-full overflow-x-auto">
      {/* Matrix Grid */}
      <div className="min-w-fit">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-[#909296] text-xs font-normal w-24">vs</th>
              {players.map((player) => (
                <th
                  key={player.id}
                  className={`p-2 text-center text-xs font-medium ${
                    player.id === currentPlayerId ? 'text-[#667eea]' : 'text-white'
                  }`}
                  style={{ minWidth: '60px' }}
                >
                  <span className="truncate block max-w-[60px]" title={player.name}>
                    {player.name.split(' ')[0]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((rowPlayer) => (
              <tr key={rowPlayer.id}>
                <td
                  className={`p-2 text-xs font-medium ${
                    rowPlayer.id === currentPlayerId ? 'text-[#667eea]' : 'text-white'
                  }`}
                >
                  <span className="truncate block max-w-[80px]" title={rowPlayer.name}>
                    {rowPlayer.name.split(' ')[0]}
                  </span>
                </td>
                {players.map((colPlayer) => {
                  // Same player = diagonal
                  if (rowPlayer.id === colPlayer.id) {
                    return (
                      <td
                        key={colPlayer.id}
                        className="p-1 text-center"
                      >
                        <div className="w-full h-10 bg-[#141517] rounded flex items-center justify-center text-[#909296] text-xs">
                          —
                        </div>
                      </td>
                    );
                  }

                  const stats = matchups[rowPlayer.id]?.[colPlayer.id] || {
                    wins: 0,
                    losses: 0,
                    games: 0,
                    win_rate: 0,
                  };

                  return (
                    <td key={colPlayer.id} className="p-1 text-center">
                      <button
                        onClick={() =>
                          setSelectedCell({
                            player1: rowPlayer.name,
                            player2: colPlayer.name,
                            stats,
                          })
                        }
                        className={`w-full h-10 rounded flex flex-col items-center justify-center transition-all hover:ring-1 hover:ring-[#667eea] ${getWinRateColor(
                          stats.win_rate,
                          stats.games
                        )}`}
                      >
                        {stats.games > 0 ? (
                          <>
                            <span className={`text-sm font-bold ${getWinRateTextColor(stats.win_rate, stats.games)}`}>
                              {stats.win_rate.toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-[#909296]">
                              {stats.games}g
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-[#909296]">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Detail */}
      {selectedCell && selectedCell.stats.games > 0 && (
        <div className="mt-4 p-4 bg-[#141517] rounded-lg border border-[#2C2E33]">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-white font-semibold">
                {selectedCell.player1} vs {selectedCell.player2}
              </h4>
              <p className="text-[#909296] text-sm mt-1">
                {selectedCell.stats.games} games played together
              </p>
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-[#909296] hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#33D9B2]">
                {selectedCell.stats.wins}
              </div>
              <div className="text-xs text-[#909296]">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#FF6B6B]">
                {selectedCell.stats.losses}
              </div>
              <div className="text-xs text-[#909296]">Losses</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getWinRateTextColor(selectedCell.stats.win_rate, selectedCell.stats.games)}`}>
                {selectedCell.stats.win_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-[#909296]">Win Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-[#909296]">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-[#33D9B2]/30" />
          <span>&gt;60%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-[#33D9B2]/15" />
          <span>50-60%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-[#FF6B6B]/15" />
          <span>40-50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-[#FF6B6B]/30" />
          <span>&lt;40%</span>
        </div>
      </div>
    </div>
  );
}
