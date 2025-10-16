import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Login } from './pages/Login.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentPlayer, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentPlayer) {
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
