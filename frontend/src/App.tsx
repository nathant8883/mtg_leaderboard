import { useState, useEffect, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { Home, Play, User } from 'lucide-react'
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
import { ProfileDropdown } from './components/ProfileDropdown'
import { useAuth } from './contexts/AuthContext'
import type { Player, Deck, CreateMatchRequest, Match } from './services/api'
import { playerApi, deckApi, matchApi } from './services/api'

type ViewType = 'dashboard' | 'leaderboard' | 'admin' | 'player-detail' | 'match-tracker' | 'match-detail';

// Main application component
function App() {
  const { currentPlayer } = useAuth()
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)

  // Load players and decks on mount
  useEffect(() => {
    loadPlayersAndDecks()
    loadMatches()
  }, [])

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

  const handleRecordMatch = async (match: CreateMatchRequest) => {
    try {
      await matchApi.create(match)
      setShowMatchForm(false)
      loadMatches() // Refresh the matches list
      toast.success('Match recorded successfully!', {
        duration: 3000,
        position: 'top-center',
      })
    } catch (err) {
      console.error('Error recording match:', err)
      toast.error('Failed to record match')
      throw new Error('Failed to record match')
    }
  }

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
      {/* Header - Hidden only in match tracker */}
      {activeView !== 'match-tracker' && (
        <div className="app-header bg-gradient-card border-b border-[#2C2E33] px-6 py-4 md:px-6 md:py-4 max-md:px-3 max-md:py-[10px] sticky top-0 z-[100] shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-4 max-md:gap-3">
              <div className="w-10 h-10 max-md:w-9 max-md:h-9 bg-gradient-purple rounded-[8px] flex items-center justify-center text-xl max-md:text-lg cursor-pointer" onClick={() => setActiveView('dashboard')}>🏆</div>
              <h1 className="text-white m-0 text-xl font-bold max-md:hidden">Commander League</h1>
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

              <RecentMatches matches={matches} loading={loadingMatches} />
            </div>
          )}
          {activeView === 'leaderboard' && (
            <Leaderboard onPlayerClick={handleViewPlayerDetail} />
          )}
          {activeView === 'admin' && <AdminPanel />}
          {activeView === 'player-detail' && selectedPlayerId && (
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
        </div>
      )}
    </div>
  )
}

export default App
