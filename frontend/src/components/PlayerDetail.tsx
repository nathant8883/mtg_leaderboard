import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ColorPips from './ColorPips';
import DeckForm from './DeckForm';
import ProfileEditModal from './ProfileEditModal';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { playerApi, deckApi, analyticsApi, type PlayerDetail as PlayerDetailType, type Deck, type PlayerDeckStats, type KingmakerData } from '../services/api';
import PlayerAvatar from './PlayerAvatar';

function PlayerDetail() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { currentPlayer, isGuest, refreshPlayer } = useAuth();
  const { currentPod, loading: podLoading } = usePod();
  const [playerDetail, setPlayerDetail] = useState<PlayerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [openMenuDeckId, setOpenMenuDeckId] = useState<string | null>(null);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [kingmakerData, setKingmakerData] = useState<KingmakerData | null>(null);
  const [kingmakerLoading, setKingmakerLoading] = useState(false);

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentPlayer?.id === playerId;

  // Redirect to dashboard if authenticated but no pod
  useEffect(() => {
    if (!isGuest && currentPlayer && !currentPod && !podLoading) {
      navigate('/');
    }
  }, [isGuest, currentPlayer, currentPod, podLoading, navigate]);

  useEffect(() => {
    if (playerId) {
      loadPlayerDetail();
    }

    // Listen for pod switch events to refresh player stats
    const handlePodSwitch = () => {
      if (playerId) {
        loadPlayerDetail();
      }
    };

    window.addEventListener('podSwitched', handlePodSwitch);
    return () => {
      window.removeEventListener('podSwitched', handlePodSwitch);
    };
  }, [playerId]);

  // Load kingmaker data
  useEffect(() => {
    const loadKingmakerData = async () => {
      if (!playerId || !currentPod) return;
      try {
        setKingmakerLoading(true);
        const data = await analyticsApi.getKingmaker(playerId);
        setKingmakerData(data);
      } catch (err) {
        console.error('Error loading kingmaker data:', err);
        setKingmakerData(null);
      } finally {
        setKingmakerLoading(false);
      }
    };

    loadKingmakerData();
  }, [playerId, currentPod]);

  const loadPlayerDetail = async () => {
    if (!playerId) return;
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

  const handleEditDeck = async (deck: Omit<Deck, 'id' | 'created_at' | 'player_id'>) => {
    if (!editingDeck?.id) return;
    try {
      await deckApi.update(editingDeck.id, deck);
      setEditingDeck(null);
      setShowDeckForm(false);
      loadPlayerDetail();
    } catch (err) {
      console.error('Error updating deck:', err);
      throw err;
    }
  };

  const handleOpenEditDeck = (deckStats: PlayerDeckStats) => {
    if (!playerId) return; // Guard: playerId should always be defined here

    // Convert PlayerDeckStats to Deck format
    const deck: Deck = {
      id: deckStats.deck_id,
      name: deckStats.deck_name,
      player_id: playerId,
      commander: deckStats.commander,
      commander_image_url: deckStats.commander_image_url,
      colors: deckStats.colors,
      disabled: deckStats.disabled,
    };
    setEditingDeck(deck);
    setShowDeckForm(true);
    setOpenMenuDeckId(null);
  };

  const handleToggleDisabled = async (deckId: string, currentDisabled: boolean) => {
    try {
      const deck = playerDetail?.decks.find(d => d.deck_id === deckId);
      if (!deck) return;

      await deckApi.update(deckId, {
        name: deck.deck_name,
        commander: deck.commander,
        commander_image_url: deck.commander_image_url,
        colors: deck.colors,
        disabled: !currentDisabled,
      } as Partial<Deck>);

      setOpenMenuDeckId(null);
      loadPlayerDetail();
    } catch (err) {
      console.error('Error toggling deck disabled status:', err);
      alert('Failed to update deck status');
    }
  };

  const handleProfileUpdateSuccess = async () => {
    // Refresh the current player data in AuthContext
    await refreshPlayer();
    // Reload the player detail page to show updated name/avatar
    await loadPlayerDetail();
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen">
        <div className="text-center py-[60px] px-5">
          <div className="loading-spinner"></div>
          <p className="text-[#909296] text-sm">Loading player details...</p>
        </div>
      </div>
    );
  }

  if (!playerDetail) {
    return (
      <div className="w-full min-h-screen">
        <div className="text-center py-[60px] px-5">
          <div className="text-[64px] mb-4">❌</div>
          <h3 className="text-white text-xl mb-2">Player not found</h3>
          <button
            className="bg-transparent border border-[#2C2E33] text-[#909296] py-2 px-4 rounded-[6px] cursor-pointer text-sm transition-all font-medium hover:border-[#667eea] hover:text-[#667eea]"
            onClick={() => navigate('/')}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
      {/* Sidebar + Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4 md:gap-6 max-w-[1400px] mx-auto px-0 md:px-6 pb-20 md:pb-10 pt-3 md:pt-6">
        {/* Sidebar */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-3 md:p-8 mb-4 md:mb-5">
            {/* Avatar - prioritize custom_avatar, then picture, then avatar letter */}
            <div className="w-[120px] h-[120px] rounded-full bg-gradient-purple flex items-center justify-center text-[48px] font-bold mx-auto mb-5 border-4 border-[#2C2E33] text-white overflow-hidden">
              {playerDetail.custom_avatar ? (
                <img src={playerDetail.custom_avatar} alt={playerDetail.player_name} className="w-full h-full object-cover" />
              ) : playerDetail.picture ? (
                <img src={playerDetail.picture} alt={playerDetail.player_name} className="w-full h-full object-cover" />
              ) : (
                playerDetail.avatar || playerDetail.player_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-center text-[28px] font-bold text-white">{playerDetail.player_name}</h2>
              {isOwnProfile && (
                <button
                  onClick={() => setShowProfileEditModal(true)}
                  className="p-1.5 bg-transparent border-none text-[#909296] cursor-pointer transition-all hover:text-[#667eea] active:scale-95"
                  title="Edit Profile"
                  aria-label="Edit Profile"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="text-center text-[#909296] text-sm mb-5">
              {playerDetail.rank ? `Rank #${playerDetail.rank}` : 'Unranked'} • Member since {formatMemberSince(playerDetail.member_since)}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                <span className="text-[#909296] text-[13px]">Win Rate</span>
                <span className="text-lg font-bold text-[#667eea]">{playerDetail.win_rate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                <span className="text-[#909296] text-[13px]">Total Games</span>
                <span className="text-lg font-bold text-[#667eea]">{playerDetail.total_games}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                <span className="text-[#909296] text-[13px]">Wins</span>
                <span className="text-lg font-bold text-[#667eea]">{playerDetail.wins}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                <span className="text-[#909296] text-[13px]">Losses</span>
                <span className="text-lg font-bold text-[#667eea]">{playerDetail.losses}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                <span className="text-[#909296] text-[13px]">Active Decks</span>
                <span className="text-lg font-bold text-[#667eea]">{playerDetail.active_decks}</span>
              </div>
              {playerDetail.favorite_single_color && (
                <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                  <span className="text-[#909296] text-[13px]">Favorite Color</span>
                  <span className="text-lg font-bold text-[#667eea]">
                    <ColorPips colors={[playerDetail.favorite_single_color]} />
                  </span>
                </div>
              )}
              {playerDetail.favorite_color_combo && playerDetail.favorite_color_combo.length > 0 && (
                <div className="flex justify-between items-center p-3 bg-[#25262B] rounded-[8px]">
                  <span className="text-[#909296] text-[13px]">Favorite Identity</span>
                  <span className="text-lg font-bold text-[#667eea]">
                    <ColorPips colors={playerDetail.favorite_color_combo} />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Kingmaker Section */}
          {kingmakerLoading ? (
            <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-3 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">👑</span>
                <h3 className="text-lg font-semibold text-white">Player Dynamics</h3>
              </div>
              <div className="text-center py-4">
                <div className="loading-spinner"></div>
                <p className="text-[#909296] text-sm mt-2">Loading dynamics...</p>
              </div>
            </div>
          ) : kingmakerData && kingmakerData.kingmaker_for.length > 0 ? (
            <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-3 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">👑</span>
                <h3 className="text-lg font-semibold text-white">Player Dynamics</h3>
              </div>
              <p className="text-[#909296] text-xs mb-4">
                When {playerDetail.player_name} plays, these players win more often:
              </p>
              <div className="flex flex-col gap-3">
                {kingmakerData.kingmaker_for.map((relationship) => (
                  <div
                    key={relationship.player_id}
                    className="flex items-center gap-3 p-3 bg-[#25262B] rounded-[8px]"
                  >
                    <PlayerAvatar
                      playerName={relationship.player_name}
                      customAvatar={relationship.custom_avatar}
                      picture={relationship.picture}
                      size="small"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {relationship.player_name}
                      </div>
                      <div className="text-[#909296] text-xs">
                        {relationship.games_together} games together
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#33D9B2] font-bold text-sm">
                        +{relationship.lift_percentage.toFixed(0)}%
                      </div>
                      <div className="text-[#909296] text-[10px]">
                        win rate lift
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#2C2E33]">
                <p className="text-[#666] text-[10px] text-center">
                  Based on {kingmakerData.analyzed_games} games analyzed
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Main Content */}
        <div>
          <div className="bg-gradient-card border border-[#2C2E33] rounded-[16px] p-2 md:p-8 mb-4 md:mb-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Decks</h2>
                <span className="text-[#909296] text-sm block mt-1">{playerDetail.decks.length} total decks</span>
              </div>
              {isOwnProfile && (
                <button
                  className="py-2 px-4 bg-[#667eea] text-white border-none rounded-[6px] text-[13px] font-semibold cursor-pointer transition-all hover:bg-[#5568d3]"
                  onClick={() => setShowDeckForm(true)}
                >
                  + Add Deck
                </button>
              )}
            </div>

            {playerDetail.decks.length === 0 ? (
              <div className="text-center py-[60px] px-5">
                <div className="text-[64px] mb-4">🃏</div>
                <h3 className="text-white text-xl mb-2">No decks yet</h3>
                <p className="text-[#909296] text-sm">Add a deck to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-5">
                {playerDetail.decks.map((deck) => (
                  <div
                    key={deck.deck_id}
                    className={`bg-[#25262B] border border-[#2C2E33] rounded-[12px] overflow-hidden transition-all duration-300 cursor-pointer relative flex-col md:flex-col flex md:block ${
                      deck.disabled
                        ? 'opacity-50 grayscale-[70%] cursor-default hover:transform-none hover:border-[#2C2E33]'
                        : 'hover:border-[#667eea] md:hover:-translate-y-[4px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]'
                    }`}
                  >
                    {/* Mobile Layout: Compact with top image */}
                    <div className="md:hidden relative">
                      {deck.disabled && (
                        <div className="absolute top-2 left-2 bg-[rgba(144,146,150,0.9)] text-white py-0.5 px-2 rounded-[12px] text-[10px] font-semibold tracking-[0.5px] uppercase z-10">
                          DISABLED
                        </div>
                      )}
                      {isOwnProfile && (
                        <div className="absolute top-2 right-2 z-20">
                          <button
                            className="bg-transparent border-none rounded-[6px] text-[#C1C2C5] p-1 text-lg leading-none cursor-pointer transition-all flex items-center justify-center w-7 h-7 hover:bg-[#667eea] hover:text-white"
                            onClick={() => setOpenMenuDeckId(openMenuDeckId === deck.deck_id ? null : deck.deck_id)}
                            aria-label="Deck options"
                          >
                            ⋮
                          </button>
                          {openMenuDeckId === deck.deck_id && (
                            <div className="absolute top-[calc(100%+4px)] right-0 bg-gradient-card border border-[#2C2E33] rounded-[8px] min-w-[160px] shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden z-[1000]">
                              <button
                                className="w-full py-3 px-4 bg-transparent border-none text-[#C1C2C5] cursor-pointer font-medium text-sm text-left transition-all flex items-center gap-2 hover:bg-[#25262B] hover:text-white border-b border-[#2C2E33]"
                                onClick={() => handleOpenEditDeck(deck)}
                              >
                                ✏️ Edit Deck
                              </button>
                              <button
                                className="w-full py-3 px-4 bg-transparent border-none text-[#C1C2C5] cursor-pointer font-medium text-sm text-left transition-all flex items-center gap-2 hover:bg-[#25262B] hover:text-white"
                                onClick={() => handleToggleDisabled(deck.deck_id, deck.disabled || false)}
                              >
                                {deck.disabled ? '✓ Enable Deck' : '✕ Disable Deck'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Top section: Image + Deck Info */}
                      <div className="flex gap-3 pl-3 pr-4 pt-3 pb-2">
                        {/* Thumbnail Image */}
                        {deck.commander_image_url && (
                          <div className="w-[70px] h-[70px] flex-shrink-0 rounded-lg overflow-hidden bg-[#1A1B1E] border-2 border-[#2C2E33]">
                            <img
                              src={deck.commander_image_url}
                              alt={deck.commander}
                              className="w-full h-full object-cover object-[center_20%]"
                            />
                          </div>
                        )}
                        {/* Deck Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                          <h3 className="text-base font-semibold text-white leading-tight">{deck.deck_name}</h3>
                          <div className="text-xs text-[#909296] leading-tight opacity-70">{deck.commander}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <ColorPips colors={deck.colors} />
                          </div>
                        </div>
                      </div>

                      {/* Bottom stats */}
                      <div className="grid grid-cols-3 gap-3 px-4 py-3 border-t border-[#2C2E33]">
                        <div className="text-center">
                          <div className="text-lg font-bold text-[#667eea]">{deck.games_played}</div>
                          <div className="text-[10px] text-[#666] uppercase">Games</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-[#667eea]">{deck.wins}</div>
                          <div className="text-[10px] text-[#666] uppercase">Wins</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-[#667eea]">{deck.win_rate.toFixed(0)}%</div>
                          <div className="text-[10px] text-[#666] uppercase">Win Rate</div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout: Vertical */}
                    <div className="hidden md:block">
                      {deck.disabled && (
                        <div className="absolute top-[12px] left-[12px] bg-[rgba(144,146,150,0.9)] text-white py-1 px-3 rounded-[12px] text-[11px] font-semibold tracking-[0.5px] uppercase z-10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                          DISABLED
                        </div>
                      )}
                      {isOwnProfile && (
                        <div className="absolute top-[12px] right-[12px] z-20">
                          <button
                            className="bg-transparent border-none rounded-[6px] text-[#C1C2C5] p-1 px-2 text-xl leading-none cursor-pointer transition-all flex items-center justify-center w-8 h-8 opacity-100 hover:bg-[#667eea] hover:text-white hover:border-[#667eea]"
                            onClick={() => setOpenMenuDeckId(openMenuDeckId === deck.deck_id ? null : deck.deck_id)}
                            aria-label="Deck options"
                          >
                            ⋮
                          </button>
                          {openMenuDeckId === deck.deck_id && (
                            <div className="absolute top-[calc(100%+4px)] right-0 bg-gradient-card border border-[#2C2E33] rounded-[8px] min-w-[160px] shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden z-[1000]">
                              <button
                                className="w-full py-3 px-4 bg-transparent border-none text-[#C1C2C5] cursor-pointer font-medium text-sm text-left transition-all flex items-center gap-2 hover:bg-[#25262B] hover:text-white border-b border-[#2C2E33]"
                                onClick={() => handleOpenEditDeck(deck)}
                              >
                                ✏️ Edit Deck
                              </button>
                              <button
                                className="w-full py-3 px-4 bg-transparent border-none text-[#C1C2C5] cursor-pointer font-medium text-sm text-left transition-all flex items-center gap-2 hover:bg-[#25262B] hover:text-white"
                                onClick={() => handleToggleDisabled(deck.deck_id, deck.disabled || false)}
                              >
                                {deck.disabled ? '✓ Enable Deck' : '✕ Disable Deck'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {deck.commander_image_url && (
                        <div className="w-full h-[200px] overflow-hidden mb-4">
                          <img
                            src={deck.commander_image_url}
                            alt={deck.commander}
                            className="w-full h-full object-cover object-[center_20%]"
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4 px-5">
                        <div>
                          <h3 className="text-lg font-semibold mb-1 text-white">{deck.deck_name}</h3>
                          <div className="text-[13px] text-[#909296] mb-3">{deck.commander}</div>
                        </div>
                        <div className="flex gap-1">
                          <ColorPips colors={deck.colors} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 py-4 px-5 border-t border-[#2C2E33]">
                        <div className="text-center">
                          <div className="text-xl font-bold text-[#667eea]">{deck.games_played}</div>
                          <div className="text-[11px] text-[#666] uppercase mt-1">Games</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-[#667eea]">{deck.wins}</div>
                          <div className="text-[11px] text-[#666] uppercase mt-1">Wins</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-[#667eea]">{deck.win_rate.toFixed(0)}%</div>
                          <div className="text-[11px] text-[#666] uppercase mt-1">Win Rate</div>
                        </div>
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
          onSubmit={editingDeck ? handleEditDeck : handleCreateDeck}
          onCancel={() => {
            setShowDeckForm(false);
            setEditingDeck(null);
          }}
          initialData={editingDeck || {
            name: '',
            player_id: playerId!,
            commander: '',
            colors: [],
            disabled: false,
          } as Deck}
          isEdit={!!editingDeck}
        />
      )}

      {/* Profile Edit Modal */}
      {showProfileEditModal && currentPlayer && (
        <ProfileEditModal
          currentName={currentPlayer.name}
          currentPicture={currentPlayer.picture}
          currentCustomAvatar={currentPlayer.custom_avatar}
          onClose={() => setShowProfileEditModal(false)}
          onSuccess={handleProfileUpdateSuccess}
        />
      )}
    </div>
  );
}

export default PlayerDetail;
