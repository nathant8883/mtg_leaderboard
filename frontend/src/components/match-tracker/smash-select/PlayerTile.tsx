import type { Player } from '../../../services/api';
import { getSeatColor } from './SeatColors';

interface PlayerTileProps {
  player: Player;
  onSelect: (player: Player) => void;
  isDisabled?: boolean;
  assignedToSeat?: number; // Which seat this player is already assigned to
  animationDelay?: number;
}

function PlayerTile({ player, onSelect, isDisabled, assignedToSeat, animationDelay = 0 }: PlayerTileProps) {
  const seatColor = assignedToSeat ? getSeatColor(assignedToSeat) : null;

  return (
    <button
      className={`smash-player-tile ${isDisabled ? 'disabled' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={() => !isDisabled && onSelect(player)}
      disabled={isDisabled}
    >
      {/* Glass shine effect */}
      <div className="smash-tile-shine" />

      {/* Avatar with glow ring */}
      <div className="smash-player-avatar-wrapper">
        <div className="smash-player-avatar">
          {player.custom_avatar || player.picture ? (
            <img
              src={player.custom_avatar || player.picture}
              alt={player.name}
              className="smash-player-avatar-img"
            />
          ) : (
            <span className="smash-player-avatar-letter">
              {player.avatar || player.name[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="smash-avatar-glow" />
      </div>

      {/* Name */}
      <div className="smash-player-name">{player.name}</div>

      {/* Taken badge overlay */}
      {assignedToSeat && (
        <div
          className="smash-taken-badge"
          style={{ backgroundColor: seatColor?.primary }}
        >
          P{assignedToSeat}
        </div>
      )}
    </button>
  );
}

export default PlayerTile;
