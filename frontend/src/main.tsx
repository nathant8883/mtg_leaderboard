import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import './index.css'
import { Login } from './pages/Login.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import MatchTracker from './pages/MatchTracker.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { MainLayout } from './components/MainLayout.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { LoadingScreen } from './components/LoadingScreen.tsx'
import PlayerDetail from './components/PlayerDetail.tsx'
import MatchDetail from './components/MatchDetail.tsx'
import Leaderboard from './components/Leaderboard.tsx'
import AdminPanel from './components/AdminPanel.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { PodProvider } from './contexts/PodContext.tsx'
import { Toaster } from 'react-hot-toast'

// Protected route wrapper - allows both authenticated users and guest mode
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentPlayer, loading, isGuest } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Allow access if user is logged in OR in guest mode
  if (!currentPlayer && !isGuest) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PodProvider>
          <Toaster />
          <Routes>
          <Route path="/login" element={<Login />} />

          {/* Match Tracker - Standalone full-screen route (no MainLayout) */}
          <Route
            path="/match-tracker"
            element={
              <RequireAuth allowGuest={true}>
                <MatchTracker />
              </RequireAuth>
            }
          />

          {/* Main app routes with shared layout */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="players/:playerId" element={<PlayerDetail />} />
            <Route path="matches/:matchId" element={<MatchDetail />} />

            {/* Protected routes - require auth, no guest mode */}
            <Route element={<RequireAuth allowGuest={false}><Outlet /></RequireAuth>}>
              <Route path="admin" element={<AdminPanel />} />
            </Route>

            {/* 404 catch-all */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </PodProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Service Worker registration is handled automatically by vite-plugin-pwa
