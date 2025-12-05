import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { PlacementData } from '../../services/api';

interface PlacementChartProps {
  data: Record<string, PlacementData>;
}

const PLACEMENT_COLORS = {
  '1': '#FFD700', // Gold - 1st place
  '2': '#C0C0C0', // Silver - 2nd place
  '3': '#CD7F32', // Bronze - 3rd place
  '4': '#667eea', // Purple - 4th place
  '5': '#909296', // Gray - 5th place
  '6': '#4a4a4a', // Dark gray - 6th place
};

const PLACEMENT_LABELS = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
  '4': '4th',
  '5': '5th',
  '6': '6th',
};

export function PlacementChart({ data }: PlacementChartProps) {
  // Filter to only placements with data
  const chartData = Object.entries(data)
    .filter(([_, value]) => value.count > 0)
    .map(([key, value]) => ({
      name: PLACEMENT_LABELS[key as keyof typeof PLACEMENT_LABELS] || `${key}th`,
      value: value.count,
      percentage: value.percentage,
      color: PLACEMENT_COLORS[key as keyof typeof PLACEMENT_COLORS] || '#909296',
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No placement data available yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-[200px] md:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, payload }) => `${name}: ${(payload as { percentage: number }).percentage.toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1B1E',
                border: '1px solid #2C2E33',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} games (${props.payload.percentage.toFixed(1)}%)`,
                name
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-[#909296]">
              {entry.name}: {entry.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
