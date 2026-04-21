import { useState, useEffect } from 'react';
import { deckApi, playerApi, type Deck } from '../../../services/api';
import SmashHeader from './SmashHeader';
import DeckTile from './DeckTile';

interface BorrowDeckSelectProps {
  seatNumber: number;
  playerCount: number;
  currentPlayerId: string;
  assignedDeckIds: string[];
  onSelect: (deck: Deck, ownerId: string, ownerName: string) => void;
  onBack: () => void;
}

interface DeckGroup {
  playerId: string;
  playerName: string;
  avatar?: string | null;
  decks: Deck[];
}

function BorrowDeckSelect({
  seatNumber,
  playerCount,
  currentPlayerId,
  assignedDeckIds,
  onSelect,
  onBack,
}: BorrowDeckSelectProps) {
  const [deckGroups, setDeckGroups] = useState<DeckGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const shouldRotate = (() => {
    if (playerCount === 2) return seatNumber === 1;
    if (playerCount === 3 || playerCount === 4) return seatNumber <= 2;
    if (playerCount === 5 || playerCount === 6) return seatNumber <= 3;
    return false;
  })();

  useEffect(() => {
    loadDecks();
  }, [currentPlayerId]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const [allDecks, allPlayers] = await Promise.all([
        deckApi.getAll(),
        playerApi.getAll(),
      ]);

      const otherDecks = allDecks.filter(
        d => d.player_id !== currentPlayerId && !d.disabled
      );

      const playerMap = new Map(allPlayers.map(p => [p.id, p]));
      const grouped = new Map<string, DeckGroup>();

      for (const deck of otherDecks) {
        if (!grouped.has(deck.player_id)) {
          const owner = playerMap.get(deck.player_id);
          grouped.set(deck.player_id, {
            playerId: deck.player_id,
            playerName: owner?.name || 'Unknown',
            avatar: owner?.picture || owner?.custom_avatar || owner?.avatar,
            decks: [],
          });
        }
        grouped.get(deck.player_id)!.decks.push(deck);
      }

      setDeckGroups(Array.from(grouped.values()).sort((a, b) => a.playerName.localeCompare(b.playerName)));
    } catch (err) {
      console.error('[BorrowDeckSelect] Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (deck: Deck, group: DeckGroup) => {
    onSelect(deck, group.playerId, group.playerName);
  };

  return (
    <div className="smash-screen smash-slide-in">
      <div
        className="smash-screen-content"
        style={shouldRotate ? { transform: 'rotate(180deg)' } : undefined}
      >
        <SmashHeader
          seatNumber={seatNumber}
          title="Borrow a Deck"
          subtitle="Pick from another player"
          onBack={onBack}
        />

        <div className="smash-deck-grid-container" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="smash-loading">
              <div className="smash-loading-spinner" />
              <div className="smash-loading-text">Loading decks...</div>
            </div>
          ) : deckGroups.length === 0 ? (
            <div className="smash-empty">
              <div className="smash-empty-title">No decks available</div>
              <div className="smash-empty-subtitle">
                No other players have decks to borrow
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-3 flex-1 w-full">
              {deckGroups.map(group => (
                <div key={group.playerId}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <img
                      src={group.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${group.playerName}`}
                      alt={group.playerName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-white/70 text-sm font-medium">
                      {group.playerName}'s Decks
                    </span>
                  </div>
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(group.decks.length, 3)}, 1fr)`,
                    }}
                  >
                    {group.decks.map((deck, index) => {
                      const isAssigned = assignedDeckIds.includes(deck.id!);
                      return (
                        <div
                          key={deck.id}
                          className="smash-borrow-tile-wrap"
                          style={{ opacity: isAssigned ? 0.3 : 1, pointerEvents: isAssigned ? 'none' : 'auto' }}
                        >
                          <DeckTile
                            deck={deck}
                            onSelect={() => handleSelect(deck, group)}
                            animationDelay={index * 50}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BorrowDeckSelect;
