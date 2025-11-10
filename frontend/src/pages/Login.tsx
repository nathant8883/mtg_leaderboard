import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './Login.css';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginAsGuest, currentPlayer, isGuest, loading } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [skipRedirect, setSkipRedirect] = useState(false);

  useEffect(() => {
    // Handle OAuth callback with token
    const token = searchParams.get('token');
    if (token) {
      login(token).then(() => {
        navigate('/');
      });
    }

    // Handle error from OAuth
    const error = searchParams.get('error');
    if (error) {
      console.error('Authentication error:', error);
      // Could show error message to user here
    }
  }, [searchParams, login, navigate]);

  useEffect(() => {
    // Only redirect after auth has been initialized (loading complete)
    // and user is already logged in or in guest mode
    // Skip redirect if we're manually navigating elsewhere (e.g., quick play)
    if (!loading && (currentPlayer || isGuest) && !skipRedirect) {
      navigate('/', { replace: true });
    }
  }, [loading, currentPlayer, isGuest, navigate, skipRedirect]);

  const handleGoogleLogin = () => {
    authService.initiateGoogleLogin();
  };

  const handleDevLogin = async () => {
    try {
      const response = await fetch('/api/auth/dev/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Dev login failed');
      }

      const data = await response.json();
      await login(data.access_token);
      navigate('/');
    } catch (error) {
      console.error('Dev login error:', error);
    }
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    // Don't manually navigate - let the useEffect handle it
  };

  const manaColors = ['W', 'U', 'B', 'R', 'G'];
  const manaColorMap: Record<string, string> = {
    W: 'ms-w',
    U: 'ms-u',
    B: 'ms-b',
    R: 'ms-r',
    G: 'ms-g',
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Mana Energy Logo */}
        <div className="logo-container">
          <div className="mana-circle">
            <img src="/logo.png" alt="Pod Pal Logo" className="mana-icon" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.15)' }} />
          </div>
          <div className="mana-symbols">
            {manaColors.map((color) => (
              <i
                key={color}
                className={`ms ${manaColorMap[color]} ms-cost ms-shadow`}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Login Content - Title, Subtitle, and Buttons */}
        <div className="login-content">
          <h1 className="login-title">Pod Pal</h1>
          <p className="login-subtitle">Track your Commander games and compete with friends</p>

          {/* Show online login options when online */}
          {isOnline && (
            <>
              <button className="google-login-btn" onClick={handleGoogleLogin}>
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>

              {/* Only show dev login in development environment */}
              {import.meta.env.VITE_ENVIRONMENT === 'development' && (
                <>
                  <div style={{ margin: '16px 0', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>
                    or
                  </div>

                  <button
                    className="google-login-btn"
                    onClick={handleDevLogin}
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  >
                    Dev Login (Local Only)
                  </button>
                </>
              )}
            </>
          )}

          {/* Show offline mode option when offline */}
          {!isOnline && (
            <button
              className="google-login-btn"
              onClick={handleGuestLogin}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: '2px solid #f59e0b'
              }}
            >
              Continue Offline
            </button>
          )}

          {/* Quick Play option - always visible */}
          <div style={{ margin: '16px 0', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>
            or
          </div>

          <button
            className="google-login-btn"
            onClick={() => {
              // Set flag to prevent automatic redirect
              setSkipRedirect(true);
              // Enable guest mode
              loginAsGuest();
              // Navigate to quick play
              navigate('/match-tracker?mode=quick', { replace: true });
            }}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: '2px solid #10b981'
            }}
          >
            🎮 Play Now (Quick Match)
          </button>
        </div>
      </div>
    </div>
  );
};
