import React, { useState } from 'react';
import { usePod } from '../contexts/PodContext';
import { useAuth } from '../contexts/AuthContext';
import './PodInvitesModal.css';
import toast from 'react-hot-toast';

interface PodInvitesModalProps {
  onClose: () => void;
}

export const PodInvitesModal: React.FC<PodInvitesModalProps> = ({ onClose }) => {
  const { pendingInvites, acceptInvite, declineInvite, refreshInvites } = usePod();
  const { currentPlayer } = useAuth();
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  const handleAccept = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      await acceptInvite(inviteId);
      toast.success('Pod invitation accepted!', {
        duration: 3000,
        position: 'top-center',
      });
      await refreshInvites();
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to accept invitation');
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      await declineInvite(inviteId);
      toast.success('Pod invitation declined', {
        duration: 2000,
        position: 'top-center',
      });
      await refreshInvites();
    } catch (error) {
      console.error('Error declining invite:', error);
      toast.error('Failed to decline invitation');
    } finally {
      setProcessingInvite(null);
    }
  };

  return (
    <div className="pod-invites-modal-overlay" onClick={onClose}>
      <div className="pod-invites-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pod-invites-modal-header">
          <h2 className="pod-invites-modal-title">Pod Invitations</h2>
          <button className="pod-invites-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pod-invites-modal-content">
          {pendingInvites.length === 0 ? (
            <div className="pod-invites-empty">
              <div className="pod-invites-empty-icon">📭</div>
              <div className="pod-invites-empty-text">No pending invitations</div>
            </div>
          ) : (
            <div className="pod-invites-list">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="pod-invite-item">
                  <div className="pod-invite-item-main">
                    <div className="pod-invite-item-header">
                      <div className="pod-invite-item-icon">🏠</div>
                      <div className="pod-invite-item-info">
                        <div className="pod-invite-item-pod-name">
                          {invite.pod_name || 'Unknown Pod'}
                        </div>
                        {invite.pod_description && (
                          <div className="pod-invite-item-description">
                            {invite.pod_description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pod-invite-item-details">
                      <div className="pod-invite-item-inviter">
                        Invited by: <strong>{invite.inviter_name || 'Unknown'}</strong>
                      </div>
                      {invite.created_at && (
                        <div className="pod-invite-item-date">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pod-invite-item-actions">
                    <button
                      className="pod-invite-item-button pod-invite-accept"
                      onClick={() => handleAccept(invite.id!)}
                      disabled={processingInvite === invite.id}
                    >
                      {processingInvite === invite.id ? '...' : '✓ Accept'}
                    </button>
                    <button
                      className="pod-invite-item-button pod-invite-decline"
                      onClick={() => handleDecline(invite.id!)}
                      disabled={processingInvite === invite.id}
                    >
                      {processingInvite === invite.id ? '...' : '✕ Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pod-invites-modal-footer">
          <button className="pod-invites-modal-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
