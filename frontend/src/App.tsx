import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'
import AdminPanel from './components/AdminPanel'
import MatchForm from './components/MatchForm'
import RecentMatches from './components/RecentMatches'
import Leaderboard from './components/Leaderboard'
import TopPlayers from './components/TopPlayers'
import TopDecks from './components/TopDecks'
import StatsCards from './components/StatsCards'
import PlayerDetail from './components/PlayerDetail'
import { ProfileDropdown } from './components/ProfileDropdown'
import { useAuth } from './contexts/AuthContext'
import type { Player, Deck, CreateMatchRequest, Match } from './services/api'
import { playerApi, deckApi, matchApi } from './services/api'

type ViewType = 'dashboard' | 'leaderboard' | 'admin' | 'player-detail';

function App() {
  const { currentPlayer } = useAuth()
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
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
      const matchesData = await matchApi.getRecent(10)
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
      {/* Header */}
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
              🚀 Launchpad
            </button>
            <button
              className="record-match-btn"
              onClick={() => setShowMatchForm(true)}
            >
              ➕ Record Match
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

      {/* Main Content */}
      <div className="container">
        {activeView === 'dashboard' && (
          <div>
            <StatsCards />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
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
    </div>
  )
}

export default App
