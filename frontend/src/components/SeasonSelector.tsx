import { useEffect, useRef, useState } from 'react';
import { useSeason } from '../contexts/SeasonContext';
import type { SeasonParam } from '../services/api';

interface SeasonSelectorProps {
  className?: string;
  /** Right-align the dropdown menu (when the pill sits at the right edge) */
  alignRight?: boolean;
}

/** Pill dropdown that switches every stats view between seasons and all time. */
function SeasonSelector({ className = '', alignRight = false }: SeasonSelectorProps) {
  const { seasons, currentSeason, selected, setSelected, selectedSeason } = useSeason();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Preseason: nothing to choose yet
  if (seasons.length === 0) return null;

  const label = selected === 'all' ? 'All Time' : selectedSeason?.label ?? 'Season';
  const isCurrent = selected === 'current' || selectedSeason?.is_current;

  const choose = (value: SeasonParam) => {
    setSelected(value);
    setOpen(false);
  };

  const optionClass = (active: boolean) =>
    `w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 rounded-[6px] border-none cursor-pointer transition-colors ${
      active ? 'bg-[rgba(102,126,234,0.15)] text-white' : 'bg-transparent text-[#C1C2C5] hover:bg-[#25262B]'
    }`;

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2C2E33] bg-[#25262B] text-white text-sm font-semibold cursor-pointer transition-colors hover:border-[#667eea]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        {isCurrent && selected !== 'all' && (
          <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full bg-[rgba(51,217,178,0.15)] text-[#33D9B2]">
            Live
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#909296" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute top-full mt-2 z-[1001] min-w-[200px] p-1 rounded-[10px] border border-[#2C2E33] bg-[#1A1B1E] shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${alignRight ? 'right-0' : 'left-0'}`}
        >
          {seasons.map(season => {
            const active = season.is_current ? selected === 'current' : selected === season.number;
            return (
              <button
                key={season.number}
                type="button"
                role="option"
                aria-selected={active}
                className={optionClass(active)}
                onClick={() => choose(season.number === currentSeason?.number ? 'current' : season.number)}
              >
                <span className="font-semibold">{season.label}</span>
                <span className="text-xs text-[#909296]">
                  {season.is_current ? 'Current' : season.quarter_label}
                </span>
              </button>
            );
          })}
          <div className="h-px bg-[#2C2E33] my-1" />
          <button
            type="button"
            role="option"
            aria-selected={selected === 'all'}
            className={optionClass(selected === 'all')}
            onClick={() => choose('all')}
          >
            <span className="font-semibold">All Time</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default SeasonSelector;
