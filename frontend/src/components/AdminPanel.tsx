import { useState, useEffect } from 'react';
import type { Player, Deck, Match, CreateMatchRequest, Pod } from '../services/api';
import { playerApi, deckApi, matchApi, podApi } from '../services/api';
import PlayerList from './PlayerList';
import PlayerForm from './PlayerForm';
import DeckList from './DeckList';
import DeckForm from './DeckForm';
import MatchList from './MatchList';
import MatchForm from './MatchForm';
import EditMatchForm from './EditMatchForm';
import PodsList from './PodsList';
import { CreatePodModal } from './CreatePodModal';

type Tab = 'players' | 'decks' | 'matches' | 'pods';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showPodForm, setShowPodForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [error, setError] = useState('');

  // Load data on mount
  useEffect(() => {
    loadPlayers();
    loadDecks();
    loadMatches();
    loadPods();
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

  const loadMatches = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await matchApi.getAll(100); // Load up to 100 matches
      setMatches(data);
    } catch (err) {
      setError('Failed to load matches');
      console.error('Error loading matches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPods = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await podApi.getAll();
      setPods(data);
    } catch (err) {
      setError('Failed to load pods');
      console.error('Error loading pods:', err);
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

  const handleCreateMatch = async (matchData: CreateMatchRequest) => {
    try {
      await matchApi.create(matchData);
      setShowMatchForm(false);
      await loadMatches();
    } catch (err) {
      console.error('Error creating match:', err);
      throw new Error('Failed to create match');
    }
  };

  const handleUpdateMatch = async (matchData: Partial<CreateMatchRequest>) => {
    if (!editingMatch?.id) return;

    try {
      await matchApi.update(editingMatch.id, matchData);
      setEditingMatch(null);
      setShowMatchForm(false);
      await loadMatches();
    } catch (err) {
      console.error('Error updating match:', err);
      throw new Error('Failed to update match');
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    try {
      await matchApi.delete(matchId);
      await loadMatches();
    } catch (err) {
      console.error('Error deleting match:', err);
      alert('Failed to delete match');
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setShowMatchForm(true);
  };

  const handleCloseMatchForm = () => {
    setShowMatchForm(false);
    setEditingMatch(null);
  };

  const handleCreatePod = async (name: string, description?: string) => {
    try {
      await podApi.create(name, description);
      setShowPodForm(false);
      await loadPods();
    } catch (err) {
      console.error('Error creating pod:', err);
      throw err;
    }
  };

  const handleEditPod = (pod: Pod) => {
    setEditingPod(pod);
    setShowPodForm(true);
  };

  const handleUpdatePod = async (name: string, description?: string) => {
    if (!editingPod?.id) return;
    try {
      await podApi.update(editingPod.id, name, description);
      setEditingPod(null);
      setShowPodForm(false);
      await loadPods();
    } catch (err) {
      console.error('Error updating pod:', err);
      throw err;
    }
  };

  const handleDeletePod = async (podId: string) => {
    try {
      await podApi.delete(podId);
      await loadPods();
    } catch (err) {
      console.error('Error deleting pod:', err);
      alert('Failed to delete pod');
    }
  };

  const handleClosePodForm = () => {
    setShowPodForm(false);
    setEditingPod(null);
  };

  return (
    <div className="w-full">
      <div className="bg-gradient-card rounded-[12px] p-6 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white m-0 text-2xl font-semibold">Admin Panel</h2>
          <button
            className="bg-gradient-purple text-white border-none py-3 px-6 rounded-[8px] text-sm font-semibold cursor-pointer shadow-primary transition-all primary-btn-hover"
            onClick={() => {
              if (activeTab === 'players') setShowPlayerForm(true);
              else if (activeTab === 'decks') setShowDeckForm(true);
              else if (activeTab === 'matches') setShowMatchForm(true);
              else if (activeTab === 'pods') setShowPodForm(true);
            }}
          >
            {activeTab === 'players' ? '➕ Add Player' :
             activeTab === 'decks' ? '➕ Add Deck' :
             activeTab === 'matches' ? '➕ Add Match' :
             '➕ Add Pod'}
          </button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-[#2C2E33] pb-0">
          <button
            className={`py-3 px-6 bg-transparent border-none border-b-2 cursor-pointer font-semibold text-sm transition-all ${
              activeTab === 'players'
                ? 'border-b-[#667eea] text-[#667eea]'
                : 'border-transparent text-[#909296]'
            }`}
            onClick={() => setActiveTab('players')}
          >
            👥 Players
          </button>
          <button
            className={`py-3 px-6 bg-transparent border-none border-b-2 cursor-pointer font-semibold text-sm transition-all ${
              activeTab === 'decks'
                ? 'border-b-[#667eea] text-[#667eea]'
                : 'border-transparent text-[#909296]'
            }`}
            onClick={() => setActiveTab('decks')}
          >
            🃏 Decks
          </button>
          <button
            className={`py-3 px-6 bg-transparent border-none border-b-2 cursor-pointer font-semibold text-sm transition-all ${
              activeTab === 'matches'
                ? 'border-b-[#667eea] text-[#667eea]'
                : 'border-transparent text-[#909296]'
            }`}
            onClick={() => setActiveTab('matches')}
          >
            🎮 Matches
          </button>
          <button
            className={`py-3 px-6 bg-transparent border-none border-b-2 cursor-pointer font-semibold text-sm transition-all ${
              activeTab === 'pods'
                ? 'border-b-[#667eea] text-[#667eea]'
                : 'border-transparent text-[#909296]'
            }`}
            onClick={() => setActiveTab('pods')}
          >
            🏠 Pods
          </button>
        </div>

        {error && (
          <div className="bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] py-3 px-4 rounded-[6px] mb-5 text-sm">
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

        {activeTab === 'matches' && (
          <MatchList
            matches={matches}
            onEdit={handleEditMatch}
            onDelete={handleDeleteMatch}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'pods' && (
          <PodsList
            pods={pods}
            onEdit={handleEditPod}
            onDelete={handleDeletePod}
            isLoading={isLoading}
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

      {showMatchForm && !editingMatch && (
        <MatchForm
          onSubmit={handleCreateMatch}
          onCancel={handleCloseMatchForm}
          players={players}
          decks={decks}
        />
      )}

      {showMatchForm && editingMatch && (
        <EditMatchForm
          onSubmit={handleUpdateMatch}
          onCancel={handleCloseMatchForm}
          players={players}
          decks={decks}
          initialData={editingMatch}
        />
      )}

      {showPodForm && (
        <CreatePodModal
          onClose={handleClosePodForm}
          onSubmit={editingPod ? handleUpdatePod : handleCreatePod}
          initialData={editingPod || undefined}
        />
      )}
    </div>
  );
}

export default AdminPanel;
