import { useState, useEffect } from 'react';
import type { Player, Deck } from '../services/api';
import { playerApi, deckApi } from '../services/api';
import PlayerList from './PlayerList';
import PlayerForm from './PlayerForm';
import DeckList from './DeckList';
import DeckForm from './DeckForm';

type Tab = 'players' | 'decks';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [error, setError] = useState('');

  // Load players on mount
  useEffect(() => {
    loadPlayers();
    loadDecks();
  }, []);

  const loadPlayers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await playerApi.getAll();
      setPlayers(data);
    } catch (err) {
      setError('Failed to load players');
      console.error('Error loading players:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDecks = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await deckApi.getAll();
      setDecks(data);
    } catch (err) {
      setError('Failed to load decks');
      console.error('Error loading decks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlayer = async (playerData: Omit<Player, 'id' | 'created_at'>) => {
    try {
      await playerApi.create(playerData);
      setShowPlayerForm(false);
      await loadPlayers();
    } catch (err) {
      console.error('Error creating player:', err);
      throw new Error('Failed to create player');
    }
  };

  const handleUpdatePlayer = async (playerData: Omit<Player, 'id' | 'created_at'>) => {
    if (!editingPlayer?.id) return;

    try {
      await playerApi.update(editingPlayer.id, playerData);
      setEditingPlayer(null);
      setShowPlayerForm(false);
      await loadPlayers();
    } catch (err) {
      console.error('Error updating player:', err);
      throw new Error('Failed to update player');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    try {
      await playerApi.delete(playerId);
      await loadPlayers();
    } catch (err) {
      console.error('Error deleting player:', err);
      alert('Failed to delete player');
    }
  };

  const handleEditClick = (player: Player) => {
    setEditingPlayer(player);
    setShowPlayerForm(true);
  };

  const handleCloseForm = () => {
    setShowPlayerForm(false);
    setEditingPlayer(null);
  };

  const handleCreateDeck = async (deckData: Omit<Deck, 'id' | 'created_at'>) => {
    try {
      await deckApi.create(deckData);
      setShowDeckForm(false);
      await loadDecks();
    } catch (err) {
      console.error('Error creating deck:', err);
      throw new Error('Failed to create deck');
    }
  };

  const handleUpdateDeck = async (deckData: Omit<Deck, 'id' | 'created_at'>) => {
    if (!editingDeck?.id) return;

    try {
      await deckApi.update(editingDeck.id, deckData);
      setEditingDeck(null);
      setShowDeckForm(false);
      await loadDecks();
    } catch (err) {
      console.error('Error updating deck:', err);
      throw new Error('Failed to update deck');
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    try {
      await deckApi.delete(deckId);
      await loadDecks();
    } catch (err) {
      console.error('Error deleting deck:', err);
      alert('Failed to delete deck');
    }
  };

  const handleEditDeck = (deck: Deck) => {
    setEditingDeck(deck);
    setShowDeckForm(true);
  };

  const handleCloseDeckForm = () => {
    setShowDeckForm(false);
    setEditingDeck(null);
  };

  return (
    <div className="admin-panel">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Admin Panel</h2>
          <button
            className="primary-btn"
            onClick={() => activeTab === 'players' ? setShowPlayerForm(true) : setShowDeckForm(true)}
          >
            {activeTab === 'players' ? '➕ Add Player' : '➕ Add Deck'}
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => setActiveTab('players')}
          >
            👥 Players
          </button>
          <button
            className={`tab-btn ${activeTab === 'decks' ? 'active' : ''}`}
            onClick={() => setActiveTab('decks')}
          >
            🃏 Decks
          </button>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {activeTab === 'players' && (
          <PlayerList
            players={players}
            onEdit={handleEditClick}
            onDelete={handleDeletePlayer}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'decks' && (
          <DeckList
            decks={decks}
            players={players}
            onEdit={handleEditDeck}
            onDelete={handleDeleteDeck}
          />
        )}
      </div>

      {showPlayerForm && (
        <PlayerForm
          onSubmit={editingPlayer ? handleUpdatePlayer : handleCreatePlayer}
          onCancel={handleCloseForm}
          initialData={editingPlayer || undefined}
          isEdit={!!editingPlayer}
        />
      )}

      {showDeckForm && (
        <DeckForm
          onSubmit={editingDeck ? handleUpdateDeck : handleCreateDeck}
          onCancel={handleCloseDeckForm}
          players={players}
          initialData={editingDeck || undefined}
          isEdit={!!editingDeck}
          showPlayerSelector={true}
        />
      )}
    </div>
  );
}

export default AdminPanel;
