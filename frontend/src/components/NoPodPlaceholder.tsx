import React, { useState } from 'react';
import { Users, Plus, ChevronUp } from 'lucide-react';
import { CreatePodModal } from './CreatePodModal';
import './NoPodPlaceholder.css';

export const NoPodPlaceholder: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <div className="no-pod-placeholder">
        <div className="no-pod-content">
          {/* Icon */}
          <div className="no-pod-icon-container">
            <div className="no-pod-icon-wrapper">
              <Users size={56} className="no-pod-icon" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="no-pod-heading">Welcome to Pod Pal!</h1>

          {/* Message */}
          <p className="no-pod-message">
            Let's get you started by creating your first pod or joining friends.
          </p>

          {/* Info text */}
          <div className="no-pod-info">
            <div className="no-pod-info-item">
              <div className="no-pod-info-icon">✨</div>
              <div className="no-pod-info-text">
                Pods help you track Commander games with your playgroup
              </div>
            </div>
            <div className="no-pod-info-item">
              <div className="no-pod-info-icon">📊</div>
              <div className="no-pod-info-text">
                See stats, leaderboards, and match history for your pod
              </div>
            </div>
            <div className="no-pod-info-item">
              <div className="no-pod-info-icon">🎯</div>
              <div className="no-pod-info-text">
                Each player can manage their decks and compete for glory
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <button
            className="no-pod-primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} />
            <span>Create Your First Pod</span>
          </button>

          {/* Secondary CTA */}
          <div className="no-pod-secondary">
            <div className="no-pod-divider">
              <span className="no-pod-divider-text">or</span>
            </div>
            <div className="no-pod-invite-hint">
              <ChevronUp size={16} className="no-pod-arrow-icon" />
              <span>Have an invite? Check your pod drawer in the top navigation</span>
              <ChevronUp size={16} className="no-pod-arrow-icon" />
            </div>
          </div>
        </div>
      </div>

      {/* Create Pod Modal */}
      {showCreateModal && (
        <CreatePodModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
};
