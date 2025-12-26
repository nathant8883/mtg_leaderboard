import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import type { ColorStatsData } from '../../services/api';
import { getBlendedColor, getColorIdentityName } from '../../utils/manaColors';

interface ColorPerformanceProps {
  data: ColorStatsData;
}

const COLOR_MAP: Record<string, { name: string; hex: string }> = {
  'W': { name: 'White', hex: '#F9FAF4' },
  'U': { name: 'Blue', hex: '#0E68AB' },
  'B': { name: 'Black', hex: '#150B00' },
  'R': { name: 'Red', hex: '#D3202A' },
  'G': { name: 'Green', hex: '#00733E' },
};

// Simple palette for color count section (1-color, 2-color, etc.)
const COLOR_COUNT_PALETTE = ['#909296', '#667eea', '#33D9B2', '#FFA500', '#FF6B6B', '#FFD700'];


export function ColorPerformance({ data }: ColorPerformanceProps) {
  const { by_color, by_color_count, meta_composition } = data;

  // Prepare color win rate data
  const colorData = Object.entries(COLOR_MAP).map(([code, info]) => ({
    color: code,
    name: info.name,
    hex: info.hex,
    win_rate: by_color[code]?.win_rate || 0,
    games: by_color[code]?.games || 0,
    wins: by_color[code]?.wins || 0,
  })).filter(c => c.games > 0);

  // Prepare color count data
  const colorCountData = Object.entries(by_color_count).map(([label, stats]) => ({
    label,
    win_rate: stats.win_rate,
    games: stats.games,
    wins: stats.wins,
  }));

  // Prepare meta composition data
  const metaData = Object.entries(meta_composition).map(([identity, stats]) => ({
    identity: identity === 'C' ? 'Colorless' : identity,
    count: stats.count,
    percentage: stats.percentage,
  }));

  if (colorData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No color data available yet.
      </div>
    );
  }

  // Find best and worst performing colors
  const bestColor = colorData.reduce((best, curr) =>
    curr.games >= 3 && curr.win_rate > best.win_rate ? curr : best
  , { win_rate: -1, name: '', games: 0 } as typeof colorData[0]);

  const worstColor = colorData.reduce((worst, curr) =>
    curr.games >= 3 && (worst.win_rate === -1 || curr.win_rate < worst.win_rate) ? curr : worst
  , { win_rate: -1, name: '', games: 0 } as typeof colorData[0]);

  return (
    <div className="space-y-6">
      {/* Color Win Rates */}
      <div>
        <h4 className="text-white font-medium mb-3 text-sm">Win Rate by Color</h4>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={colorData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                domain={[0, 50]}
                stroke="#909296"
                tick={{ fill: '#909296', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2C2E33' }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#909296"
                tick={{ fill: '#909296', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1B1E',
                  border: '1px solid #2C2E33',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                formatter={(value: number, _name: string, props: any) => {
                  const item = props.payload;
                  return [
                    <div key="tooltip" className="text-white">
                      <div className="font-semibold">{value.toFixed(1)}% win rate</div>
                      <div className="text-xs text-[#909296]">{item.wins} wins / {item.games} games</div>
                    </div>,
                    ''
                  ];
                }}
              />
              <Bar dataKey="win_rate" radius={[0, 4, 4, 0]}>
                {colorData.map((entry) => (
                  <Cell key={entry.color} fill={entry.hex} stroke="#2C2E33" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insight */}
        {bestColor.games >= 3 && worstColor.games >= 3 && bestColor.name !== worstColor.name && (
          <p className="text-xs text-[#909296] text-center mt-2">
            <span className="text-[#33D9B2]">{bestColor.name}</span> performs best ({bestColor.win_rate.toFixed(0)}%),
            while <span className="text-[#FF6B6B]">{worstColor.name}</span> struggles ({worstColor.win_rate.toFixed(0)}%)
          </p>
        )}
      </div>

      {/* Color Count Performance */}
      {colorCountData.length > 0 && (
        <div>
          <h4 className="text-white font-medium mb-3 text-sm">Win Rate by Color Count</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {colorCountData.map((item, index) => (
              <div
                key={item.label}
                className="bg-[#141517] rounded-lg p-3 text-center"
              >
                <div className="text-xs text-[#909296] mb-1">{item.label}</div>
                <div
                  className="text-lg font-bold"
                  style={{ color: COLOR_COUNT_PALETTE[index % COLOR_COUNT_PALETTE.length] }}
                >
                  {item.win_rate.toFixed(0)}%
                </div>
                <div className="text-xs text-[#909296]">{item.games}g</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta Composition Pie */}
      {metaData.length > 0 && (
        <div>
          <h4 className="text-white font-medium mb-3 text-sm">Meta Composition</h4>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <div className="w-[200px] h-[200px] sm:w-[120px] sm:h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metaData.slice(0, 6)}
                    dataKey="count"
                    nameKey="identity"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    strokeWidth={1}
                    stroke="#1A1B1E"
                  >
                    {metaData.slice(0, 6).map((entry) => (
                      <Cell key={entry.identity} fill={getBlendedColor(entry.identity)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1">
                {metaData.slice(0, 5).map((item) => (
                  <div key={item.identity} className="flex items-center gap-1.5 text-sm">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: getBlendedColor(item.identity) }}
                    />
                    <span className="text-white font-medium">{getColorIdentityName(item.identity)}</span>
                    <span className="text-[#909296] text-xs">{item.percentage}%</span>
                  </div>
                ))}
                {metaData.length > 5 && (
                  <span className="text-xs text-[#909296]">+{metaData.length - 5} more</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
