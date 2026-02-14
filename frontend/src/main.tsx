import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import './index.css'
import { Login } from './pages/Login.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { MatchHistory } from './pages/MatchHistory.tsx'
import { PodDynamics } from './pages/PodDynamics.tsx'
import MatchTracker from './pages/MatchTracker.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { MainLayout } from './components/MainLayout.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { LoadingScreen } from './components/LoadingScreen.tsx'
import PlayerDetail from './components/PlayerDetail.tsx'
import MatchDetail from './components/MatchDetail.tsx'
import Leaderboard from './components/Leaderboard.tsx'
import AdminPanel from './components/AdminPanel.tsx'
import { EventCreate } from './pages/EventCreate.tsx'
import { EventDashboard } from './pages/EventDashboard.tsx'
import EventMatchTracker from './pages/EventMatchTracker.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { PodProvider } from './contexts/PodContext.tsx'
import { PendingDecksProvider } from './contexts/PendingDecksContext.tsx'
import { Toaster } from 'react-hot-toast'

// Placeholder components for future event tasks
const EventLiveView = () => <div className="flex items-center justify-center min-h-screen text-[#909296] bg-[#141517]">Event Live View - Coming Soon</div>;

// Detect iOS and add class for iOS-specific styling (safe areas)
const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
if (isIOSDevice) {
  document.documentElement.classList.add('ios-device');
}

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
          <PendingDecksProvider>
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

            {/* Event Match Tracker - Standalone full-screen (no MainLayout) */}
            <Route
              path="/event/:eventId/match/:podIndex"
              element={
                <RequireAuth allowGuest={false}>
                  <EventMatchTracker />
                </RequireAuth>
              }
            />

            {/* Event Live View - Public, no auth, full-screen */}
            <Route path="/event/:eventId/live" element={<EventLiveView />} />

            {/* Main app routes with shared layout */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="matches" element={<MatchHistory />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="pod-dynamics" element={<PodDynamics />} />
              <Route path="players/:playerId" element={<PlayerDetail />} />
              <Route path="matches/:matchId" element={<MatchDetail />} />

              {/* Protected routes - require auth, no guest mode */}
              <Route element={<RequireAuth allowGuest={false}><Outlet /></RequireAuth>}>
                <Route path="admin" element={<AdminPanel />} />
                <Route path="event/create" element={<EventCreate />} />
                <Route path="event/:eventId" element={<EventDashboard />} />
              </Route>

              {/* 404 catch-all */}
              <Route path="*" element={<NotFound />} />
            </Route>
            </Routes>
          </PendingDecksProvider>
        </PodProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Service Worker registration is handled automatically by vite-plugin-pwa
