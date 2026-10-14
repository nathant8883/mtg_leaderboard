import { useNavigate } from 'react-router-dom';
import { useSeason } from '../contexts/SeasonContext';
import SeasonSelector from './SeasonSelector';

const daysBetween = (startIso: string, endIso: string) =>
  Math.round((Date.parse(endIso + 'T00:00:00') - Date.parse(startIso + 'T00:00:00')) / 86_400_000);

/** Dashboard season bar: selector, time left in the current season, Hall of Fame link. */
function SeasonBanner() {
  const navigate = useNavigate();
  const { currentSeason, selected } = useSeason();

  if (!currentSeason) return null;

  const totalDays = daysBetween(currentSeason.start, currentSeason.end) + 1;
  const progress = Math.min(100, Math.max(0, ((totalDays - currentSeason.days_remaining) / totalDays) * 100));

  return (
    <div className="flex items-center gap-3 mb-4 md:mb-6">
      <SeasonSelector />

      {selected === 'current' ? (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 h-1.5 rounded-full bg-[#25262B] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            />
          </div>
          <span className="text-xs text-[#909296] whitespace-nowrap">{currentSeason.days_remaining}d left</span>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <button
        type="button"
        onClick={() => navigate('/seasons')}
        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#2C2E33] bg-[#25262B] cursor-pointer transition-colors hover:border-[#FFD700]"
        title="Hall of Fame"
        aria-label="Hall of Fame"
      >
        <span aria-hidden>👑</span>
      </button>
    </div>
  );
}

export default SeasonBanner;
