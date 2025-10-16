import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'
import AdminPanel from './components/AdminPanel'
import MatchForm from './components/MatchForm'
import RecentMatches from './components/RecentMatches'
import Leaderboard from './components/Leaderboard'
import TopPlayers from './components/TopPlayers'
import TopDecks from './components/TopDecks'
import type { Player, Deck, CreateMatchRequest, Match } from './services/api'
import { playerApi, deckApi, matchApi } from './services/api'

type ViewType = 'dashboard' | 'leaderboard' | 'admin';

function App() {
  const [activeView, setActiveView] = useState<ViewType>('leaderboard')
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)

  // Load players and decks on mount
  useEffect(() => {
    loadPlayersAndDecks()
    loadMatches()
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

  return (
    <div className="app">
      <Toaster />
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">🏆</div>
            <h1 className="header-title">Commander League</h1>
          </div>
          <div className="nav-buttons">
            <button
              className={`nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              className={`nav-btn ${activeView === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveView('leaderboard')}
            >
              🏆 Leaderboard
            </button>
            <button
              className={`nav-btn ${activeView === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveView('admin')}
            >
              ⚙️ Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container">
        {activeView === 'dashboard' && (
          <div>
            <button
              className="primary-btn"
              onClick={() => setShowMatchForm(true)}
              style={{ marginBottom: '32px' }}
            >
              ➕ Record New Match
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <TopPlayers />
              <TopDecks />
            </div>

            <RecentMatches matches={matches} loading={loadingMatches} />
          </div>
        )}
        {activeView === 'leaderboard' && (
          <Leaderboard />
        )}
        {activeView === 'admin' && <AdminPanel />}
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
