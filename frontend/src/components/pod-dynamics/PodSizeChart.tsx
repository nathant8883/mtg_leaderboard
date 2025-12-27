import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import type { PodSizePerformance } from '../../services/api';

interface PodSizeChartProps {
  data: Record<string, PodSizePerformance>;
}

export function PodSizeChart({ data }: PodSizeChartProps) {
  // Convert to array format for chart
  const chartData = ['3', '4', '5', '6']
    .filter(size => data[size])
    .map(size => ({
      size: `${size}P`,
      fullSize: `${size} Players`,
      win_rate: data[size].win_rate,
      games: data[size].games,
      wins: data[size].wins,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-[#909296] text-sm">
        No pod size data available yet.
      </div>
    );
  }

  // Calculate average expected win rate based on pod sizes played
  const totalGames = chartData.reduce((sum, d) => sum + d.games, 0);
  const weightedExpected = chartData.reduce((sum, d) => {
    const podSize = parseInt(d.size);
    const expectedRate = (1 / podSize) * 100;
    return sum + (expectedRate * d.games);
  }, 0);
  const avgExpectedRate = totalGames > 0 ? weightedExpected / totalGames : 25;

  // Find best performing pod size
  const bestPodSize = chartData.reduce((best, curr) =>
    curr.win_rate > best.win_rate ? curr : best
  , chartData[0]);

  return (
    <div className="w-full">
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="size"
              stroke="#909296"
              tick={{ fill: '#909296', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#2C2E33' }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#909296"
              tick={{ fill: '#909296', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2C2E33' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1B1E',
                border: '1px solid #2C2E33',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number | undefined, _name: string | undefined, props: any) => {
                const item = props.payload;
                return [
                  <div key="tooltip" className="text-white">
                    <div className="font-semibold">{(value ?? 0).toFixed(1)}% win rate</div>
                    <div className="text-xs text-[#909296]">{item.wins} wins / {item.games} games</div>
                  </div>,
                  ''
                ];
              }}
              labelFormatter={(label) => `${label} games`}
            />
            {/* Reference line for expected win rate */}
            <ReferenceLine
              y={avgExpectedRate}
              stroke="#909296"
              strokeDasharray="3 3"
              label={{
                value: 'Expected',
                position: 'right',
                fill: '#909296',
                fontSize: 10,
              }}
            />
            <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => {
                const podSize = parseInt(entry.size);
                const expectedRate = (1 / podSize) * 100;
                const isAboveExpected = entry.win_rate > expectedRate;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isAboveExpected ? '#33D9B2' : '#667eea'}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insight text */}
      {bestPodSize && bestPodSize.games >= 5 && (
        <div className="mt-3 text-center">
          <span className="text-xs text-[#909296]">
            You perform best in{' '}
            <span className="text-[#33D9B2] font-semibold">{bestPodSize.fullSize}</span>
            {' '}games with a{' '}
            <span className="text-white font-semibold">{bestPodSize.win_rate.toFixed(1)}%</span>
            {' '}win rate
          </span>
        </div>
      )}
    </div>
  );
}
