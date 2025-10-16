import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { scryfallApi, type CommanderCard } from '../services/api';
import ColorPips from './ColorPips';

interface CommanderAutocompleteProps {
  value: string;
  onChange: (commander: string, imageUrl?: string, colors?: string[]) => void;
  disabled?: boolean;
}

function CommanderAutocomplete({ value, onChange, disabled = false }: CommanderAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<CommanderCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    if (inputValue.length < 2) {
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
        const results = await scryfallApi.searchCommanders(inputValue);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error searching commanders:', error);
        setSuggestions([]);
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [inputValue]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setSelectedIndex(-1);
  };

  const selectCommander = (commander: CommanderCard) => {
    setInputValue(commander.name);
    onChange(
      commander.name,
      commander.image_art_crop || commander.image_normal,
      commander.color_identity
    );
    setShowSuggestions(false);
    setSuggestions([]);
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
          selectCommander(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Search for a legendary creature..."
        className="form-input"
        disabled={disabled}
        autoComplete="off"
      />

      {isLoading && (
        <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
          <div className="loading-spinner-small"></div>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="commander-suggestions">
          {suggestions.map((commander, index) => (
            <div
              key={`${commander.name}-${index}`}
              className={`commander-suggestion-item ${
                index === selectedIndex ? 'selected' : ''
              }`}
              onClick={() => selectCommander(commander)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {commander.image_small && (
                <img
                  src={commander.image_small}
                  alt={commander.name}
                  className="commander-suggestion-image"
                />
              )}
              <div className="commander-suggestion-info">
                <div className="commander-suggestion-name">{commander.name}</div>
                <div className="commander-suggestion-type">{commander.type_line}</div>
              </div>
              {commander.color_identity.length > 0 && (
                <div className="commander-suggestion-colors">
                  <ColorPips colors={commander.color_identity} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommanderAutocomplete;
