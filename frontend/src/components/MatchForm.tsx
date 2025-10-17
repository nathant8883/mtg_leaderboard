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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Record New Match</h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Player Selection */}
          <div className="form-group">
            <label className="form-label">
              Select Players (3-6) - Selected: {selectedPlayerIds.length}/6
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                <div
                  key={player.id}
                  className={`player-chip ${selectedPlayerIds.includes(player.id!) ? 'selected' : ''}`}
                  onClick={() => togglePlayer(player.id!)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="player-avatar">{getPlayerAvatar(player.id!)}</div>
                  {player.name}
                </div>
              ))}
            </div>
            <div className="form-help">
              Click to select/deselect players
            </div>
          </div>

          {/* Deck Selection & Winner - Only show when 3+ players selected */}
          {selectedPlayerIds.length >= 3 && (
            <div className="form-group">
              <label className="form-label">Select Decks & Winner</label>
              {selectedPlayerIds.map((playerId) => {
                const playerDecks = getPlayerDecks(playerId);
                return (
                  <div key={playerId} className="player-deck-row" style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="player-avatar-large">{getPlayerAvatar(playerId)}</div>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{getPlayerName(playerId)}</span>
                      </div>
                      <button
                        type="button"
                        className={`winner-btn ${winnerId === playerId ? 'winner' : ''}`}
                        onClick={() => handleSetWinner(playerId)}
                      >
                        {winnerId === playerId ? '🏆 Winner' : 'Set Winner'}
                      </button>
                    </div>
                    <select
                      className="form-input"
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
            <div className="form-group">
              <label className="form-label" htmlFor="matchDate">
                Match Date
              </label>
              <input
                id="matchDate"
                type="date"
                className="form-input"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="button-group">
            <button
              type="button"
              className="secondary-btn"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`submit-btn ${isFormValid() && !isSubmitting ? 'enabled' : ''}`}
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
