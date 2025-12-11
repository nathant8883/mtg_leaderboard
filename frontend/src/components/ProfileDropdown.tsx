import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePendingDecks } from '../contexts/PendingDecksContext';
import { authService } from '../services/auth';
import { APP_VERSION } from '../version';
import './ProfileDropdown.css';

export const ProfileDropdown: React.FC = () => {
  const { currentPlayer, isGuest, logout } = useAuth();
  const { pendingCount } = usePendingDecks();
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset image error state when currentPlayer changes
  useEffect(() => {
    setImageError(false);
  }, [currentPlayer?.picture, currentPlayer?.custom_avatar]);

  // Don't render if not logged in and not in guest mode
  if (!currentPlayer && !isGuest) {
    return null;
  }

  const handleMyProfile = () => {
    if (currentPlayer) {
      navigate(`/players/${currentPlayer.id}`);
      setIsOpen(false);
    }
  };

  const handleLogin = () => {
    logout(); // Clear guest mode before navigating to login
    navigate('/login');
    setIsOpen(false);
  };

  const handleRecordMatch = () => {
    // Dispatch custom event for App.tsx to handle
    const event = new CustomEvent('openMatchForm');
    window.dispatchEvent(event);
    setIsOpen(false);
  };

  const handleViewLeaderboard = () => {
    navigate('/leaderboard');
    setIsOpen(false);
  };

  const handleViewAdmin = () => {
    navigate('/admin');
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/login');
    setIsOpen(false);
  };

  // Priority: custom_avatar > picture > avatar letter
  const profileImageUrl = isGuest ? null : (currentPlayer?.custom_avatar || currentPlayer?.picture || null);
  const displayName = isGuest ? 'Guest User' : (currentPlayer?.name || currentPlayer?.email || 'User');
  const avatarLetter = isGuest ? '👤' : (currentPlayer?.avatar || displayName.charAt(0).toUpperCase());

  // Show avatar letter if no image URL, image failed to load, or image is empty string, or is guest
  const shouldShowAvatar = isGuest || !profileImageUrl || imageError || profileImageUrl.trim() === '';

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
      >
        {shouldShowAvatar ? (
          <div className="profile-avatar">{avatarLetter}</div>
        ) : (
          <img
            src={profileImageUrl}
            alt={displayName}
            className="profile-image"
            onError={() => setImageError(true)}
          />
        )}
        {/* Pending decks notification badge */}
        {pendingCount > 0 && !isGuest && (
          <span className="pending-decks-badge">{pendingCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="profile-menu">
          <div className="profile-menu-header">
            <div className="profile-menu-name">{displayName}</div>
            {!isGuest && currentPlayer?.email && (
              <div className="profile-menu-email">{currentPlayer.email}</div>
            )}
            {isGuest && (
              <div className="profile-menu-email" style={{ color: '#f59e0b' }}>
                Login to unlock all features
              </div>
            )}
          </div>
          <div className="profile-menu-divider"></div>
          <button className="profile-menu-item" onClick={handleRecordMatch}>
            ➕ Record Match
          </button>
          <button className="profile-menu-item" onClick={handleViewLeaderboard}>
            🏆 Leaderboard
          </button>
          {!isGuest && currentPlayer?.is_superuser && (
            <button className="profile-menu-item" onClick={handleViewAdmin}>
              ⚙️ Admin
            </button>
          )}
          {isGuest && (
            <>
              <div className="profile-menu-divider"></div>
              <button
                className="profile-menu-item"
                onClick={handleLogin}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: 600
                }}
              >
                🔐 Login with Google
              </button>
            </>
          )}
          {!isGuest && (
            <>
              <div className="profile-menu-divider"></div>
              <button className="profile-menu-item" onClick={handleMyProfile}>
                My Profile
              </button>
              <button className="profile-menu-item" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
          <div className="profile-menu-divider"></div>
          <div className="profile-menu-version">
            <div className="version-line">Version: {APP_VERSION}</div>
          </div>
        </div>
      )}
    </div>
  );
};
