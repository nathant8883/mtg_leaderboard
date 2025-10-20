import { useState, useEffect, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { Home, Play, User, WifiOff, List } from 'lucide-react'
import './App.css'
import AdminPanel from './components/AdminPanel'
import MatchForm from './components/MatchForm'
import RecentMatches from './components/RecentMatches'
import Leaderboard from './components/Leaderboard'
import TopPlayers from './components/TopPlayers'
import TopDecks from './components/TopDecks'
import StatsCards from './components/StatsCards'
import PlayerDetail from './components/PlayerDetail'
import MatchDetail from './components/MatchDetail'
import MatchTracker from './pages/MatchTracker'
import SyncQueue from './components/SyncQueue'
import UpdatePrompt from './components/UpdatePrompt'
import InstallPrompt from './components/InstallPrompt'
import { ProfileDropdown } from './components/ProfileDropdown'
import { useAuth } from './contexts/AuthContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import type { Player, Deck, CreateMatchRequest, Match } from './services/api'
import { playerApi, deckApi, matchApi } from './services/api'
import offlineQueue from './services/offlineQueue'

type ViewType = 'dashboard' | 'leaderboard' | 'admin' | 'player-detail' | 'match-tracker' | 'match-detail';

/**
 * Extended Match type for pending (offline) matches
 * These exist client-side only until synced to server
 */
export interface PendingMatch extends Match {
  _pending: true;           // Flag to identify pending matches
  _tempId: string;          // Client-side temporary ID (UUID)
  _canUndo: boolean;        // Whether undo is still available (5-second window)
}

// Main application component
function App() {
  const { currentPlayer, isGuest } = useAuth()
  const { isOnline, isMetered, syncNow } = useOnlineStatus()
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [showSyncQueue, setShowSyncQueue] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Load players and decks on mount
  useEffect(() => {
    loadPlayersAndDecks()
    loadMatches()
    loadPendingCount()
  }, [])

  // Poll for pending count updates
  useEffect(() => {
    const interval = setInterval(loadPendingCount, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [])

  const loadPendingCount = async () => {
    try {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.error('Error loading pending count:', err);
    }
  }

  // Listen for profile view player detail event
  useEffect(() => {
    const handleViewPlayerDetailEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ playerId: string }>;
      handleViewPlayerDetail(customEvent.detail.playerId);
    };

    window.addEventListener('viewPlayerDetail', handleViewPlayerDetailEvent);
    return () => {
      window.removeEventListener('viewPlayerDetail', handleViewPlayerDetailEvent);
    };
  }, [])

  const handleViewMatchDetail = useCallback((matchId: string) => {
    setSelectedMatchId(matchId)
    setActiveView('match-detail')
  }, [])

  const handleBackFromMatchDetail = useCallback(() => {
    setSelectedMatchId(null)
    setActiveView('dashboard')
  }, [])

  // Listen for view match detail event
  useEffect(() => {
    const handleViewMatchDetailEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ matchId: string }>;
      handleViewMatchDetail(customEvent.detail.matchId);
    };

    window.addEventListener('viewMatchDetail', handleViewMatchDetailEvent);
    return () => {
      window.removeEventListener('viewMatchDetail', handleViewMatchDetailEvent);
    };
  }, [handleViewMatchDetail])

  // Listen for open match form event
  useEffect(() => {
    const handleOpenMatchFormEvent = () => {
      setShowMatchForm(true);
    };

    window.addEventListener('openMatchForm', handleOpenMatchFormEvent);
    return () => {
      window.removeEventListener('openMatchForm', handleOpenMatchFormEvent);
    };
  }, [])

  // Listen for navigate to view event
  useEffect(() => {
    const handleNavigateToViewEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ view: ViewType }>;
      setActiveView(customEvent.detail.view);
    };

    window.addEventListener('navigateToView', handleNavigateToViewEvent);
    return () => {
      window.removeEventListener('navigateToView', handleNavigateToViewEvent);
    };
  }, [])

  const loadPlayersAndDecks = async () => {
    try {
      const [playersData, decksData] = await Promise.all([
        playerApi.getAll(),
        deckApi.getAll()
      ])
      setPlayers(playersData)
      setDecks(decksData)
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  const loadMatches = async () => {
    try {
      setLoadingMatches(true)
      const matchesData = await matchApi.getRecent(3)
      setMatches(matchesData)
    } catch (err) {
      console.error('Error loading matches:', err)
    } finally {
      setLoadingMatches(false)
    }
  }

  /**
   * Optimistic UI Flow for Recording Matches
   *
   * 10-Step Process:
   * 1. Generate tempId (UUID)
   * 2. Add to IndexedDB queue
   * 3. Immediately update React state with pending status
   * 4. Show "Match saved (offline)" toast with undo button (5-second window)
   * 5. Try to sync to server
   * 6. On sync success: replace tempId with server ID
   * 7. Update status to 'synced' (remove from pending)
   * 8. Show "Match synced" toast
   * 9. On undo: remove from queue and state
   * 10. Show "Match removed" toast
   */
  const handleRecordMatch = async (matchRequest: CreateMatchRequest) => {
    try {
      // Step 1: Create a pending match object with temp ID
      const tempId = crypto.randomUUID();

      // Create MatchPlayer objects from the request
      const matchPlayers = matchRequest.player_deck_pairs.map(pair => {
        const player = players.find(p => p.id === pair.player_id);
        const deck = decks.find(d => d.id === pair.deck_id);
        return {
          player_id: pair.player_id,
          player_name: player?.name || 'Unknown Player',
          deck_id: pair.deck_id,
          deck_name: deck?.name || 'Unknown Deck',
          deck_colors: deck?.colors || [],
          is_winner: pair.player_id === matchRequest.winner_player_id,
        };
      });

      const pendingMatch: PendingMatch = {
        id: tempId,  // Temporary ID
        _pending: true,
        _tempId: tempId,
        _canUndo: true,
        players: matchPlayers,
        winner_player_id: matchRequest.winner_player_id,
        winner_deck_id: matchRequest.winner_deck_id,
        match_date: matchRequest.match_date,
        created_at: new Date().toISOString(),
      };

      // Step 2: Add to IndexedDB queue (with deduplication check)
      const queuedMatch = await offlineQueue.addMatch(matchRequest, players, decks);

      if (!queuedMatch) {
        // Duplicate detected - show warning and don't proceed
        toast.error('This match was already recorded recently', {
          duration: 4000,
          position: 'top-center',
        });
        return;
      }

      // Step 3: Immediately update React state (optimistic UI)
      setPendingMatches(prev => [pendingMatch, ...prev]);
      setShowMatchForm(false);

      // Step 4: Show "Match saved" toast with undo button (5-second window)
      toast((t) => (
        <div className="flex items-center gap-3">
          <span className="flex-1">
            {isOnline ? '✅ Match saved! Syncing...' : '📴 Match saved offline'}
          </span>
          <button
            onClick={() => {
              handleUndoMatch(tempId);
              toast.dismiss(t.id);
            }}
            className="px-3 py-1 bg-[#667eea] text-white rounded-[4px] text-sm font-semibold hover:bg-[#5568d3] transition-colors"
          >
            Undo
          </button>
        </div>
      ), {
        duration: 5000,
        position: 'top-center',
      });

      // After 5 seconds, mark as no longer undoable
      setTimeout(() => {
        setPendingMatches(prev =>
          prev.map(m => m._tempId === tempId ? { ...m, _canUndo: false } : m)
        );
      }, 5000);

      // Step 5: Try to sync immediately if online
      if (isOnline) {
        await offlineQueue.syncMatch(queuedMatch.id, {
          onSuccess: () => {
            // Step 6 & 7: Replace tempId with server ID, remove from pending
            setPendingMatches(prev => prev.filter(m => m._tempId !== tempId));

            // Step 8: Show "Match synced" toast
            toast.success('Match synced to server!', {
              duration: 2000,
              position: 'top-center',
            });

            // Refresh matches from server
            loadMatches();
            loadPendingCount(); // Update pending count
          },
          onError: (error) => {
            console.error('Failed to sync match:', error);
            // Match stays in pending state - will retry later
            toast.error(`Sync failed: ${error.message}`, {
              duration: 4000,
              position: 'top-center',
            });
            loadPendingCount(); // Update pending count
          },
        });
      }
    } catch (err) {
      console.error('Error recording match:', err);
      toast.error('Failed to record match');
      throw new Error('Failed to record match');
    }
  };

  /**
   * Handle undo action for pending match (within 5-second window)
   * Steps 9-10: Remove from queue and state, show toast
   */
  const handleUndoMatch = async (tempId: string) => {
    try {
      // Find the queued match in IndexedDB by temp ID
      const allQueuedMatches = await offlineQueue.getAllMatches();
      const queuedMatch = allQueuedMatches.find(m => m.id === tempId);

      if (queuedMatch) {
        // Step 9: Remove from queue
        await offlineQueue.deleteMatch(queuedMatch.id);
      }

      // Remove from pending state
      setPendingMatches(prev => prev.filter(m => m._tempId !== tempId));

      // Step 10: Show "Match removed" toast
      toast.success('Match removed', {
        duration: 2000,
        position: 'top-center',
      });

      // Update pending count
      loadPendingCount();
    } catch (err) {
      console.error('Error undoing match:', err);
      toast.error('Failed to undo match');
    }
  };

  const handleViewPlayerDetail = (playerId: string) => {
    setSelectedPlayerId(playerId)
    setActiveView('player-detail')
  }

  const handleBackFromPlayerDetail = () => {
    setSelectedPlayerId(null)
    setActiveView('dashboard')
  }

  return (
    <div className="w-full max-w-full min-h-screen flex flex-col">
      <Toaster />
      <UpdatePrompt />
      <InstallPrompt />

      {/* Offline Banner - Only show when offline but NOT in offline mode */}
      {!isOnline && !isGuest && (
        <div className="bg-[rgba(255,165,0,0.15)] border-b border-[rgba(255,165,0,0.3)] px-4 py-2 flex items-center justify-center gap-2 text-[#FFA500] text-sm font-medium sticky top-0 z-[101]">
          <WifiOff size={16} />
          <span>You're offline. Matches will sync when connection is restored.</span>
        </div>
      )}

      {/* Mobile Data Warning Banner */}
      {isOnline && isMetered && pendingCount > 0 && (
        <div className="bg-[rgba(102,126,234,0.15)] border-b border-[rgba(102,126,234,0.3)] px-4 py-2 flex items-center justify-between gap-3 text-[#667eea] text-sm font-medium sticky top-0 z-[101]">
          <div className="flex items-center gap-2 flex-1">
            <WifiOff size={16} />
            <span>
              {pendingCount} {pendingCount === 1 ? 'match' : 'matches'} pending. Auto-sync paused to save mobile data.
            </span>
          </div>
          <button
            onClick={async () => {
              await syncNow();
              loadPendingCount();
              loadMatches();
            }}
            className="px-3 py-1 bg-[#667eea] text-white rounded-[6px] text-xs font-semibold hover:bg-[#5568d3] transition-colors whitespace-nowrap"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Offline Mode Banner */}
      {isGuest && (
        <div className="bg-[rgba(245,158,11,0.15)] border-b border-[rgba(245,158,11,0.3)] px-4 py-2 flex items-center justify-center gap-2 text-[#f59e0b] text-sm font-medium sticky top-0 z-[101]">
          <span>📴</span>
          <span>Offline Mode - Login to edit decks and view profiles</span>
        </div>
      )}

      {/* Header - Hidden only in match tracker */}
      {activeView !== 'match-tracker' && (
        <div className="app-header bg-gradient-card border-b border-[#2C2E33] px-6 py-4 md:px-6 md:py-4 max-md:px-3 max-md:py-[10px] sticky top-0 z-[100] shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-4 max-md:gap-3">
              <div className="w-10 h-10 max-md:w-9 max-md:h-9 bg-gradient-purple rounded-[8px] flex items-center justify-center text-xl max-md:text-lg cursor-pointer" onClick={() => setActiveView('dashboard')}>🏆</div>
              <h1 className="text-white m-0 text-xl font-bold max-md:hidden">Pod Pal</h1>
            </div>
            <div className="flex gap-3 max-md:gap-[6px]">
              <button
                className={`px-4 py-2 border-none rounded-[6px] cursor-pointer font-medium text-sm transition-all duration-200 nav-btn-hover max-md:hidden ${
                  activeView === 'dashboard' ? 'bg-[#667eea] text-white' : 'bg-transparent text-[#909296]'
                }`}
                onClick={() => setActiveView('dashboard')}
              >
                <span>🚀</span>
                <span> Launchpad</span>
              </button>
              <button
                className="px-4 py-2 bg-gradient-purple border-none rounded-[6px] text-white cursor-pointer font-semibold text-sm transition-all duration-200 shadow-[0_2px_8px_rgba(102,126,234,0.3)] record-match-btn-hover max-md:hidden"
                onClick={() => setActiveView('match-tracker')}
              >
                <span>🎮</span>
                <span> Match Tracker</span>
              </button>
              <button
                className="px-4 py-2 bg-gradient-purple border-none rounded-[6px] text-white cursor-pointer font-semibold text-sm transition-all duration-200 shadow-[0_2px_8px_rgba(102,126,234,0.3)] record-match-btn-hover max-md:hidden"
                onClick={() => setShowMatchForm(true)}
              >
                <span>➕</span>
                <span> Record Match</span>
              </button>
              {pendingCount > 0 && (
                <button
                  onClick={() => setShowSyncQueue(true)}
                  className="relative px-4 py-2 bg-[rgba(255,165,0,0.15)] border border-[rgba(255,165,0,0.3)] rounded-[6px] text-[#FFA500] cursor-pointer font-semibold text-sm transition-all duration-200 hover:bg-[rgba(255,165,0,0.25)] max-md:hidden flex items-center gap-2"
                >
                  <List className="w-4 h-4" />
                  <span>Sync Queue</span>
                  <span className="absolute -top-2 -right-2 bg-[#FF6B6B] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {pendingCount}
                  </span>
                </button>
              )}
              <ProfileDropdown />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-3 pt-6 pb-24 md:pb-6 w-full flex-1">
        {activeView === 'match-tracker' && (
          <MatchTracker onExitToHome={() => setActiveView('dashboard')} />
        )}
        {activeView !== 'match-tracker' && (
          <>
          {activeView === 'dashboard' && (
            <div>
              <StatsCards />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <TopPlayers
                  onViewLeaderboard={() => setActiveView('leaderboard')}
                  onPlayerClick={handleViewPlayerDetail}
                />
                <TopDecks
                  onViewLeaderboard={() => setActiveView('leaderboard')}
                  onPlayerClick={handleViewPlayerDetail}
                />
              </div>

              <RecentMatches
                matches={[...pendingMatches, ...matches]}
                loading={loadingMatches}
              />
            </div>
          )}
          {activeView === 'leaderboard' && (
            <Leaderboard onPlayerClick={handleViewPlayerDetail} />
          )}
          {!isGuest && activeView === 'admin' && <AdminPanel />}
          {!isGuest && activeView === 'player-detail' && selectedPlayerId && (
            <PlayerDetail
              playerId={selectedPlayerId}
              onBack={handleBackFromPlayerDetail}
            />
          )}
          {activeView === 'match-detail' && selectedMatchId && (
            <MatchDetail
              matchId={selectedMatchId}
              onBack={handleBackFromMatchDetail}
            />
          )}
        </>
      )}
      </div>

      {/* Match Form Modal */}
      {showMatchForm && (
        <MatchForm
          onSubmit={handleRecordMatch}
          onCancel={() => setShowMatchForm(false)}
          players={players}
          decks={decks}
        />
      )}

      {/* Sync Queue Modal */}
      {showSyncQueue && (
        <SyncQueue
          onClose={() => {
            setShowSyncQueue(false);
            loadPendingCount(); // Refresh count when closing
            loadMatches(); // Refresh matches list
          }}
          onEditMatch={(match) => {
            // TODO: Implement edit functionality in future phase
            console.log('Edit match:', match);
          }}
          onReauth={() => {
            // Redirect to login page
            window.location.href = '/login';
          }}
        />
      )}

      {/* Mobile Bottom Action Bar */}
      {activeView !== 'match-tracker' && (
        <div className="hidden max-md:flex fixed bottom-0 left-0 right-0 bg-[rgba(26,27,30,0.95)] backdrop-blur-[10px] border-t border-[#2C2E33] px-3 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-[900] shadow-[0_-4px_12px_rgba(0,0,0,0.3)] gap-2">
          <button
            className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 border-none rounded-[12px] cursor-pointer text-xs font-semibold transition-[all_0.15s_ease-out] active:scale-95 ${
              activeView === 'dashboard'
                ? 'bg-[rgba(51,217,178,0.15)] text-[var(--accent-cyan)] opacity-100 shadow-[0_-2px_6px_rgba(51,217,178,0.15)]'
                : 'bg-transparent text-[#909296] opacity-60'
            }`}
            onClick={() => setActiveView('dashboard')}
          >
            <Home size={24} />
            <span className="text-[11px]">Home</span>
          </button>
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 border-none rounded-[12px] bg-gradient-purple text-white cursor-pointer text-xs font-semibold transition-[all_0.15s_ease-out] shadow-[0_2px_8px_rgba(102,126,234,0.3)] opacity-100 active:scale-95"
            onClick={() => setActiveView('match-tracker')}
          >
            <Play size={24} />
            <span className="text-[11px]">Start Game</span>
          </button>
          {!isGuest && (
            <button
              className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 border-none rounded-[12px] cursor-pointer text-xs font-semibold transition-[all_0.15s_ease-out] active:scale-95 ${
                activeView === 'player-detail'
                  ? 'bg-[rgba(51,217,178,0.15)] text-[var(--accent-cyan)] opacity-100 shadow-[0_-2px_6px_rgba(51,217,178,0.15)]'
                  : 'bg-transparent text-[#909296] opacity-60'
              }`}
              onClick={() => {
                if (currentPlayer) {
                  handleViewPlayerDetail(currentPlayer.id);
                }
              }}
            >
              <User size={24} />
              <span className="text-[11px]">Profile</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default App
