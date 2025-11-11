import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Play, User, WifiOff, List } from 'lucide-react';
import { ProfileDropdown } from './ProfileDropdown';
import { PodDrawer } from './PodDrawer';
import { CreatePodModal } from './CreatePodModal';
import { PodInvitesModal } from './PodInvitesModal';
import { PodManagementModal } from './PodManagementModal';
import { PageTransition } from './PageTransition';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useWakeLock } from '../hooks/useWakeLock';
import MatchForm from './MatchForm';
import SyncQueue from './SyncQueue';
import UpdatePrompt from './UpdatePrompt';
import InstallPrompt from './InstallPrompt';
import PodAvatar from './PodAvatar';
import type { Player, Deck, CreateMatchRequest } from '../services/api';
import { playerApi, deckApi } from '../services/api';
import offlineQueue from '../services/offlineQueue';
import toast from 'react-hot-toast';

/**
 * MainLayout component - Shared layout for all main app pages
 * Contains header, navigation, banners, and modals
 * Child routes render in the <Outlet /> component
 */
export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod, pendingInvites } = usePod();
  const { isOnline, isMetered, syncNow } = useOnlineStatus();

  // Prevent screen timeout while app is open
  useWakeLock();

  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showSyncQueue, setShowSyncQueue] = useState(false);
  const [showPodDrawer, setShowPodDrawer] = useState(false);
  const [showCreatePodModal, setShowCreatePodModal] = useState(false);
  const [showPodInvitesModal, setShowPodInvitesModal] = useState(false);
  const [showPodManagementModal, setShowPodManagementModal] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Check if current route is match tracker (hide header/nav)
  const isMatchTracker = location.pathname === '/match-tracker';

  // Load players and decks on mount
  useEffect(() => {
    loadPlayersAndDecks();
    loadPendingCount();
  }, []);

  // Poll for pending count updates
  useEffect(() => {
    const interval = setInterval(loadPendingCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for open match form event (from other components)
  useEffect(() => {
    const handleOpenMatchFormEvent = () => {
      setShowMatchForm(true);
    };

    window.addEventListener('openMatchForm', handleOpenMatchFormEvent);
    return () => {
      window.removeEventListener('openMatchForm', handleOpenMatchFormEvent);
    };
  }, []);

  const loadPlayersAndDecks = async () => {
    try {
      const [playersData, decksData] = await Promise.all([
        playerApi.getAll(),
        deckApi.getAll()
      ]);
      setPlayers(playersData);
      setDecks(decksData);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const loadPendingCount = async () => {
    try {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.error('Error loading pending count:', err);
    }
  };

  const handleRecordMatch = async (matchRequest: CreateMatchRequest) => {
    try {
      // Step 1: Add to IndexedDB queue (with deduplication check)
      const queuedMatch = await offlineQueue.addMatch(matchRequest, players, decks);

      if (!queuedMatch) {
        // Duplicate detected - show warning and don't proceed
        toast.error('This match was already recorded recently', {
          duration: 4000,
          position: 'top-center',
        });
        return;
      }

      setShowMatchForm(false);

      // Step 3: Show "Match saved" toast with undo button (5-second window)
      toast((t) => (
        <div className="flex items-center gap-3">
          <span className="flex-1">
            {isOnline ? '✅ Match saved! Syncing...' : '📴 Match saved offline'}
          </span>
          <button
            onClick={() => {
              handleUndoMatch(queuedMatch.id);
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

      // Step 4: Try to sync immediately if online
      if (isOnline) {
        await offlineQueue.syncMatch(queuedMatch.id, {
          onSuccess: () => {
            toast.success('Match synced to server!', {
              duration: 2000,
              position: 'top-center',
            });
            loadPendingCount();
            // Trigger refresh for dashboard if we're on it
            if (location.pathname === '/') {
              window.dispatchEvent(new CustomEvent('refreshMatches'));
            }
          },
          onError: (error) => {
            console.error('Failed to sync match:', error);
            toast.error(`Sync failed: ${error.message}`, {
              duration: 4000,
              position: 'top-center',
            });
            loadPendingCount();
          },
        });
      }

      loadPendingCount();
    } catch (err) {
      console.error('Error recording match:', err);
      toast.error('Failed to record match');
      throw new Error('Failed to record match');
    }
  };

  const handleUndoMatch = async (tempId: string) => {
    try {
      const allQueuedMatches = await offlineQueue.getAllMatches();
      const queuedMatch = allQueuedMatches.find(m => m.id === tempId);

      if (queuedMatch) {
        await offlineQueue.deleteMatch(queuedMatch.id);
      }

      toast.success('Match removed', {
        duration: 2000,
        position: 'top-center',
      });

      loadPendingCount();

      // Trigger refresh for dashboard if we're on it
      if (location.pathname === '/') {
        window.dispatchEvent(new CustomEvent('refreshMatches'));
      }
    } catch (err) {
      console.error('Error undoing match:', err);
      toast.error('Failed to undo match');
    }
  };

  return (
    <div className="w-full max-w-full min-h-screen flex flex-col">
      <UpdatePrompt />
      <InstallPrompt />

      {/* Offline Banner - Only show on dashboard when offline but NOT in offline mode */}
      {location.pathname === '/' && !isOnline && !isGuest && (
        <div className="bg-[rgba(255,165,0,0.15)] border-b border-[rgba(255,165,0,0.3)] px-4 py-2 flex items-center justify-center gap-2 text-[#FFA500] text-sm font-medium sticky top-0 z-[101]">
          <WifiOff size={16} />
          <span>You're offline. Matches will sync when connection is restored.</span>
        </div>
      )}

      {/* Mobile Data Warning Banner - Only show on dashboard */}
      {location.pathname === '/' && isOnline && isMetered && pendingCount > 0 && (
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
              window.dispatchEvent(new CustomEvent('refreshMatches'));
            }}
            className="px-3 py-1 bg-[#667eea] text-white rounded-[6px] text-xs font-semibold hover:bg-[#5568d3] transition-colors whitespace-nowrap"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Offline Mode Banner - Only show on dashboard */}
      {location.pathname === '/' && isGuest && (
        <div className="bg-[rgba(245,158,11,0.15)] border-b border-[rgba(245,158,11,0.3)] px-4 py-2 flex items-center justify-center gap-2 text-[#f59e0b] text-sm font-medium sticky top-0 z-[101]">
          <span>📴</span>
          <span>Offline Mode - Login to edit decks and view profiles</span>
        </div>
      )}

      {/* Header - Hidden only in match tracker */}
      {!isMatchTracker && (
        <div className="app-header bg-gradient-card border-b border-[#2C2E33] px-6 py-4 md:px-6 md:py-4 max-md:px-3 max-md:py-[10px] sticky top-0 z-[100] shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-3 max-md:gap-2">
              <button
                className="flex items-center gap-3 max-md:gap-2 bg-transparent border-none p-0 cursor-pointer relative"
                onClick={() => setShowPodDrawer(true)}
              >
                <div className="relative hover:opacity-80 transition-opacity">
                  <PodAvatar
                    podName={currentPod?.name || 'Pod Pal'}
                    customImage={currentPod?.custom_image}
                    size="medium"
                  />
                  {!isGuest && currentPlayer && !currentPlayer.is_guest && pendingInvites && pendingInvites.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ef4444] rounded-full shadow-[0_2px_8px_rgba(239,68,68,0.5)] ring-[1.5px] ring-[#1a1b1e] animate-[subtlePulse_2s_ease-in-out_infinite]" />
                  )}
                </div>
                {!isGuest && currentPod && (
                  <div className="flex flex-col items-start">
                    <h1 className="text-white m-0 text-base font-bold leading-tight">Pod Pal</h1>
                    <div className="text-[#9ca3af] text-xs font-medium leading-tight">{currentPod.name}</div>
                  </div>
                )}
                {!isGuest && !currentPod && (
                  <h1 className="text-white m-0 text-xl font-bold max-md:hidden">Pod Pal</h1>
                )}
                {isGuest && (
                  <h1 className="text-white m-0 text-xl font-bold max-md:hidden">Pod Pal</h1>
                )}
              </button>
            </div>
            <div className="flex gap-3 max-md:gap-[6px]">
              <button
                className={`px-4 py-2 border-none rounded-[6px] cursor-pointer font-medium text-sm transition-all duration-200 nav-btn-hover max-md:hidden ${
                  location.pathname === '/' ? 'bg-[#667eea] text-white' : 'bg-transparent text-[#909296]'
                }`}
                onClick={() => navigate('/')}
              >
                <span>🚀</span>
                <span> Launchpad</span>
              </button>
              <button
                className="px-4 py-2 bg-gradient-purple border-none rounded-[6px] text-white cursor-pointer font-semibold text-sm transition-all duration-200 shadow-[0_2px_8px_rgba(102,126,234,0.3)] record-match-btn-hover max-md:hidden"
                onClick={() => navigate('/match-tracker')}
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

      {/* Main Content - Child routes render here */}
      <div className="px-3 pt-6 pb-24 md:pb-6 w-full flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
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
            loadPendingCount();
            window.dispatchEvent(new CustomEvent('refreshMatches'));
          }}
          onEditMatch={(match) => {
            console.log('Edit match:', match);
          }}
          onReauth={() => {
            window.location.href = '/login';
          }}
        />
      )}

      {/* Create Pod Modal */}
      {showCreatePodModal && (
        <CreatePodModal onClose={() => setShowCreatePodModal(false)} />
      )}

      {/* Pod Invites Modal */}
      {showPodInvitesModal && (
        <PodInvitesModal onClose={() => setShowPodInvitesModal(false)} />
      )}

      {/* Pod Management Modal */}
      {showPodManagementModal && currentPod && (
        <PodManagementModal
          pod={currentPod}
          onClose={() => setShowPodManagementModal(false)}
          onUpdate={() => {
            // Refresh pod data after updates
            window.dispatchEvent(new Event('podSwitched'));
          }}
        />
      )}

      {/* Pod Drawer */}
      <PodDrawer
        isOpen={showPodDrawer}
        onClose={() => setShowPodDrawer(false)}
        onCreatePod={() => {
          setShowPodDrawer(false);
          setShowCreatePodModal(true);
        }}
        onManagePods={() => {
          setShowPodDrawer(false);
          setShowPodManagementModal(true);
        }}
      />

      {/* Mobile Bottom Action Bar */}
      {!isMatchTracker && (
        <div className="hidden max-md:flex fixed bottom-0 left-0 right-0 bg-[rgba(26,27,30,0.95)] backdrop-blur-[10px] border-t border-[#2C2E33] px-3 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-[900] shadow-[0_-4px_12px_rgba(0,0,0,0.3)] gap-2">
          <button
            className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 border-none rounded-[12px] cursor-pointer text-xs font-semibold transition-[all_0.15s_ease-out] active:scale-95 ${
              location.pathname === '/'
                ? 'bg-[rgba(51,217,178,0.15)] text-[var(--accent-cyan)] opacity-100 shadow-[0_-2px_6px_rgba(51,217,178,0.15)]'
                : 'bg-transparent text-[#909296] opacity-60'
            }`}
            onClick={() => navigate('/')}
          >
            <Home size={24} />
            <span className="text-[11px]">Home</span>
          </button>
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 border-none rounded-[12px] bg-gradient-purple text-white cursor-pointer text-xs font-semibold transition-[all_0.15s_ease-out] shadow-[0_2px_8px_rgba(102,126,234,0.3)] opacity-100 active:scale-95"
            onClick={() => navigate('/match-tracker')}
          >
            <Play size={24} />
            <span className="text-[11px]">Start Game</span>
          </button>
          {!isGuest && (
            <button
              className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 border-none rounded-[12px] cursor-pointer text-xs font-semibold transition-[all_0.15s_ease-out] active:scale-95 ${
                location.pathname.startsWith('/players/')
                  ? 'bg-[rgba(51,217,178,0.15)] text-[var(--accent-cyan)] opacity-100 shadow-[0_-2px_6px_rgba(51,217,178,0.15)]'
                  : 'bg-transparent text-[#909296] opacity-60'
              }`}
              onClick={() => {
                if (currentPlayer) {
                  navigate(`/players/${currentPlayer.id}`);
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
  );
}
