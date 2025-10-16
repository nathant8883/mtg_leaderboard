import { useState } from 'react';

interface GameConfigProps {
  onSelectPlayerCount: (count: number) => void;
}

function GameConfig({ onSelectPlayerCount }: GameConfigProps) {
  const [selectedCount, setSelectedCount] = useState<number | null>(null);

  const playerCounts = [3, 4, 5, 6];

  const handleSelect = (count: number) => {
    setSelectedCount(count);
  };

  const handleContinue = () => {
    if (selectedCount) {
      onSelectPlayerCount(selectedCount);
    }
  };

  return (
    <div className="game-config">
      <div className="config-header">
        <h1>Match Tracker</h1>
        <p className="config-subtitle">How many players?</p>
      </div>

      <div className="player-count-grid">
        {playerCounts.map((count) => (
          <button
            key={count}
            className={`player-count-btn ${selectedCount === count ? 'selected' : ''}`}
            onClick={() => handleSelect(count)}
          >
            <span className="player-count-icon">👥</span>
            <span className="player-count-number">{count}</span>
            <span className="player-count-label">Players</span>
          </button>
        ))}
      </div>

      <button
        className="continue-btn"
        onClick={handleContinue}
        disabled={!selectedCount}
      >
        Continue
      </button>
    </div>
  );
}

export default GameConfig;
