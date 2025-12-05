import { useMemo } from 'react';
import type { CalendarData } from '../../services/api';
import { Calendar, Clock, TrendingUp, Gamepad2 } from 'lucide-react';

interface PlayFrequencyCalendarProps {
  data: CalendarData;
}

// Get color intensity based on game count
function getIntensityColor(count: number, maxCount: number): string {
  if (count === 0) return 'bg-[#1A1B1E]';
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  if (intensity <= 0.25) return 'bg-[#33D9B2]/20';
  if (intensity <= 0.5) return 'bg-[#33D9B2]/40';
  if (intensity <= 0.75) return 'bg-[#33D9B2]/60';
  return 'bg-[#33D9B2]/90';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

export function PlayFrequencyCalendar({ data }: PlayFrequencyCalendarProps) {
  const { calendar, stats } = data;

  // Group calendar data into weeks
  const { weeks, maxCount, monthLabels } = useMemo(() => {
    const weeks: typeof calendar[] = [];
    let currentWeek: typeof calendar = [];
    let max = 0;
    const months: { month: number; weekIndex: number }[] = [];
    let lastMonth = -1;

    calendar.forEach((day, index) => {
      if (day.count > max) max = day.count;

      // Track month changes for labels
      if (day.month !== lastMonth) {
        months.push({ month: day.month, weekIndex: Math.floor(index / 7) });
        lastMonth = day.month;
      }

      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { weeks, maxCount: max, monthLabels: months };
  }, [calendar]);

  if (calendar.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#909296] text-sm">
        No play history available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Heatmap */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Month labels */}
          <div className="flex mb-1 pl-8">
            {monthLabels.map(({ month, weekIndex }, i) => (
              <div
                key={`${month}-${i}`}
                className="text-[10px] text-[#909296]"
                style={{
                  position: 'absolute',
                  left: `${weekIndex * 14 + 32}px`,
                }}
              >
                {MONTHS[month - 1]}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-0.5 mt-4">
            {/* Weekday labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {WEEKDAYS.map((day, i) => (
                <div key={i} className="w-6 h-3 text-[9px] text-[#909296] flex items-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`w-3 h-3 rounded-sm ${getIntensityColor(day.count, maxCount)} hover:ring-1 hover:ring-white/50 transition-all cursor-default`}
                    title={`${day.date}: ${day.count} game${day.count !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-xs text-[#909296]">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-[#1A1B1E]" />
              <div className="w-3 h-3 rounded-sm bg-[#33D9B2]/20" />
              <div className="w-3 h-3 rounded-sm bg-[#33D9B2]/40" />
              <div className="w-3 h-3 rounded-sm bg-[#33D9B2]/60" />
              <div className="w-3 h-3 rounded-sm bg-[#33D9B2]/90" />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-xs mb-1">
            <Calendar size={12} />
            <span>Days Played</span>
          </div>
          <div className="text-white text-lg font-bold">{stats.total_days_played}</div>
        </div>

        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-xs mb-1">
            <Gamepad2 size={12} />
            <span>Per Session</span>
          </div>
          <div className="text-white text-lg font-bold">
            {stats.avg_games_per_play_day > 0 ? `${stats.avg_games_per_play_day}` : 'N/A'}
          </div>
        </div>

        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-xs mb-1">
            <TrendingUp size={12} />
            <span>Best Day</span>
          </div>
          <div className="text-white text-lg font-bold">
            {stats.best_weekday || 'N/A'}
          </div>
          {stats.best_weekday_count > 0 && (
            <div className="text-[#909296] text-[10px]">{stats.best_weekday_count} games</div>
          )}
        </div>

        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-xs mb-1">
            <Clock size={12} />
            <span>Last Game</span>
          </div>
          <div className="text-white text-lg font-bold">
            {stats.days_since_last_game !== null
              ? stats.days_since_last_game === 0
                ? 'Today'
                : stats.days_since_last_game === 1
                ? 'Yesterday'
                : `${stats.days_since_last_game}d ago`
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      {(stats.longest_gap_days > 7 || stats.busiest_month) && (
        <div className="text-xs text-[#909296] text-center space-y-1">
          {stats.longest_gap_days > 7 && (
            <p>Longest break between games: <span className="text-white">{stats.longest_gap_days} days</span></p>
          )}
          {stats.busiest_month && (
            <p>
              Busiest month: <span className="text-[#33D9B2]">{stats.busiest_month}</span> ({stats.busiest_month_count} games)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
