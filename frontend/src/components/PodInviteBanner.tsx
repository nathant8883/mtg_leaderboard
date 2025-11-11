import React from 'react';
import { usePod } from '../contexts/PodContext';
import './PodInviteBanner.css';

interface PodInviteBannerProps {
  onViewInvites: () => void;
}

export const PodInviteBanner: React.FC<PodInviteBannerProps> = ({ onViewInvites }) => {
  const { pendingInvites } = usePod();

  // Don't show banner if no pending invites
  if (pendingInvites.length === 0) {
    return null;
  }

  const inviteCount = pendingInvites.length;
  const inviteText = inviteCount === 1
    ? `You have 1 pending pod invitation`
    : `You have ${inviteCount} pending pod invitations`;

  return (
    <div className="pod-invite-banner">
      <div className="pod-invite-banner-content">
        <div className="pod-invite-banner-icon">📨</div>
        <div className="pod-invite-banner-text">
          <span className="pod-invite-banner-message">{inviteText}</span>
        </div>
        <button
          className="pod-invite-banner-button"
          onClick={onViewInvites}
        >
          View Invites
        </button>
      </div>
    </div>
  );
};
