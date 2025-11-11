import React, { useState } from 'react';
import { Plus, Settings, Check, X } from 'lucide-react';
import { usePod } from '../contexts/PodContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import './PodDrawer.css';

interface PodDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePod: () => void;
  onManagePods: () => void;
}

export const PodDrawer: React.FC<PodDrawerProps> = ({
  isOpen,
  onClose,
  onCreatePod,
  onManagePods
}) => {
  const { currentPod, userPods, pendingInvites, switchPod, acceptInvite, declineInvite } = usePod();
  const { currentPlayer, isGuest } = useAuth();
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  // Don't render for guest users
  if (isGuest || !currentPlayer || currentPlayer.is_guest) {
    return null;
  }

  const handleSwitchPod = async (podId: string) => {
    try {
      await switchPod(podId);
      onClose();
    } catch (error) {
      console.error('Error switching pod:', error);
    }
  };

  const handleCreatePod = () => {
    onClose();
    onCreatePod();
  };

  const handleManagePods = () => {
    onClose();
    onManagePods();
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      await acceptInvite(inviteId);
      toast.success('Joined pod successfully!', {
        duration: 3000,
        position: 'top-center',
      });
      onClose();
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      const message = error.response?.data?.detail || 'Failed to accept invite';
      toast.error(message);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      setProcessingInvite(inviteId);
      await declineInvite(inviteId);
      toast.success('Invite declined', {
        duration: 3000,
        position: 'top-center',
      });
    } catch (error: any) {
      console.error('Error declining invite:', error);
      const message = error.response?.data?.detail || 'Failed to decline invite';
      toast.error(message);
    } finally {
      setProcessingInvite(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="pod-drawer-backdrop" onClick={onClose}></div>
      )}

      {/* Drawer */}
      <div className={`pod-drawer ${isOpen ? 'open' : ''}`}>
        <div className="pod-drawer-header">
          <div className="pod-drawer-title">Pods</div>
          <button className="pod-drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pod-drawer-content">
          <div className="pod-drawer-list">
            {userPods.map((pod) => (
              <button
                key={pod.id}
                className={`pod-drawer-item ${pod.id === currentPod?.id ? 'active' : ''}`}
                onClick={() => handleSwitchPod(pod.id!)}
              >
                <div className="pod-drawer-item-icon">
                  <img src="/logo.png" alt={pod.name} className="pod-drawer-item-logo" />
                </div>
                <div className="pod-drawer-item-info">
                  <div className="pod-drawer-item-name">
                    {pod.name}
                    {pod.id === currentPod?.id && (
                      <span className="pod-drawer-item-check">✓</span>
                    )}
                  </div>
                  <div className="pod-drawer-item-meta">
                    {pod.member_count || pod.member_ids?.length || 0} members
                    {pod.is_admin && (
                      <span className="pod-drawer-item-badge">Admin</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Pending Invites Section */}
          {pendingInvites && pendingInvites.length > 0 && (
            <>
              <div className="pod-drawer-divider"></div>
              <div className="pod-drawer-pending-section">
                <div className="pod-drawer-pending-title">Pending Invites</div>
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="pod-drawer-invite-item">
                    <div className="pod-drawer-item-icon">
                      <img src="/logo.png" alt={invite.pod_name} className="pod-drawer-item-logo" />
                    </div>
                    <div className="pod-drawer-item-info">
                      <div className="pod-drawer-item-name">
                        {invite.pod_name}
                      </div>
                      <div className="pod-drawer-item-meta">
                        Invited by {invite.inviter_name}
                      </div>
                    </div>
                    <div className="pod-drawer-invite-actions">
                      <button
                        className="pod-drawer-invite-accept"
                        onClick={() => handleAcceptInvite(invite.id!)}
                        disabled={processingInvite === invite.id}
                        title="Accept invite"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="pod-drawer-invite-decline"
                        onClick={() => handleDeclineInvite(invite.id!)}
                        disabled={processingInvite === invite.id}
                        title="Decline invite"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pod-drawer-divider"></div>

          <div className="pod-drawer-actions">
            <button className="pod-drawer-action-btn" onClick={handleCreatePod}>
              <Plus className="pod-drawer-action-icon" size={18} />
              <span>Create New Pod</span>
            </button>
            <button className="pod-drawer-action-btn" onClick={handleManagePods}>
              <Settings className="pod-drawer-action-icon" size={18} />
              <span>Manage Pods</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
