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
  const [showMenu, setShowMenu] = useState(false)
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
    <div className="app">
      <Toaster />
      {/* Header - Hidden in match tracker */}
      {activeView !== 'match-tracker' && (
        <div className="header">
          <div className="header-content">
            <div className="header-left">
              <div className="logo" onClick={() => setActiveView('dashboard')} style={{ cursor: 'pointer' }}>🏆</div>
              <h1 className="header-title">Commander League</h1>
            </div>
            <div className="nav-buttons">
              <button
                className={`nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveView('dashboard')}
              >
                <span>🚀</span>
                <span> Launchpad</span>
              </button>
              <button
                className="record-match-btn"
                onClick={() => setActiveView('match-tracker')}
              >
                <span>🎮</span>
                <span> Match Tracker</span>
              </button>
              <button
                className="record-match-btn"
                onClick={() => setShowMatchForm(true)}
              >
                <span>➕</span>
                <span> Record Match</span>
              </button>
              <div className="hamburger-menu">
                <button
                  className="hamburger-btn"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  ☰
                </button>
                {showMenu && (
                  <div className="menu-dropdown">
                    <button
                      className="menu-item"
                      onClick={() => {
                        setShowMatchForm(true)
                        setShowMenu(false)
                      }}
                    >
                      ➕ Add Match
                    </button>
                    <button
                      className="menu-item"
                      onClick={() => {
                        setActiveView('leaderboard')
                        setShowMenu(false)
                      }}
                    >
                      🏆 Leaderboard
                    </button>
                    {currentPlayer?.is_superuser && (
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveView('admin')
                          setShowMenu(false)
                        }}
                      >
                        ⚙️ Admin
                      </button>
                    )}
                  </div>
                )}
              </div>
              <ProfileDropdown />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container">
        {activeView === 'match-tracker' && (
          <MatchTracker onExitToHome={() => setActiveView('dashboard')} />
        )}
        {activeView !== 'match-tracker' && (
          <>
          {activeView === 'dashboard' && (
            <div>
              <StatsCards />

              <div className="dashboard-widgets-grid">
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
        <div className="mobile-action-bar">
          <button
            className={`mobile-action-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <Home className="action-icon" size={24} />
            <span className="action-label">Home</span>
          </button>
          <button
            className="mobile-action-btn mobile-action-btn-primary"
            onClick={() => setActiveView('match-tracker')}
          >
            <Play className="action-icon" size={24} />
            <span className="action-label">Start Game</span>
          </button>
          <button
            className={`mobile-action-btn ${activeView === 'player-detail' ? 'active' : ''}`}
            onClick={() => {
              if (currentPlayer) {
                handleViewPlayerDetail(currentPlayer.id);
              }
            }}
          >
            <User className="action-icon" size={24} />
            <span className="action-label">Profile</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
