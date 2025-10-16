import { useState } from 'react';
import type { PlayerSlot } from '../../pages/MatchTracker';

interface CommanderDamageOverlayProps {
  targetPlayer: PlayerSlot;
  allPlayers: PlayerSlot[];
  commanderDamage: { [opponentPosition: number]: number };
  onUpdate: (opponentPosition: number, damage: number) => void;
  onClose: () => void;
}

function CommanderDamageOverlay({
  targetPlayer,
  allPlayers,
  commanderDamage,
  onUpdate,
  onClose,
}: CommanderDamageOverlayProps) {
  const opponents = allPlayers.filter((p) => p.position !== targetPlayer.position);

  const handleDamageChange = (opponentPosition: number, delta: number) => {
    const currentDamage = commanderDamage[opponentPosition] || 0;
    const newDamage = Math.max(0, currentDamage + delta);
    onUpdate(opponentPosition, newDamage);
  };

  const getTotalCommanderDamage = () => {
    return Object.values(commanderDamage).reduce((sum, dmg) => sum + dmg, 0);
  };

  const getLethalOpponents = () => {
    return Object.entries(commanderDamage)
      .filter(([_, damage]) => damage >= 21)
      .map(([pos]) => parseInt(pos));
  };

  const lethalOpponents = getLethalOpponents();

  return (
    <div className="commander-damage-overlay" onClick={onClose}>
      <div className="commander-damage-panel" onClick={(e) => e.stopPropagation()}>
        <div className="commander-damage-header">
          <div>
            <h3>Commander Damage</h3>
            <div className="target-player-name">{targetPlayer.playerName}</div>
          </div>
          <button className="close-overlay-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {lethalOpponents.length > 0 && (
          <div className="lethal-warning">
            ⚠️ Lethal commander damage from {lethalOpponents.length} opponent{lethalOpponents.length > 1 ? 's' : ''}!
          </div>
        )}

        <div className="total-commander-damage">
          <span>Total Commander Damage</span>
          <span className="total-value">{getTotalCommanderDamage()}</span>
        </div>

        <div className="opponents-list">
          {opponents.map((opponent) => {
            const damage = commanderDamage[opponent.position] || 0;
            const isLethal = damage >= 21;

            return (
              <div key={opponent.position} className={`opponent-row ${isLethal ? 'lethal' : ''}`}>
                <div className="opponent-info">
                  <div className="opponent-name">{opponent.playerName}</div>
                  <div className="opponent-deck">{opponent.deckName}</div>
                </div>

                <div className="damage-controls">
                  <button
                    className="damage-btn"
                    onClick={() => handleDamageChange(opponent.position, -1)}
                  >
                    −
                  </button>

                  <div className="damage-value">{damage}</div>

                  <button
                    className="damage-btn"
                    onClick={() => handleDamageChange(opponent.position, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button className="done-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export default CommanderDamageOverlay;
