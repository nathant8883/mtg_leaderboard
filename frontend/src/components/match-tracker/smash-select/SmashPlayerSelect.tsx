import type { Player } from '../../../services/api';
import type { PlayerSlot } from '../../../pages/MatchTracker';
import SmashHeader from './SmashHeader';
import PlayerTile from './PlayerTile';

interface SmashPlayerSelectProps {
  seatNumber: number;
  playerCount: number; // Total players in game (for rotation calculation)
  availablePlayers: Player[];
  assignedPlayers: PlayerSlot[]; // Current seat assignments
  onSelect: (player: Player) => void;
  onGuestClick: () => void;
  onBack: () => void;
  hideGuestOption?: boolean;
}

function SmashPlayerSelect({
  seatNumber,
  playerCount,
  availablePlayers,
  assignedPlayers,
  onSelect,
  onGuestClick,
  onBack,
  hideGuestOption,
}: SmashPlayerSelectProps) {
  // Determine if this seat should be rotated (top row faces opposite direction)
  const shouldRotate = (() => {
    if (playerCount === 2) {
      return seatNumber === 1; // Position 1 is top (rotated)
    } else if (playerCount === 3 || playerCount === 4) {
      return seatNumber <= 2; // Positions 1-2 are top row
    } else if (playerCount === 5 || playerCount === 6) {
      return seatNumber <= 3; // Positions 1-3 are top row
    }
    return false;
  })();

  // Build a map of player ID -> assigned seat number
  const playerToSeat = new Map<string, number>();
  assignedPlayers.forEach((slot) => {
    if (slot.playerId) {
      playerToSeat.set(slot.playerId, slot.position);
    }
  });

  return (
    <div className="smash-screen smash-slide-in">
      <div
        className="smash-screen-content"
        style={shouldRotate ? { transform: 'rotate(180deg)' } : undefined}
      >
        <SmashHeader
          seatNumber={seatNumber}
          title={`Player ${seatNumber}`}
          subtitle="Tap to Select"
          onBack={onBack}
          rightAction={hideGuestOption ? undefined : {
            label: '+ Guest',
            onClick: onGuestClick,
          }}
        />

        <div className="smash-player-grid">
          {availablePlayers.map((player, index) => {
            const assignedToSeat = player.id ? playerToSeat.get(player.id) : undefined;
            const isDisabled = !!assignedToSeat;

            return (
              <PlayerTile
                key={player.id}
                player={player}
                onSelect={onSelect}
                isDisabled={isDisabled}
                assignedToSeat={assignedToSeat}
                animationDelay={index * 30}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SmashPlayerSelect;
