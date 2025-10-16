import { useState } from 'react'
import './App.css'
import AdminPanel from './components/AdminPanel'

type ViewType = 'dashboard' | 'leaderboard' | 'admin';

function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard')

  return (
    <div className="app">
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
            <h2>Dashboard View</h2>
            <p>Dashboard content will be implemented here...</p>
          </div>
        )}
        {activeView === 'leaderboard' && (
          <div>
            <h2>Leaderboard View</h2>
            <p>Leaderboard content will be implemented here...</p>
          </div>
        )}
        {activeView === 'admin' && <AdminPanel />}
      </div>
    </div>
  )
}

export default App
