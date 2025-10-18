import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth';
import { APP_VERSION, CACHE_VERSION } from '../version';
import './ProfileDropdown.css';

export const ProfileDropdown: React.FC = () => {
  const { currentPlayer, logout } = useAuth();
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
  }, [currentPlayer?.picture]);

  if (!currentPlayer) {
    return null;
  }

  const handleMyProfile = () => {
    // Dispatch custom event for App.tsx to handle
    const event = new CustomEvent('viewPlayerDetail', { detail: { playerId: currentPlayer.id } });
    window.dispatchEvent(event);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/login');
    setIsOpen(false);
  };

  const profileImageUrl = currentPlayer.picture || null;
  const displayName = currentPlayer.name || currentPlayer.email || 'User';
  const avatarLetter = currentPlayer.avatar || displayName.charAt(0).toUpperCase();

  // Show avatar if no picture URL, image failed to load, or picture is empty string
  const shouldShowAvatar = !profileImageUrl || imageError || profileImageUrl.trim() === '';

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
      </button>

      {isOpen && (
        <div className="profile-menu">
          <div className="profile-menu-header">
            <div className="profile-menu-name">{displayName}</div>
            {currentPlayer.email && (
              <div className="profile-menu-email">{currentPlayer.email}</div>
            )}
          </div>
          <div className="profile-menu-divider"></div>
          <button className="profile-menu-item" onClick={handleMyProfile}>
            My Profile
          </button>
          <button className="profile-menu-item" onClick={handleLogout}>
            Logout
          </button>
          <div className="profile-menu-divider"></div>
          <div className="profile-menu-version">
            <div className="version-line">App: v{APP_VERSION}</div>
            <div className="version-line">Cache: {CACHE_VERSION}</div>
          </div>
        </div>
      )}
    </div>
  );
};
