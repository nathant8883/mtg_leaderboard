import { useNavigate } from 'react-router-dom';
import { useSeason } from '../contexts/SeasonContext';
import SeasonSelector from './SeasonSelector';

/** Days into a new season during which the banner points at last season's champions */
const NEW_SEASON_WINDOW_DAYS = 14;

const daysBetween = (startIso: string, endIso: string) =>
  Math.round((Date.parse(endIso + 'T00:00:00') - Date.parse(startIso + 'T00:00:00')) / 86_400_000);

/** Dashboard header: current season, time remaining, season selector, Hall of Fame link. */
function SeasonBanner() {
  const navigate = useNavigate();
  const { currentSeason, seasons, selected, selectedSeason } = useSeason();

  if (!currentSeason) return null;

  const totalDays = daysBetween(currentSeason.start, currentSeason.end) + 1;
  const elapsed = totalDays - currentSeason.days_remaining;
  const progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  const previous = seasons.find(s => s.number === currentSeason.number - 1);
  const justStarted = previous && elapsed <= NEW_SEASON_WINDOW_DAYS;

  const viewingPast = selected !== 'current' && selected !== 'all' && selectedSeason;

  return (
    <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] px-4 py-3 md:px-6 md:py-4 mb-4 md:mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-white font-bold text-lg">{currentSeason.label}</span>
            <span className="text-[#909296] text-sm">{currentSeason.quarter_label}</span>
          </div>
          <div className="text-[#909296] text-xs mt-0.5">
            {currentSeason.days_remaining === 1 ? 'Last day!' : `Ends in ${currentSeason.days_remaining} days`}
            {' · '}Elo resets to 1000 each season
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SeasonSelector alignRight />
          <button
            type="button"
            onClick={() => navigate('/seasons')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#2C2E33] bg-transparent text-[#C1C2C5] text-sm font-semibold cursor-pointer transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
            title="Hall of Fame"
          >
            <span aria-hidden>👑</span>
            <span className="hidden sm:inline">Hall of Fame</span>
          </button>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[#25262B] mt-3 overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full"
          style={{ width: `${progress}%`, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        />
      </div>

      {viewingPast && (
        <div className="text-xs text-[#FFA94D] mt-2">
          Viewing {selectedSeason.label} ({selectedSeason.quarter_label}) final standings
        </div>
      )}
      {!viewingPast && selected !== 'all' && justStarted && (
        <button
          type="button"
          onClick={() => navigate('/seasons')}
          className="mt-2 text-xs text-[#FFD700] bg-transparent border-none p-0 cursor-pointer hover:underline"
        >
          👑 {previous.label} is over - see the champions →
        </button>
      )}
    </div>
  );
}

export default SeasonBanner;
