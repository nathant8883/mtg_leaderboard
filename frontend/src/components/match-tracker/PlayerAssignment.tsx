import { useState, useEffect } from 'react';
import { playerApi, type Player } from '../../services/api';
import type { PlayerSlot, LayoutType } from '../../pages/MatchTracker';
import DeckWheelSelector, { type DeckInfo } from './DeckWheelSelector';

interface PlayerAssignmentProps {
  playerCount: number;
  players: PlayerSlot[];
  layout: LayoutType;
  onComplete: (players: PlayerSlot[]) => void;
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
      console.log(`[PlayerAssignment] Loaded ${data.length} players`);
    } catch (err) {
      console.error('[PlayerAssignment] Error loading players:', err);
      // Don't show error toast - might just be offline and cache will handle it
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
    onComplete(players);
  };

  const allSlotsFilled = players.every((p) => p.playerId !== null);

  return (
    <div className="h-screen flex flex-col bg-[#141517] relative">
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
          <div className="fixed inset-0 bg-black/70 z-[250]" onClick={() => setShowMenu(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1b1e] border border-[#2c2e33] rounded-xl p-2 z-[300] min-w-[200px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <button
              className="w-full py-3 px-4 bg-transparent border-none rounded-lg text-white text-sm font-semibold cursor-pointer transition-all duration-200 text-left mb-1 hover:bg-white/10"
              onClick={() => {
                setShowMenu(false);
                onBack();
              }}
            >
              ← Back to Setup
            </button>
            <button
              className="w-full py-3 px-4 border-none rounded-lg text-white text-sm font-semibold cursor-pointer transition-all duration-200 text-center bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] hover:bg-[linear-gradient(135deg,#059669_0%,#047857_100%)] disabled:opacity-30 disabled:cursor-not-allowed"
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
            <div className="relative z-[2] text-center w-full">
              {slot.playerId ? (
                <>
                  <div className="text-[26px] font-extrabold mb-1 [text-shadow:0_2px_6px_rgba(0,0,0,0.4)]">{slot.playerName}</div>
                  <div className="text-[13px] opacity-85 [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">{slot.deckName}</div>
                  {slot.isGuest && <div className="inline-block py-1 px-2 bg-black/30 rounded-md text-[11px] mt-1">Guest</div>}
                </>
              ) : (
                <>
                  <div className="text-5xl mb-2 opacity-80">+</div>
                  <div className="text-sm opacity-90 font-semibold">Tap to add player</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Player Select Modal */}
      {modalState.type === 'player-select' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4" onClick={() => setModalState({ type: 'none' })}>
          <div className="bg-[#1a1b1e] border border-[#2c2e33] rounded-xl p-4 max-w-[600px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="my-0 mb-3 text-center text-lg font-semibold">Select Player {modalState.position}</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 mb-3 overflow-y-auto flex-1 min-h-0">
              {availablePlayers.map((player) => (
                <button
                  key={player.id}
                  className="relative flex flex-col items-center gap-1.5 py-3 px-2 bg-[#2c2e33] border-2 border-[#3c3e43] rounded-[10px] text-white cursor-pointer transition-all duration-200 min-h-0 hover:bg-[#3c3e43] hover:border-[#667eea] hover:-translate-y-0.5 active:translate-y-0"
                  onClick={() => handlePlayerSelect(player, modalState.position)}
                >
                  <div className="w-9 h-9 text-sm rounded-full bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] flex items-center justify-center font-semibold overflow-hidden shrink-0">
                    {player.picture ? (
                      <img src={player.picture} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                      player.avatar || player.name[0]
                    )}
                  </div>
                  <div className="text-center text-[13px] font-semibold leading-tight w-full">{player.name}</div>
                </button>
              ))}
            </div>
            <button
              className="w-full py-3 px-4 bg-[#2c2e33] border border-dashed border-[#667eea] rounded-lg text-[#667eea] text-sm font-semibold cursor-pointer transition-all duration-200 hover:bg-[#3c3e43]"
              onClick={() => handleGuestTabClick(modalState.position)}
            >
              + Add Guest Player
            </button>
            <button
              className="w-full py-3 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 bg-[#2c2e33] text-white border border-[#3c3e43] mt-2 hover:bg-[#3c3e43]"
              onClick={() => setModalState({ type: 'none' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Guest Name Modal */}
      {modalState.type === 'guest-name' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4">
          <div className="bg-[#1a1b1e] border border-[#2c2e33] rounded-xl p-6 max-w-[400px] w-full">
            <h2 className="text-xl font-semibold my-0 mb-4">Add Guest Player</h2>
            <p className="text-[#9ca3af] my-0 mb-4 text-sm">Enter the guest player's name</p>
            <input
              type="text"
              className="w-full py-3 px-4 bg-[#2c2e33] border border-[#3c3e43] rounded-lg text-white text-sm outline-none transition-[border-color] duration-200 placeholder:text-[#6b7280] focus:border-[#667eea]"
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
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 bg-[#2c2e33] text-white border border-[#3c3e43] hover:bg-[#3c3e43]"
                onClick={() => setModalState({ type: 'player-select', position: modalState.position })}
              >
                Back
              </button>
              <button
                className="flex-1 py-3 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)] hover:-translate-y-0.5 disabled:hover:-translate-y-0 disabled:hover:shadow-none"
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
