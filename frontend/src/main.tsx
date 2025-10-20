import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Login } from './pages/Login.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentPlayer, loading, isGuest } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Service Worker registration is handled automatically by vite-plugin-pwa
