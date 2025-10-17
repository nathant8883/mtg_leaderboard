import { useState, useEffect } from 'react';
import { playerApi, type Player } from '../../services/api';
import type { PlayerSlot, LayoutType } from '../../pages/MatchTracker';
import DeckWheelSelector, { type DeckInfo } from './DeckWheelSelector';

interface PlayerAssignmentProps {
  playerCount: number;
  players: PlayerSlot[];
  layout: LayoutType;
  onComplete: (players: PlayerSlot[], layout: LayoutType) => void;
  onBack: () => void;
}

type ModalState =
  | { type: 'none' }
  | { type: 'player-select'; position: number }
  | { type: 'guest-name'; position: number }
  | { type: 'deck-select'; position: number; playerId: string; playerName: string };

function PlayerAssignment({ playerCount, players: initialPlayers, layout, onComplete, onBack }: PlayerAssignmentProps) {
  const [players, setPlayers] = useState<PlayerSlot[]>(initialPlayers);
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [guestName, setGuestName] = useState('');
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const data = await playerApi.getAll();
      setAvailablePlayers(data);
    } catch (err) {
      console.error('Error loading players:', err);
    }
  };

  const handleSlotClick = (position: number) => {
    setModalState({ type: 'player-select', position });
  };

  const handlePlayerSelect = (player: Player, position: number) => {
    // Show deck selector for regular players
    setModalState({
      type: 'deck-select',
      position,
      playerId: player.id!,
      playerName: player.name,
    });
  };

  const handleGuestTabClick = (position: number) => {
    setGuestName('');
    setModalState({ type: 'guest-name', position });
  };

  const handleGuestCreate = async (position: number) => {
    if (!guestName.trim()) return;

    try {
      setCreatingGuest(true);
      const guestPlayer = await playerApi.createGuest(guestName.trim());

      // Update slot with guest player (no deck)
      const updatedPlayers = [...players];
      updatedPlayers[position - 1] = {
        position,
        playerId: guestPlayer.id!,
        playerName: guestPlayer.name,
        deckId: null,
        deckName: 'Guest Deck',
        commanderName: 'Unknown Commander',
        commanderImageUrl: '',
        isGuest: true,
      };
      setPlayers(updatedPlayers);
      setModalState({ type: 'none' });
    } catch (err) {
      console.error('Error creating guest:', err);
      alert('Failed to create guest player');
    } finally {
      setCreatingGuest(false);
    }
  };

  const handleDeckSelect = (deckInfo: DeckInfo, position: number, playerId: string, playerName: string) => {
    const updatedPlayers = [...players];
    updatedPlayers[position - 1] = {
      position,
      playerId,
      playerName,
      deckId: deckInfo.deckId,
      deckName: deckInfo.deckName,
      commanderName: deckInfo.commander,
      commanderImageUrl: deckInfo.commanderImageUrl,
      isGuest: false,
    };
    setPlayers(updatedPlayers);
    setModalState({ type: 'none' });
  };

  const handleStartGame = () => {
    onComplete(players, layout);
  };

  const allSlotsFilled = players.every((p) => p.playerId !== null);

  return (
    <div className="player-assignment">
      {/* Centered Menu/GO Button */}
      <div className="floating-menu-btn-wrapper">
        <button
          className={`floating-menu-btn ${allSlotsFilled ? 'ready-to-start' : ''}`}
          onClick={() => allSlotsFilled ? handleStartGame() : setShowMenu(!showMenu)}
        >
          {allSlotsFilled ? <span className="go-text">GO</span> : '☰'}
        </button>
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <>
          <div className="menu-overlay" onClick={() => setShowMenu(false)} />
          <div className="floating-menu">
            <button
              className="menu-option"
              onClick={() => {
                setShowMenu(false);
                onBack();
              }}
            >
              ← Back to Setup
            </button>
            <button
              className="menu-option primary"
              onClick={() => {
                setShowMenu(false);
                handleStartGame();
              }}
              disabled={!allSlotsFilled}
            >
              Start Game
            </button>
          </div>
        </>
      )}

      {/* Player Slots in Game Layout */}
      <div className={`players-grid layout-${layout} players-${playerCount}`}>
        {players.map((slot) => (
          <div
            key={slot.position}
            className={`player-slot ${slot.playerId ? '' : 'empty'}`}
            onClick={() => handleSlotClick(slot.position)}
          >
            <div className="slot-content">
              {slot.playerId ? (
                <>
                  <div className="slot-player-name">{slot.playerName}</div>
                  <div className="slot-deck-name">{slot.deckName}</div>
                  {slot.isGuest && <div className="slot-guest-badge">Guest</div>}
                </>
              ) : (
                <>
                  <div className="slot-add-icon">+</div>
                  <div className="slot-label">Tap to add player</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Player Select Modal */}
      {modalState.type === 'player-select' && (
        <div className="modal-overlay" onClick={() => setModalState({ type: 'none' })}>
          <div className="modal-content player-select-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Select Player {modalState.position}</h2>
            <div className="player-select-grid">
              {availablePlayers.map((player) => (
                <button
                  key={player.id}
                  className="player-select-card"
                  onClick={() => handlePlayerSelect(player, modalState.position)}
                >
                  <div className="player-avatar-small">
                    {player.picture ? (
                      <img src={player.picture} alt={player.name} />
                    ) : (
                      player.avatar || player.name[0]
                    )}
                  </div>
                  <div className="player-select-name">{player.name}</div>
                </button>
              ))}
            </div>
            <button
              className="guest-tab-btn"
              onClick={() => handleGuestTabClick(modalState.position)}
            >
              + Add Guest Player
            </button>
            <button
              className="btn-secondary"
              onClick={() => setModalState({ type: 'none' })}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Guest Name Modal */}
      {modalState.type === 'guest-name' && (
        <div className="modal-overlay">
          <div className="modal-content guest-name-modal">
            <h2>Add Guest Player</h2>
            <p>Enter the guest player's name</p>
            <input
              type="text"
              className="guest-name-input"
              placeholder="Guest name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGuestCreate(modalState.position);
                }
              }}
            />
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setModalState({ type: 'player-select', position: modalState.position })}
              >
                Back
              </button>
              <button
                className="btn-primary"
                onClick={() => handleGuestCreate(modalState.position)}
                disabled={!guestName.trim() || creatingGuest}
              >
                {creatingGuest ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deck Selector Modal */}
      {modalState.type === 'deck-select' && (
        <DeckWheelSelector
          playerId={modalState.playerId}
          playerName={modalState.playerName}
          onSelect={(deckInfo) => handleDeckSelect(deckInfo, modalState.position, modalState.playerId, modalState.playerName)}
          onCancel={() => setModalState({ type: 'player-select', position: modalState.position })}
        />
      )}
    </div>
  );
}

export default PlayerAssignment;
