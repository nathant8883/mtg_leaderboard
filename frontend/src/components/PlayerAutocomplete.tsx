import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { playerApi, type Player } from '../services/api';
import './PlayerAutocomplete.css';

interface PlayerAutocompleteProps {
  onSelect: (player: Player) => void;
  placeholder?: string;
  disabled?: boolean;
}

function PlayerAutocomplete({
  onSelect,
  placeholder = "Search for a player...",
  disabled = false
}: PlayerAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Player[]>([]);
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
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await playerApi.search(inputValue);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error searching players:', error);
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

  const selectPlayer = (player: Player) => {
    setInputValue(player.name);
    onSelect(player);
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
          selectPlayer(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Helper function to get avatar display
  const getAvatar = (player: Player): string => {
    if (player.custom_avatar) {
      return player.custom_avatar;
    }
    if (player.picture) {
      return player.picture;
    }
    return player.avatar || '?';
  };

  // Helper function to check if avatar is an image URL
  const isImageUrl = (value: string): boolean => {
    return value.startsWith('http://') ||
           value.startsWith('https://') ||
           value.startsWith('data:image/');
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={disabled}
        autoComplete="off"
      />

      {isLoading && (
        <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
          <div className="loading-spinner-small"></div>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="player-suggestions">
          {suggestions.map((player, index) => {
            const avatarValue = getAvatar(player);
            const isImage = isImageUrl(avatarValue);

            return (
              <div
                key={player.id || index}
                className={`player-suggestion-item ${
                  index === selectedIndex ? 'selected' : ''
                }`}
                onClick={() => selectPlayer(player)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="player-suggestion-avatar">
                  {isImage ? (
                    <img
                      src={avatarValue}
                      alt={player.name}
                      className="player-avatar-image"
                      style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="player-avatar-letter">{avatarValue}</div>
                  )}
                </div>
                <div className="player-suggestion-name">{player.name}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PlayerAutocomplete;
