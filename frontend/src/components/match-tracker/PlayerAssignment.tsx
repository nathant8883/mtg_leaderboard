import { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { playerApi, deckApi, type Player, type Deck } from '../../services/api';
import type { PlayerSlot, LayoutType } from '../../pages/MatchTracker';
import { SmashPlayerSelect, SmashDeckSelect } from './smash-select';

interface PlayerAssignmentProps {
  playerCount: number;
  players: PlayerSlot[];
  layout: LayoutType;
  onComplete: (players: PlayerSlot[]) => void;
  onBack: () => void;
  allowedPlayerIds?: string[];
  hideGuestOption?: boolean;
  onDeckSelected?: (playerId: string, deckId: string) => void;
}

// Selection flow state machine
type SelectionPhase =
  | { type: 'grid' }
  | { type: 'player-select'; position: number }
  | { type: 'guest-name'; position: number }
  | { type: 'deck-select'; position: number; playerId: string; playerName: string; killMessages?: string[] };

function PlayerAssignment({ playerCount, players: initialPlayers, layout, onComplete, onBack, allowedPlayerIds, hideGuestOption, onDeckSelected }: PlayerAssignmentProps) {
  const [players, setPlayers] = useState<PlayerSlot[]>(initialPlayers);
  const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>({ type: 'grid' });
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [guestName, setGuestName] = useState('');
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [menuState, setMenuState] = useState<'closed' | 'spinning' | 'open' | 'closing'>('closed');

  // Handle menu button click with spin animation
  const handleMenuButtonClick = () => {
    if (menuState === 'closed') {
      setMenuState('spinning');
      setTimeout(() => setMenuState('open'), 350);
    } else if (menuState === 'open') {
      setMenuState('closing');
      setTimeout(() => setMenuState('closed'), 250);
    }
  };

  // Helper to close menu
  const closeMenu = () => {
    setMenuState('closing');
    setTimeout(() => setMenuState('closed'), 250);
  };

  // Helper function to get rotation for a position based on player count
  const getRotationForPosition = (position: number): number => {
    if (playerCount === 2) {
      // 2 players: position 1 is rotated 180° (top), position 2 is normal (bottom)
      return position === 1 ? 180 : 0;
    } else if (playerCount === 3 || playerCount === 4) {
      // 3-4 players: positions 1-2 are rotated 180°
      return position <= 2 ? 180 : 0;
    } else if (playerCount === 5 || playerCount === 6) {
      // 5-6 players: positions 1-3 are rotated 180°
      return position <= 3 ? 180 : 0;
    }
    return 0;
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const data = await playerApi.getAll();
      const filtered = allowedPlayerIds
        ? data.filter(p => p.id && allowedPlayerIds.includes(p.id))
        : data;
      setAvailablePlayers(filtered);
      console.log(`[PlayerAssignment] Loaded ${filtered.length} players${allowedPlayerIds ? ` (filtered from ${data.length})` : ''}`);

      // Preload commander images for faster deck selection
      const allDecks = await deckApi.getAll();
      const imageUrls = allDecks
        .map((d) => d.commander_image_url)
        .filter(Boolean) as string[];
      preloadImages(imageUrls);
    } catch (err) {
      console.error('[PlayerAssignment] Error loading players:', err);
    }
  };

  // Preload images in the background
  const preloadImages = (urls: string[]) => {
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  };

  const handleSlotClick = (position: number) => {
    // Check if slot is disabled (filled slots count reached playerCount)
    const filledCount = players.filter(p => p.playerId !== null).length;
    const slot = players[position - 1];

    // If this slot is empty and we've already filled the required number of players, don't allow selection
    if (!slot.playerId && filledCount >= playerCount) {
      return; // Slot is disabled
    }

    setSelectionPhase({ type: 'player-select', position });
  };

  const handlePlayerSelect = (player: Player) => {
    if (selectionPhase.type !== 'player-select') return;

    // Show deck selector for regular players
    setSelectionPhase({
      type: 'deck-select',
      position: selectionPhase.position,
      playerId: player.id!,
      playerName: player.name,
      killMessages: player.kill_messages,
    });
  };

  const handleGuestClick = () => {
    if (selectionPhase.type !== 'player-select') return;
    setGuestName('');
    setSelectionPhase({ type: 'guest-name', position: selectionPhase.position });
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
      setSelectionPhase({ type: 'grid' });
    } catch (err) {
      console.error('Error creating guest:', err);
      alert('Failed to create guest player');
    } finally {
      setCreatingGuest(false);
    }
  };

  const handleDeckSelect = (deck: Deck) => {
    if (selectionPhase.type !== 'deck-select') return;

    const { position, playerId, playerName, killMessages } = selectionPhase;
    const updatedPlayers = [...players];
    updatedPlayers[position - 1] = {
      position,
      playerId,
      playerName,
      deckId: deck.id!,
      deckName: deck.name,
      commanderName: deck.commander,
      commanderImageUrl: deck.commander_image_url || '',
      isGuest: false,
      killMessages,
    };
    setPlayers(updatedPlayers);
    setSelectionPhase({ type: 'grid' });
    if (onDeckSelected && playerId && deck.id) {
      onDeckSelected(playerId, deck.id);
    }
  };

  const handleStartGame = () => {
    onComplete(players);
  };

  const allSlotsFilled = players.filter(p => p.playerId !== null).length >= playerCount;

  return (
    <div className="h-screen flex flex-col bg-[#141517] relative">
      {/* Menu Backdrop */}
      {(menuState === 'open' || menuState === 'closing') && (
        <div
          className="radial-menu-backdrop"
          onClick={closeMenu}
        />
      )}

      {/* Radial Pill Menu */}
      <div className={`radial-menu ${menuState === 'open' ? 'open' : ''} ${menuState === 'closing' ? 'closing' : ''}`}>
        {/* Back - Top */}
        <button
          className="radial-pill"
          onClick={() => {
            closeMenu();
            onBack();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Centered Menu/GO Button */}
      <div className="floating-menu-btn-wrapper">
        <button
          className={`floating-menu-btn ${allSlotsFilled ? 'ready-to-start' : ''} ${menuState === 'spinning' ? 'spinning' : ''} ${menuState === 'open' || menuState === 'closing' ? 'menu-open' : ''}`}
          onClick={() => allSlotsFilled ? handleStartGame() : handleMenuButtonClick()}
        >
          {allSlotsFilled ? (
            <span className="go-text">GO</span>
          ) : (
            <>
              <img src="/logo.png" alt="" className="menu-logo" />
              <X className="w-8 h-8 menu-close-icon" />
            </>
          )}
        </button>
      </div>

      {/* Player Slots in Game Layout */}
      <div className={`players-grid layout-${layout} players-${playerCount}`}>
        {players.map((slot) => {
          const filledCount = players.filter(p => p.playerId !== null).length;
          const isDisabled = !slot.playerId && filledCount >= playerCount;

          // Determine if this slot should be rotated (top row)
          // For 2 players: position 1 is top (rotated), position 2 is bottom
          // For 3 players with 4 slots: positions 1, 2 are top row (rotated)
          // For 5 players with 6 slots: positions 1, 2, 3 are top row (rotated)
          const slotsPerRow = playerCount === 2 ? 1 : playerCount <= 4 ? 2 : 3;
          const isTopRow = slot.position <= slotsPerRow;

          return (
            <div
              key={slot.position}
              className={`player-slot ${slot.playerId ? '' : 'empty'} ${isDisabled ? 'disabled' : ''}`}
              style={isTopRow ? { transform: 'rotate(180deg)' } : undefined}
              onClick={() => handleSlotClick(slot.position)}
            >
              <div
                className="relative z-[2] text-center w-full"
                style={isTopRow ? { transform: 'rotate(180deg)' } : undefined}
              >
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
          );
        })}
      </div>

      {/* Smash Player Selection Screen */}
      {selectionPhase.type === 'player-select' && (
        <SmashPlayerSelect
          seatNumber={selectionPhase.position}
          playerCount={playerCount}
          availablePlayers={availablePlayers}
          assignedPlayers={players}
          onSelect={handlePlayerSelect}
          onGuestClick={handleGuestClick}
          onBack={() => setSelectionPhase({ type: 'grid' })}
          hideGuestOption={hideGuestOption}
        />
      )}

      {/* Smash Deck Selection Screen */}
      {selectionPhase.type === 'deck-select' && (
        <SmashDeckSelect
          seatNumber={selectionPhase.position}
          playerCount={playerCount}
          playerId={selectionPhase.playerId}
          playerName={selectionPhase.playerName}
          onSelect={handleDeckSelect}
          onBack={() => setSelectionPhase({ type: 'player-select', position: selectionPhase.position })}
        />
      )}

      {/* Guest Name Modal (kept as modal for simple text input) */}
      {selectionPhase.type === 'guest-name' && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4"
          style={{ transform: `rotate(${getRotationForPosition(selectionPhase.position)}deg)` }}
        >
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
                  handleGuestCreate(selectionPhase.position);
                }
              }}
            />
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 bg-[#2c2e33] text-white border border-[#3c3e43] hover:bg-[#3c3e43]"
                onClick={() => setSelectionPhase({ type: 'player-select', position: selectionPhase.position })}
              >
                Back
              </button>
              <button
                className="flex-1 py-3 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)] hover:-translate-y-0.5 disabled:hover:-translate-y-0 disabled:hover:shadow-none"
                onClick={() => handleGuestCreate(selectionPhase.position)}
                disabled={!guestName.trim() || creatingGuest}
              >
                {creatingGuest ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerAssignment;
