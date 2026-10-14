import { useState, useEffect } from 'react';
import { deckApi, playerApi, type Deck, type Player } from '../../../services/api';
import SmashHeader from './SmashHeader';
import DeckTile from './DeckTile';
import PlayerTile from './PlayerTile';
import { getGridLayout } from './SmashDeckSelect';

interface BorrowDeckSelectProps {
  seatNumber: number;
  playerCount: number;
  currentPlayerId: string;
  assignedDeckIds: string[];
  onSelect: (deck: Deck, ownerId: string, ownerName: string) => void;
  onBack: () => void;
}

interface DeckOwner {
  player: Player;
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
  const [owners, setOwners] = useState<DeckOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOwner, setSelectedOwner] = useState<DeckOwner | null>(null);

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

      const decksByOwner = new Map<string, Deck[]>();
      for (const deck of allDecks) {
        if (deck.player_id === currentPlayerId || deck.disabled) continue;
        if (!decksByOwner.has(deck.player_id)) decksByOwner.set(deck.player_id, []);
        decksByOwner.get(deck.player_id)!.push(deck);
      }

      const result: DeckOwner[] = allPlayers
        .filter(p => p.id && decksByOwner.has(p.id))
        .map(p => ({ player: p, decks: decksByOwner.get(p.id!)! }))
        .sort((a, b) => a.player.name.localeCompare(b.player.name));

      setOwners(result);
    } catch (err) {
      console.error('[BorrowDeckSelect] Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSelect = (player: Player) => {
    const owner = owners.find(o => o.player.id === player.id);
    if (owner) setSelectedOwner(owner);
  };

  const renderOwnerStep = () => (
    <>
      <SmashHeader
        seatNumber={seatNumber}
        title="Borrow a Deck"
        subtitle="Whose deck?"
        onBack={onBack}
      />

      {loading ? (
        <div className="smash-deck-grid-container">
          <div className="smash-loading">
            <div className="smash-loading-spinner" />
            <div className="smash-loading-text">Loading decks...</div>
          </div>
        </div>
      ) : owners.length === 0 ? (
        <div className="smash-deck-grid-container">
          <div className="smash-empty">
            <div className="smash-empty-title">No decks available</div>
            <div className="smash-empty-subtitle">
              No other players have decks to borrow
            </div>
          </div>
        </div>
      ) : (
        <div className="smash-player-grid">
          {owners.map((owner, index) => (
            <PlayerTile
              key={owner.player.id}
              player={owner.player}
              onSelect={handleOwnerSelect}
              animationDelay={index * 30}
            />
          ))}
        </div>
      )}
    </>
  );

  const renderDeckStep = (owner: DeckOwner) => {
    const gridLayout = getGridLayout(owner.decks.length);
    return (
      <>
        <SmashHeader
          seatNumber={seatNumber}
          title={`${owner.player.name}'s Decks`}
          subtitle="Choose Deck to Borrow"
          onBack={() => setSelectedOwner(null)}
        />

        <div className="smash-deck-grid-container">
          <div
            className="smash-deck-grid"
            style={{
              gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
              gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
            }}
          >
            {owner.decks.map((deck, index) => {
              const isAssigned = assignedDeckIds.includes(deck.id!);
              return (
                <div
                  key={deck.id}
                  className="smash-borrow-tile-wrap"
                  style={{ opacity: isAssigned ? 0.3 : 1, pointerEvents: isAssigned ? 'none' : 'auto' }}
                >
                  <DeckTile
                    deck={deck}
                    onSelect={() => onSelect(deck, owner.player.id!, owner.player.name)}
                    animationDelay={index * 50}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="smash-screen smash-slide-in">
      <div
        className="smash-screen-content"
        style={shouldRotate ? { transform: 'rotate(180deg)' } : undefined}
      >
        {/* Slide-in lives on an inner wrapper: its transform keyframes would
            otherwise override the rotation above */}
        <div
          key={selectedOwner ? selectedOwner.player.id : 'owners'}
          className="smash-screen-content smash-slide-in"
        >
          {selectedOwner ? renderDeckStep(selectedOwner) : renderOwnerStep()}
        </div>
      </div>
    </div>
  );
}

export default BorrowDeckSelect;
