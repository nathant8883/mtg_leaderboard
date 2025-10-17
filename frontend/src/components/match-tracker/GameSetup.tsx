import { useState } from 'react';

interface GameSetupProps {
  initialPlayerCount: number;
  initialStartingLife: number;
  onComplete: (playerCount: number, startingLife: number) => void;
  onExit: () => void;
}

function GameSetup({ initialPlayerCount, initialStartingLife, onComplete, onExit }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState<number>(initialPlayerCount);
  const [startingLife, setStartingLife] = useState<number>(initialStartingLife);

  const playerCountOptions = [3, 4, 5, 6];

  const handleStartingLifeChange = (delta: number) => {
    const newLife = startingLife + delta;
    if (newLife >= 1 && newLife <= 200) {
      setStartingLife(newLife);
    }
  };

  const handleNext = () => {
    onComplete(playerCount, startingLife);
  };

  return (
    <div className="game-setup">
      <div className="setup-header">
        <button className="exit-btn" onClick={onExit} title="Exit to Home">
          ✕
        </button>
        <h1>Match Setup</h1>
      </div>

      {/* Player Count Selector */}
      <div className="setup-section">
        <h3 className="section-label">Number of Players</h3>
        <div className="player-count-selector">
          {playerCountOptions.map((count) => (
            <button
              key={count}
              className={`count-option ${playerCount === count ? 'selected' : ''}`}
              onClick={() => setPlayerCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Starting Life Selector */}
      <div className="setup-section">
        <h3 className="section-label">Starting Life</h3>
        <div className="life-adjuster">
          <button
            className="life-btn-large"
            onClick={() => handleStartingLifeChange(-1)}
          >
            −
          </button>
          <div className="life-display">{startingLife}</div>
          <button
            className="life-btn-large"
            onClick={() => handleStartingLifeChange(1)}
          >
            +
          </button>
        </div>
        <div className="life-presets">
          {[20, 30, 40].map((life) => (
            <button
              key={life}
              className={`life-preset ${startingLife === life ? 'active' : ''}`}
              onClick={() => setStartingLife(life)}
            >
              {life}
            </button>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <button className="start-game-btn" onClick={handleNext}>
        Next
      </button>
    </div>
  );
}

export default GameSetup;
