import type { PlayerSlot, ActiveGameState } from '../../pages/MatchTracker';

interface WinnerScreenProps {
  players: PlayerSlot[];
  gameState?: ActiveGameState;
  winnerPosition?: number;
  onSave: () => void;
  onDiscard: () => void;
  onPlayAgain?: () => void;  // Optional — event matches don't have play again
  showAltWinToggle?: boolean;
  isAltWin?: boolean;
  onAltWinChange?: (value: boolean) => void;
  saving?: boolean;  // Disable save button while saving
  saveLabel?: string;  // Custom save button label (e.g., "Save & Complete")
}

function WinnerScreen({ players, gameState, winnerPosition, onSave, onDiscard, onPlayAgain, showAltWinToggle, isAltWin, onAltWinChange, saving, saveLabel }: WinnerScreenProps) {
  // Find winner by position
  const winner = winnerPosition
    ? players.find((p) => p.position === winnerPosition)
    : players.find((p) => gameState && !gameState.playerStates[p.position]?.eliminated);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center bg-gradient-to-br from-[rgba(102,126,234,0.1)] to-[rgba(20,21,23,1)] overflow-hidden m-0 p-4 box-border">
      {/* Left Side - Winner Info */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 h-full box-border">
        {winner && (
          <div className="bg-[#1A1B1E] border-[3px] border-[#FFD700] rounded-[16px] p-5 text-center shadow-[0_8px_32px_rgba(255,215,0,0.3)] min-w-[220px] flex flex-col items-center">
            <div className="text-[48px] mb-3 animate-[bounce_0.8s_ease-out] [filter:drop-shadow(0_4px_12px_rgba(255,215,0,0.5))]">🏆</div>
            {winner.commanderImageUrl ? (
              <img
                src={winner.commanderImageUrl}
                alt={winner.commanderName}
                className="w-[100px] h-[100px] rounded-[12px] object-cover object-[center_20%] mx-auto mb-4 shadow-[0_4px_16px_rgba(0,0,0,0.4)] border-[2px] border-[#FFD700]"
              />
            ) : (
              <div className="w-[100px] h-[100px] rounded-[12px] mx-auto mb-4 shadow-[0_4px_16px_rgba(0,0,0,0.4)] border-[2px] border-[#FFD700] bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[56px]">🎴</div>
            )}
            <div className="w-full">
              <div className="text-[28px] font-black mb-2 text-[#FFD700] leading-[1.2]">{winner.playerName}</div>
              <div className="text-[14px] text-[#909296] italic leading-[1.3]">{winner.deckName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Match Stats */}
      <div className="flex-1 flex flex-col justify-center p-4 bg-[rgba(26,27,30,0.5)] h-full box-border">
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex justify-between items-center py-2 px-3 bg-[#1A1B1E] rounded-[8px] border border-[#2C2E33]">
            <div className="text-[11px] text-[#909296] flex items-center gap-1">
              <span className="text-[14px]">⏱️</span>
              <span>Duration</span>
            </div>
            <div className="text-[18px] font-bold text-[#FFD700]">
              {gameState ? formatDuration(gameState.elapsedSeconds) : '0:00'}
            </div>
          </div>

          <div className="flex justify-between items-center py-2 px-3 bg-[#1A1B1E] rounded-[8px] border border-[#2C2E33]">
            <div className="text-[11px] text-[#909296] flex items-center gap-1">
              <span className="text-[14px]">👥</span>
              <span>Players</span>
            </div>
            <div className="text-[16px] font-bold text-[#667eea]">{players.length}</div>
          </div>
        </div>

        {/* Alt-Win Toggle (for tournament event matches) */}
        {showAltWinToggle && (
          <div className="flex justify-between items-center py-2 px-3 bg-[#1A1B1E] rounded-[8px] border border-[#2C2E33] mb-2">
            <div className="text-[11px] text-[#909296] flex items-center gap-1">
              <span className="text-[14px]">⚡</span>
              <span>Alternative Win</span>
            </div>
            <button
              className={`w-[48px] h-[26px] rounded-full transition-colors relative ${
                isAltWin ? 'bg-[#667eea]' : 'bg-[#2C2E33]'
              }`}
              onClick={() => onAltWinChange?.(!isAltWin)}
            >
              <div className={`w-[22px] h-[22px] rounded-full bg-white absolute top-[2px] transition-transform ${
                isAltWin ? 'translate-x-[24px]' : 'translate-x-[2px]'
              }`} />
            </button>
          </div>
        )}

        {/* Play Again - Primary Action (hidden for event matches) */}
        {onPlayAgain && (
          <button
            className="w-full py-[16px] px-4 border-none rounded-[12px] text-[16px] font-black cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap mb-3 bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-[#141517] shadow-[0_6px_20px_rgba(255,215,0,0.5)] hover:shadow-[0_8px_24px_rgba(255,215,0,0.7)] hover:scale-[1.02] active:scale-[0.98]"
            onClick={onPlayAgain}
          >
            <span className="text-[20px]">🔄</span>
            <span>Play Again</span>
          </button>
        )}

        <div className="flex gap-2">
          <button className="flex-1 py-[10px] px-3 border-none rounded-[8px] text-[12px] font-bold cursor-pointer transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap bg-[rgba(255,255,255,0.1)] text-white border border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.15)] active:scale-[0.98]" onClick={onDiscard} disabled={saving}>
            <span>✕</span>
            <span>Discard</span>
          </button>
          <button
            className={`flex-1 py-[10px] px-3 border-none rounded-[8px] text-[12px] font-bold cursor-pointer transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white shadow-[0_4px_12px_rgba(102,126,234,0.4)] hover:shadow-[0_6px_16px_rgba(102,126,234,0.6)] active:scale-[0.98] ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={onSave}
            disabled={saving}
          >
            <span>{saving ? '⏳' : '💾'}</span>
            <span>{saving ? 'Saving...' : (saveLabel || 'Save Match')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default WinnerScreen;
