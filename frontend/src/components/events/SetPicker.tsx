import { useState, useEffect, useRef } from 'react';
import type { DraftSet } from '../../services/api';
import { eventApi } from '../../services/api';
import { IconX } from '@tabler/icons-react';

interface SetPickerProps {
  selectedSets: DraftSet[];
  onChange: (sets: DraftSet[]) => void;
  maxSets?: number;
}

function SetPicker({ selectedSets, onChange, maxSets = 4 }: SetPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<DraftSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isAtMax = selectedSets.length >= maxSets;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (inputValue.length < 2 || isAtMax) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await eventApi.searchSets(inputValue);
        // Filter out already-selected sets
        const selectedCodes = new Set(selectedSets.map((s) => s.code));
        const filtered = results.filter((s) => !selectedCodes.has(s.code));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error searching sets:', error);
        setSuggestions([]);
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [inputValue, isAtMax, selectedSets]);

  const selectSet = (set: DraftSet) => {
    if (isAtMax) return;
    onChange([...selectedSets, set]);
    setInputValue('');
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const removeSet = (code: string) => {
    onChange(selectedSets.filter((s) => s.code !== code));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectSet(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const getReleaseYear = (set: DraftSet): string => {
    // The set name sometimes contains a year; we just show the code as fallback
    return set.code.toUpperCase();
  };

  return (
    <div ref={wrapperRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={isAtMax ? `Max ${maxSets} sets selected` : 'Search for an MTG set...'}
          className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isAtMax}
          autoComplete="off"
        />

        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="loading-spinner-small"></div>
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 bg-[#25262B] border border-[#2C2E33] rounded-[8px] shadow-lg max-h-60 overflow-y-auto"
          >
            {suggestions.map((set, index) => (
              <div
                key={set.code}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-[#667eea]/20 text-white'
                    : 'text-[#C1C2C5] hover:bg-[#2C2E33]'
                }`}
                onClick={() => selectSet(set)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <img
                  src={set.icon_svg_uri}
                  alt={set.name}
                  className="w-5 h-5 flex-shrink-0"
                  style={{ filter: 'invert(1)' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{set.name}</div>
                  <div className="text-xs text-[#5C5F66]">{set.code.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Sets Chips */}
      {selectedSets.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedSets.map((set) => (
            <div
              key={set.code}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#667eea]/15 border border-[#667eea]/30 text-sm text-[#C1C2C5]"
            >
              <img
                src={set.icon_svg_uri}
                alt={set.name}
                className="w-4 h-4"
                style={{ filter: 'invert(1)' }}
              />
              <span className="truncate max-w-[150px]">{set.name}</span>
              <button
                onClick={() => removeSet(set.code)}
                className="flex-shrink-0 text-[#909296] hover:text-white transition-colors"
                aria-label={`Remove ${set.name}`}
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-[#5C5F66] mt-2">
        {selectedSets.length}/{maxSets} sets selected
      </p>
    </div>
  );
}

export default SetPicker;
