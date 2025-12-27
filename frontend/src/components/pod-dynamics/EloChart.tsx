import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import type { EloHistoryData } from '../../services/api';

interface EloChartProps {
  data: EloHistoryData;
}

export function EloChart({ data }: EloChartProps) {
  if (!data.history || data.history.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No Elo history yet. Play some games to see your rating progress!
      </div>
    );
  }

  // Format data for the chart
  const chartData = data.history.map((point, index) => ({
    ...point,
    index,
    formattedDate: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Calculate y-axis domain with some padding
  const eloValues = chartData.map(d => d.elo);
  const minElo = Math.min(...eloValues);
  const maxElo = Math.max(...eloValues);
  const padding = Math.max(50, (maxElo - minElo) * 0.1);
  const yMin = Math.floor((minElo - padding) / 50) * 50;
  const yMax = Math.ceil((maxElo + padding) / 50) * 50;

  return (
    <div className="w-full">
      {/* Stats summary */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[#909296] text-xs">Current</span>
          <span className="text-white font-bold text-lg">{data.current_elo}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#909296] text-xs">Peak</span>
          <span className="text-[#33D9B2] font-bold text-lg">{data.peak_elo}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#909296] text-xs">Lowest</span>
          <span className="text-[#FF6B6B] font-bold text-lg">{data.lowest_elo}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#909296] text-xs">Games</span>
          <span className="text-white font-bold text-lg">{data.games_rated}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px] md:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="formattedDate"
              stroke="#909296"
              tick={{ fill: '#909296', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2C2E33' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="#909296"
              tick={{ fill: '#909296', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2C2E33' }}
              tickFormatter={(value) => value.toString()}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1B1E',
                border: '1px solid #2C2E33',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#909296', fontSize: 12, marginBottom: 4 }}
              formatter={(value: number | undefined, name: string | undefined) => {
                if (name === 'elo') {
                  return [<span className="text-white font-semibold">{value ?? 0}</span>, 'Elo'];
                }
                return [value ?? 0, name];
              }}
              labelFormatter={(label) => label}
            />
            {/* Reference line at 1000 (starting Elo) */}
            <ReferenceLine y={1000} stroke="#2C2E33" strokeDasharray="3 3" />
            {/* Peak reference line */}
            <ReferenceLine y={data.peak_elo} stroke="#33D9B2" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line
              type="monotone"
              dataKey="elo"
              stroke="#667eea"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#667eea', stroke: '#1A1B1E', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
