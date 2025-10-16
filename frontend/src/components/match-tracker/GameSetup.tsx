import { useState } from 'react';
import type { LayoutType } from '../../pages/MatchTracker';

interface GameSetupProps {
  initialPlayerCount: number;
  initialLayout: LayoutType;
  initialStartingLife: number;
  onComplete: (playerCount: number, layout: LayoutType, startingLife: number) => void;
  onExit: () => void;
}

function GameSetup({ initialPlayerCount, initialLayout, initialStartingLife, onComplete, onExit }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState<number>(initialPlayerCount);
  const [startingLife, setStartingLife] = useState<number>(initialStartingLife);
  const [layout, setLayout] = useState<LayoutType>(initialLayout);

  const playerCountOptions = [3, 4, 5, 6];

  // Layout preview components
  const getLayoutPreview = (layoutId: LayoutType, count: number): React.ReactElement => {
    switch (layoutId) {
      case 'grid':
        if (count === 3) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', gridColumn: '1 / -1' }}></div>
            </div>
          );
        } else if (count === 4) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
            </div>
          );
        } else if (count === 5) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', gridColumn: '2 / 4' }}></div>
            </div>
          );
        } else {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
            </div>
          );
        }
      case 'horizontal':
        const hBoxes = Array(count).fill(0).map((_, i) => (
          <div key={i} className="layout-preview-box" style={{ width: '100%', flex: 1 }}></div>
        ));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: count > 4 ? '3px' : '4px', width: '60px', height: '60px' }}>
            {hBoxes}
          </div>
        );
      case 'vertical':
        const vBoxes = Array(count).fill(0).map((_, i) => (
          <div key={i} className="layout-preview-box" style={{ height: '100%', flex: 1 }}></div>
        ));
        return (
          <div style={{ display: 'flex', gap: count > 4 ? '3px' : '4px', width: '60px', height: '60px' }}>
            {vBoxes}
          </div>
        );
      case 'table':
        if (count === 4) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
            </div>
          );
        } else if (count === 5) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
            </div>
          );
        } else {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
            </div>
          );
        }
      case 'sides':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 20px', gridTemplateRows: '1fr', gap: '4px', width: '60px', height: '60px', alignItems: 'center' }}>
            <div className="layout-preview-box" style={{ width: '100%', height: '40px' }}></div>
            <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
            <div className="layout-preview-box" style={{ width: '100%', height: '40px' }}></div>
          </div>
        );
      case 'circle':
        if (count === 5) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3, gridColumn: '2' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.6 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.6 }}></div>
            </div>
          );
        } else {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', width: '60px', height: '60px' }}>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.3 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.6 }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%' }}></div>
              <div className="layout-preview-box" style={{ width: '100%', height: '100%', opacity: 0.6 }}></div>
            </div>
          );
        }
      default:
        return <div></div>;
    }
  };

  // Get available layouts based on player count
  const getAvailableLayouts = (count: number): { id: LayoutType; name: string }[] => {
    const baseLayouts = [
      { id: 'grid' as LayoutType, name: 'Grid' },
      { id: 'horizontal' as LayoutType, name: 'Horizontal' },
      { id: 'vertical' as LayoutType, name: 'Vertical' },
    ];

    if (count === 3) {
      return [...baseLayouts, { id: 'sides' as LayoutType, name: 'Sides' }];
    } else if (count === 4) {
      return [...baseLayouts, { id: 'table' as LayoutType, name: 'Table' }];
    } else {
      return [...baseLayouts, { id: 'table' as LayoutType, name: 'Table' }, { id: 'circle' as LayoutType, name: 'Circle' }];
    }
  };

  const layouts = getAvailableLayouts(playerCount);

  const handleStartingLifeChange = (delta: number) => {
    const newLife = startingLife + delta;
    if (newLife >= 1 && newLife <= 200) {
      setStartingLife(newLife);
    }
  };

  const handleNext = () => {
    onComplete(playerCount, layout, startingLife);
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

      {/* Layout Selector */}
      <div className="setup-section">
        <h3 className="section-label">Layout</h3>
        <div className="layout-selector-grid">
          {layouts.map((l) => (
            <button
              key={l.id}
              className={`layout-option ${layout === l.id ? 'selected' : ''}`}
              onClick={() => setLayout(l.id)}
            >
              <div className="layout-preview">
                {getLayoutPreview(l.id, playerCount)}
              </div>
              <div className="layout-name">{l.name}</div>
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
