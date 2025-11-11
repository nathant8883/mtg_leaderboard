import React, { useState, useEffect } from 'react';
import { X, UserPlus, Mail, Shield, Users, Edit2, Check, XCircle } from 'lucide-react';
import { podApi, playerApi, type Pod, type Player } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import toast from 'react-hot-toast';
import './PodManagementModal.css';

interface PodManagementModalProps {
  pod: Pod;
  onClose: () => void;
  onUpdate: () => void;
}

export const PodManagementModal: React.FC<PodManagementModalProps> = ({
  pod: initialPod,
  onClose,
  onUpdate,
}) => {
  const { currentPlayer } = useAuth();
  const { refreshPods } = usePod();
  const [pod, setPod] = useState(initialPod);
  const [members, setMembers] = useState<Player[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [removingMember, setRemovingMember] = useState<{ id: string; name: string } | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editedName, setEditedName] = useState(pod.name);
  const [editedDescription, setEditedDescription] = useState(pod.description || '');
  const [saving, setSaving] = useState(false);

  const isAdmin = pod.is_admin || pod.admin_ids?.includes(String(currentPlayer?.id)) || currentPlayer?.is_superuser;

  useEffect(() => {
    console.log('Pod Management Modal - Debug Info:', {
      podIsAdmin: pod.is_admin,
      adminIds: pod.admin_ids,
      currentPlayerId: currentPlayer?.id,
      isSuperuser: currentPlayer?.is_superuser,
      finalIsAdmin: isAdmin
    });
  }, [pod, currentPlayer]);

  useEffect(() => {
    loadPodDetails();
  }, [initialPod.id]);

  const loadPodDetails = async () => {
    try {
      // Fetch full pod details including admin_ids
      const fullPod = await podApi.getById(initialPod.id!);
      setPod(fullPod);
      await loadMembers(fullPod);
    } catch (error) {
      console.error('Error loading pod details:', error);
      toast.error('Failed to load pod details');
      // Fall back to using initial pod data
      await loadMembers(initialPod);
    }
  };

  const loadMembers = async (podData: Pod = pod) => {
    try {
      setLoading(true);
      // Fetch all players and filter by member_ids
      const allPlayers = await playerApi.getAll();
      const podMembers = allPlayers.filter(p => podData.member_ids?.includes(String(p.id)));
      setMembers(podMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Failed to load pod members');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      await podApi.invite(pod.id!, inviteEmail);
      toast.success(`Invitation sent to ${inviteEmail}`, {
        duration: 3000,
        position: 'top-center',
      });
      setInviteEmail('');
    } catch (error: any) {
      console.error('Error inviting member:', error);
      const message = error.response?.data?.detail || 'Failed to send invitation';
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!isAdmin) return;
    setRemovingMember({ id: memberId, name: memberName });
  };

  const confirmRemoveMember = async () => {
    if (!removingMember) return;

    try {
      await podApi.removeMember(pod.id!, removingMember.id);
      toast.success(`${removingMember.name} removed from pod`);
      setRemovingMember(null);
      // Reload pod details to get updated member list
      await loadPodDetails();
      await refreshPods();
      onUpdate();
    } catch (error: any) {
      console.error('Error removing member:', error);
      const message = error.response?.data?.detail || 'Failed to remove member';
      toast.error(message);
    }
  };

  const cancelRemoveMember = () => {
    setRemovingMember(null);
  };

  const handlePromoteToAdmin = async (memberId: string, memberName: string) => {
    if (!isAdmin) return;

    try {
      await podApi.promoteToAdmin(pod.id!, memberId);
      toast.success(`${memberName} is now an admin`);
      // Reload pod details to get updated admin list
      await loadPodDetails();
      await refreshPods();
      onUpdate();
    } catch (error: any) {
      console.error('Error promoting member:', error);
      const message = error.response?.data?.detail || 'Failed to promote member';
      toast.error(message);
    }
  };

  const handleDemoteFromAdmin = async (memberId: string, memberName: string) => {
    if (!isAdmin) return;

    try {
      await podApi.demoteFromAdmin(pod.id!, memberId);
      toast.success(`${memberName} is no longer an admin`);
      // Reload pod details to get updated admin list
      await loadPodDetails();
      await refreshPods();
      onUpdate();
    } catch (error: any) {
      console.error('Error demoting member:', error);
      const message = error.response?.data?.detail || 'Failed to demote member';
      toast.error(message);
    }
  };

  const handleLeavePod = async () => {
    if (!window.confirm('Are you sure you want to leave this pod?')) {
      return;
    }

    try {
      await podApi.leave(pod.id!);
      toast.success('Left pod successfully');
      await refreshPods();
      onClose();
    } catch (error: any) {
      console.error('Error leaving pod:', error);
      const message = error.response?.data?.detail || 'Failed to leave pod';
      toast.error(message);
    }
  };

  const handleStartEdit = () => {
    setEditedName(pod.name);
    setEditedDescription(pod.description || '');
    setIsEditingHeader(true);
  };

  const handleCancelEdit = () => {
    setEditedName(pod.name);
    setEditedDescription(pod.description || '');
    setIsEditingHeader(false);
  };

  const handleSaveEdit = async () => {
    if (!editedName.trim()) {
      toast.error('Pod name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const updated = await podApi.update(
        pod.id!,
        editedName,
        editedDescription || undefined
      );
      setPod(updated);
      setIsEditingHeader(false);
      toast.success('Pod updated successfully');
      await refreshPods();
      onUpdate();
    } catch (error: any) {
      console.error('Error updating pod:', error);
      toast.error(error.response?.data?.detail || 'Failed to update pod');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pod-management-modal-overlay" onClick={onClose}>
      <div className="pod-management-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pod-management-header">
          <div className="pod-management-header-content">
            <img src="/logo.png" alt={pod.name} className="pod-management-logo" />
            {!isEditingHeader ? (
              <div className="pod-header-view">
                <div className="pod-header-title-row">
                  <h2 className="pod-management-title">{pod.name}</h2>
                  {isAdmin && (
                    <button
                      className="pod-edit-button"
                      onClick={handleStartEdit}
                      title="Edit pod details"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
                {pod.description && (
                  <p className="pod-management-description">{pod.description}</p>
                )}
              </div>
            ) : (
              <div className="pod-header-edit-form">
                <div className="pod-edit-field">
                  <label className="pod-edit-label">Pod Name</label>
                  <input
                    type="text"
                    className="pod-name-input"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Enter pod name"
                    disabled={saving}
                  />
                </div>
                <div className="pod-edit-field">
                  <label className="pod-edit-label">Description (optional)</label>
                  <textarea
                    className="pod-description-textarea"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Enter pod description"
                    rows={2}
                    disabled={saving}
                  />
                </div>
                <div className="edit-actions">
                  <button
                    className="edit-cancel-button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                  <button
                    className="edit-save-button"
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <div className="button-spinner"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          <button className="pod-management-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Invite Section (Admin Only) */}
        {isAdmin && (
          <div className="pod-management-section">
            <div className="pod-management-section-header">
              <UserPlus size={18} />
              <h3>Invite Members</h3>
            </div>
            <form onSubmit={handleInvite} className="pod-invite-form">
              <div className="pod-invite-input-group">
                <Mail size={18} className="pod-invite-icon" />
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pod-invite-input"
                  disabled={inviting}
                />
              </div>
              <button
                type="submit"
                className="pod-invite-button"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>
          </div>
        )}

        {/* Members List */}
        <div className="pod-management-section">
          <div className="pod-management-section-header">
            <Users size={18} />
            <h3>Members ({members.length})</h3>
          </div>

          {loading ? (
            <div className="pod-members-loading">
              <div className="loading-spinner"></div>
              <p>Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="pod-members-empty">
              <p>No members yet</p>
            </div>
          ) : (
            <div className="pod-members-list">
              {members.map((member) => {
                const memberId = String(member.id);
                const isCurrentUser = memberId === String(currentPlayer?.id);
                const isMemberAdmin = pod.admin_ids?.includes(memberId);
                const isCreator = pod.creator_id === memberId;

                return (
                  <div key={member.id} className="pod-member-item">
                    <div className="pod-member-info">
                      <div className="pod-member-avatar">
                        {member.custom_avatar || member.picture ? (
                          <img
                            src={member.custom_avatar || member.picture || ''}
                            alt={member.name}
                            className="pod-member-avatar-img"
                          />
                        ) : (
                          <div className="pod-member-avatar-fallback">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="pod-member-details">
                        <div className="pod-member-name">
                          {member.name}
                          {isCurrentUser && <span className="pod-member-you">(You)</span>}
                        </div>
                        <div className="pod-member-roles">
                          {isCreator && (
                            <span className="pod-member-role pod-role-creator">
                              <Shield size={12} /> Creator
                            </span>
                          )}
                          {isMemberAdmin && !isCreator && (
                            <span className="pod-member-role pod-role-admin">
                              <Shield size={12} /> Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && !isCurrentUser && !isCreator && (
                      <div className="pod-member-actions">
                        {!isMemberAdmin ? (
                          <button
                            className="pod-member-promote"
                            onClick={() => handlePromoteToAdmin(memberId, member.name)}
                          >
                            Make Admin
                          </button>
                        ) : (
                          <button
                            className="pod-member-demote"
                            onClick={() => handleDemoteFromAdmin(memberId, member.name)}
                          >
                            Remove Admin
                          </button>
                        )}
                        <button
                          className="pod-member-remove"
                          onClick={() => handleRemoveMember(memberId, member.name)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pod-management-footer">
          {!isAdmin && pod.creator_id !== String(currentPlayer?.id) && (
            <button className="pod-leave-button" onClick={handleLeavePod}>
              Leave Pod
            </button>
          )}
          <button className="pod-done-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {/* Remove Member Confirmation Dialog */}
      {removingMember && (
        <div className="pod-management-modal-overlay" onClick={cancelRemoveMember}>
          <div className="pod-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="pod-confirm-title">Remove Member?</h3>
            <p className="pod-confirm-message">
              Are you sure you want to remove <strong>{removingMember.name}</strong> from this pod?
            </p>
            <div className="pod-confirm-actions">
              <button className="pod-confirm-cancel" onClick={cancelRemoveMember}>
                Cancel
              </button>
              <button className="pod-confirm-remove" onClick={confirmRemoveMember}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
