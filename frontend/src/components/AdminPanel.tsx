import { useState, useEffect } from 'react';
import type { Player } from '../services/api';
import { playerApi } from '../services/api';
import PlayerList from './PlayerList';
import PlayerForm from './PlayerForm';

type Tab = 'players' | 'decks';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [error, setError] = useState('');

  // Load players on mount
  useEffect(() => {
    loadPlayers();
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

  return (
    <div className="admin-panel">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Admin Panel</h2>
          <button
            className="primary-btn"
            onClick={() => setShowPlayerForm(true)}
            disabled={activeTab !== 'players'}
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
          <div className="empty-state">
            <div className="empty-icon">🃏</div>
            <h3>Deck Management</h3>
            <p>Deck management coming soon!</p>
          </div>
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
    </div>
  );
}

export default AdminPanel;
