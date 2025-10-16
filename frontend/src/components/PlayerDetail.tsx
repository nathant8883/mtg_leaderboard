import { useState, useEffect } from 'react';
import ColorPips from './ColorPips';
import DeckForm from './DeckForm';
import { useAuth } from '../contexts/AuthContext';
import { playerApi, deckApi, type PlayerDetail as PlayerDetailType, type Deck, type Player } from '../services/api';

interface PlayerDetailProps {
  playerId: string;
  onBack: () => void;
}

function PlayerDetail({ playerId, onBack }: PlayerDetailProps) {
  const { currentPlayer } = useAuth();
  const [playerDetail, setPlayerDetail] = useState<PlayerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeckForm, setShowDeckForm] = useState(false);

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentPlayer?.id === playerId;

  useEffect(() => {
    loadPlayerDetail();
  }, [playerId]);

  const loadPlayerDetail = async () => {
    try {
      setLoading(true);
      const data = await playerApi.getDetail(playerId);
      setPlayerDetail(data);
    } catch (err) {
      console.error('Error loading player detail:', err);
    } finally {
      setLoading(false);
    }
  };


  const formatMemberSince = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const handleCreateDeck = async (deck: Omit<Deck, 'id' | 'created_at' | 'player_id'>) => {
    try {
      // Don't pass player_id - backend will use authenticated user
      const { player_id, ...deckData } = deck as any;
      await deckApi.create(deckData);
      setShowDeckForm(false);
      // Reload player detail to show the new deck
      loadPlayerDetail();
    } catch (err) {
      console.error('Error creating deck:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="player-detail-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading player details...</p>
        </div>
      </div>
    );
  }

  if (!playerDetail) {
    return (
      <div className="player-detail-container">
        <div className="empty-state">
          <div className="empty-icon">❌</div>
          <h3>Player not found</h3>
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="player-detail-container">
      {/* Navigation Bar */}
      <div className="player-nav-bar">
        <div className="player-nav-content">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <span className="nav-title">
            Player Details • {playerDetail.player_name}
          </span>
        </div>
      </div>

      {/* Sidebar + Main Content Layout */}
      <div className="sidebar-layout">
        {/* Sidebar */}
        <div className="player-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-avatar">
              {playerDetail.avatar || playerDetail.player_name.charAt(0).toUpperCase()}
            </div>
            <h2 className="sidebar-name">{playerDetail.player_name}</h2>
            <div className="sidebar-rank">
              {playerDetail.rank ? `Rank #${playerDetail.rank}` : 'Unranked'} • Member since {formatMemberSince(playerDetail.member_since)}
            </div>

            <div className="sidebar-stats">
              <div className="sidebar-stat">
                <span className="sidebar-stat-label">Win Rate</span>
                <span className="sidebar-stat-value">{playerDetail.win_rate.toFixed(1)}%</span>
              </div>
              <div className="sidebar-stat">
                <span className="sidebar-stat-label">Total Games</span>
                <span className="sidebar-stat-value">{playerDetail.total_games}</span>
              </div>
              <div className="sidebar-stat">
                <span className="sidebar-stat-label">Wins</span>
                <span className="sidebar-stat-value">{playerDetail.wins}</span>
              </div>
              <div className="sidebar-stat">
                <span className="sidebar-stat-label">Losses</span>
                <span className="sidebar-stat-value">{playerDetail.losses}</span>
              </div>
              <div className="sidebar-stat">
                <span className="sidebar-stat-label">Active Decks</span>
                <span className="sidebar-stat-value">{playerDetail.active_decks}</span>
              </div>
              {playerDetail.favorite_single_color && (
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">Favorite Color</span>
                  <span className="sidebar-stat-value">
                    <ColorPips colors={[playerDetail.favorite_single_color]} />
                  </span>
                </div>
              )}
              {playerDetail.favorite_color_combo && playerDetail.favorite_color_combo.length > 0 && (
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">Favorite Identity</span>
                  <span className="sidebar-stat-value">
                    <ColorPips colors={playerDetail.favorite_color_combo} />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="player-main-content">
          <div className="content-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Decks</h2>
                <span className="deck-count">{playerDetail.decks.length} total decks</span>
              </div>
              {isOwnProfile && (
                <button className="section-action" onClick={() => setShowDeckForm(true)}>
                  + Add Deck
                </button>
              )}
            </div>

            {playerDetail.decks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🃏</div>
                <h3>No decks yet</h3>
                <p>Add a deck to get started!</p>
              </div>
            ) : (
              <div className="decks-grid">
                {playerDetail.decks.map((deck) => (
                  <div key={deck.deck_id} className="deck-card">
                    {deck.commander_image_url && (
                      <div className="deck-card-image">
                        <img
                          src={deck.commander_image_url}
                          alt={deck.commander}
                          className="deck-commander-image"
                        />
                      </div>
                    )}
                    <div className="deck-header">
                      <div>
                        <h3 className="deck-name">{deck.deck_name}</h3>
                        <div className="deck-commander">{deck.commander}</div>
                      </div>
                      <div className="deck-colors">
                        <ColorPips colors={deck.colors} />
                      </div>
                    </div>
                    <div className="deck-stats">
                      <div className="deck-stat">
                        <div className="deck-stat-value">{deck.games_played}</div>
                        <div className="deck-stat-label">Games</div>
                      </div>
                      <div className="deck-stat">
                        <div className="deck-stat-value">{deck.wins}</div>
                        <div className="deck-stat-label">Wins</div>
                      </div>
                      <div className="deck-stat">
                        <div className="deck-stat-value">{deck.win_rate.toFixed(0)}%</div>
                        <div className="deck-stat-label">Win Rate</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deck Form Modal */}
      {showDeckForm && playerDetail && (
        <DeckForm
          onSubmit={handleCreateDeck}
          onCancel={() => setShowDeckForm(false)}
          initialData={{
            name: '',
            player_id: playerId,
            commander: '',
            colors: [],
          } as Deck}
        />
      )}
    </div>
  );
}

export default PlayerDetail;
