import React, { useState, useRef, useEffect } from 'react';
import { usePod } from '../contexts/PodContext';
import { useAuth } from '../contexts/AuthContext';
import './PodSelector.css';

interface PodSelectorProps {
  onCreatePod?: () => void;
  onManagePods?: () => void;
}

export const PodSelector: React.FC<PodSelectorProps> = ({ onCreatePod, onManagePods }) => {
  const { currentPod, userPods, loading, switchPod } = usePod();
  const { currentPlayer, isGuest } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Don't render for guest users or non-authenticated users
  if (isGuest || !currentPlayer || currentPlayer.is_guest) {
    return null;
  }

  // Don't render if no pods yet
  if (!loading && userPods.length === 0) {
    return null;
  }

  const handleSwitchPod = async (podId: string) => {
    try {
      await switchPod(podId);
      setIsOpen(false);
    } catch (error) {
      console.error('Error switching pod:', error);
    }
  };

  const handleCreatePod = () => {
    setIsOpen(false);
    if (onCreatePod) {
      onCreatePod();
    }
  };

  const handleManagePods = () => {
    setIsOpen(false);
    if (onManagePods) {
      onManagePods();
    }
  };

  const displayName = currentPod?.name || 'Select Pod';
  const memberCount = currentPod?.member_count || currentPod?.member_ids?.length || 0;

  return (
    <div className="pod-selector" ref={dropdownRef}>
      <button
        className="pod-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select pod"
        disabled={loading}
      >
        <div className="pod-selector-icon">🏠</div>
        <div className="pod-selector-info">
          <div className="pod-selector-name">{displayName}</div>
          {currentPod && (
            <div className="pod-selector-meta">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </div>
          )}
        </div>
        <div className={`pod-selector-chevron ${isOpen ? 'open' : ''}`}>▼</div>
      </button>

      {isOpen && (
        <div className="pod-selector-menu">
          <div className="pod-selector-menu-header">
            <div className="pod-selector-menu-title">Switch Pod</div>
            {currentPod && (
              <div className="pod-selector-menu-subtitle">
                Current: {currentPod.name}
              </div>
            )}
          </div>
          <div className="pod-selector-menu-divider"></div>

          <div className="pod-selector-pods-list">
            {userPods.map((pod) => (
              <button
                key={pod.id}
                className={`pod-selector-pod-item ${pod.id === currentPod?.id ? 'active' : ''}`}
                onClick={() => handleSwitchPod(pod.id!)}
              >
                <div className="pod-item-main">
                  <div className="pod-item-name">
                    {pod.name}
                    {pod.id === currentPod?.id && <span className="pod-item-checkmark">✓</span>}
                  </div>
                  <div className="pod-item-meta">
                    {pod.member_count || pod.member_ids?.length || 0} members
                    {pod.is_admin && <span className="pod-item-badge">Admin</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="pod-selector-menu-divider"></div>

          <button className="pod-selector-menu-item" onClick={handleCreatePod}>
            ➕ Create New Pod
          </button>

          <button className="pod-selector-menu-item" onClick={handleManagePods}>
            ⚙️ Manage Pods
          </button>
        </div>
      )}
    </div>
  );
};
