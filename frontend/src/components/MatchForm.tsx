import { useState, type FormEvent } from 'react';
import type { Player, Deck, CreateMatchRequest } from '../services/api';

interface MatchFormProps {
  onSubmit: (match: CreateMatchRequest) => Promise<void>;
  onCancel: () => void;
  players: Player[];
  decks: Deck[];
}

function MatchForm({ onSubmit, onCancel, players, decks }: MatchFormProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerDeckMap, setPlayerDeckMap] = useState<Record<string, string>>({});
  const [winnerId, setWinnerId] = useState<string>('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const togglePlayer = (playerId: string) => {
    if (selectedPlayerIds.includes(playerId)) {
      // Deselect player
      setSelectedPlayerIds(selectedPlayerIds.filter(id => id !== playerId));
      // Remove their deck selection
      const newMap = { ...playerDeckMap };
      delete newMap[playerId];
      setPlayerDeckMap(newMap);
      // Clear winner if it was this player
      if (winnerId === playerId) {
        setWinnerId('');
      }
    } else if (selectedPlayerIds.length < 6) {
      // Select player (max 6)
      setSelectedPlayerIds([...selectedPlayerIds, playerId]);
    }
  };

  const handleDeckSelect = (playerId: string, deckId: string) => {
    setPlayerDeckMap({
      ...playerDeckMap,
      [playerId]: deckId,
    });
  };

  const handleSetWinner = (playerId: string) => {
    setWinnerId(playerId);
  };

  const getPlayerDecks = (playerId: string): Deck[] => {
    return decks.filter(deck => deck.player_id === playerId && !deck.disabled);
  };

  const getPlayerName = (playerId: string): string => {
    return players.find(p => p.id === playerId)?.name || '';
  };

  const getPlayerAvatar = (playerId: string): string => {
    const player = players.find(p => p.id === playerId);
    return player?.avatar || player?.name.charAt(0).toUpperCase() || '?';
  };

  const isFormValid = (): boolean => {
    // Need 3-6 players
    if (selectedPlayerIds.length < 3 || selectedPlayerIds.length > 6) return false;
    // All players need decks selected
    if (selectedPlayerIds.some(id => !playerDeckMap[id])) return false;
    // Winner must be selected
    if (!winnerId) return false;
    // Winner must be one of the selected players
    if (!selectedPlayerIds.includes(winnerId)) return false;
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isFormValid()) {
      setError('Please complete all required fields');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const playerDeckPairs = selectedPlayerIds.map(playerId => ({
        player_id: playerId,
        deck_id: playerDeckMap[playerId],
      }));

      const winnerDeckId = playerDeckMap[winnerId];

      await onSubmit({
        player_deck_pairs: playerDeckPairs,
        winner_player_id: winnerId,
        winner_deck_id: winnerDeckId,
        match_date: matchDate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record match');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start md:items-center justify-center z-[1000] p-3 md:p-6" onClick={onCancel}>
      <div className="bg-gradient-card rounded-[16px] md:rounded-[12px] p-0 md:p-8 w-full max-w-full md:max-w-[700px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] min-h-[calc(100vh-24px)] md:min-h-0 max-h-[calc(100vh-24px)] md:max-h-none flex flex-col md:block overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="mb-0 md:mb-6 flex items-center justify-between sticky md:static top-0 bg-gradient-card border-b border-[#2C2E33] md:border-b-0 p-4 px-5 md:p-0 z-10 flex-shrink-0">
          <h2 className="text-white m-0 text-xl md:text-2xl font-semibold flex-1">Record New Match</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto md:overflow-y-visible p-5 md:p-0 pb-10 md:pb-0 flex flex-col md:block">
          {/* Player Selection */}
          <div className="mb-5">
            <label className="text-[#C1C2C5] text-sm font-semibold block mb-2">
              Select Players (3-6) - Selected: {selectedPlayerIds.length}/6
            </label>
            <div className="flex gap-3 flex-wrap">
              {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                <div
                  key={player.id}
                  className={`py-2 px-4 rounded-[20px] border-2 cursor-pointer font-medium transition-all inline-flex items-center gap-2 ${
                    selectedPlayerIds.includes(player.id!)
                      ? 'bg-[#667eea] border-[#667eea] text-white'
                      : 'bg-[#25262B] border-[#2C2E33] text-[#909296]'
                  }`}
                  onClick={() => togglePlayer(player.id!)}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    selectedPlayerIds.includes(player.id!)
                      ? 'bg-white text-[#667eea]'
                      : 'bg-[#667eea] text-white'
                  }`}>
                    {getPlayerAvatar(player.id!)}
                  </div>
                  {player.name}
                </div>
              ))}
            </div>
            <div className="text-[#909296] text-xs mt-1">
              Click to select/deselect players
            </div>
          </div>

          {/* Deck Selection & Winner - Only show when 3+ players selected */}
          {selectedPlayerIds.length >= 3 && (
            <div className="mb-5">
              <label className="text-[#C1C2C5] text-sm font-semibold block mb-2">Select Decks & Winner</label>
              {selectedPlayerIds.map((playerId) => {
                const playerDecks = getPlayerDecks(playerId);
                return (
                  <div key={playerId} className="bg-[#25262B] rounded-[8px] p-4 border border-[#2C2E33] mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#667eea] text-white flex items-center justify-center text-sm font-semibold">
                          {getPlayerAvatar(playerId)}
                        </div>
                        <span className="text-white font-semibold">{getPlayerName(playerId)}</span>
                      </div>
                      <button
                        type="button"
                        className={`py-1.5 px-4 rounded-[6px] border-2 cursor-pointer font-semibold text-sm transition-all ${
                          winnerId === playerId
                            ? 'bg-gradient-winner border-transparent text-white'
                            : 'bg-transparent border-[#2C2E33] text-[#909296] hover:bg-[#25262B]'
                        }`}
                        onClick={() => handleSetWinner(playerId)}
                      >
                        {winnerId === playerId ? '🏆 Winner' : 'Set Winner'}
                      </button>
                    </div>
                    <select
                      className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
                      value={playerDeckMap[playerId] || ''}
                      onChange={(e) => handleDeckSelect(playerId, e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="">Select a deck...</option>
                      {playerDecks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name} ({deck.commander})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Match Date - Only show when 3+ players selected */}
          {selectedPlayerIds.length >= 3 && (
            <div className="mb-5">
              <label className="text-[#C1C2C5] text-sm font-semibold block mb-2" htmlFor="matchDate">
                Match Date
              </label>
              <input
                id="matchDate"
                type="date"
                className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          {error && (
            <div className="bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] p-3 rounded-[6px] text-sm mb-5">
              {error}
            </div>
          )}

          <div className="flex gap-2 md:gap-3 justify-end mt-auto md:mt-6 pt-5 md:pt-0 flex-shrink-0">
            <button
              type="button"
              className="py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] bg-transparent border border-[#2C2E33] text-[#C1C2C5] cursor-pointer font-medium text-sm transition-all hover:bg-[#25262B] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] border-none text-white font-semibold text-sm transition-all ${
                isFormValid() && !isSubmitting
                  ? 'bg-gradient-purple cursor-pointer opacity-100 hover:-translate-y-0.5'
                  : 'bg-[#2C2E33] cursor-not-allowed opacity-50'
              }`}
              disabled={!isFormValid() || isSubmitting}
            >
              {isSubmitting ? 'Recording...' : 'Submit Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MatchForm;
