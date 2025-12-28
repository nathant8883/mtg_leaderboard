import React, { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { playerApi } from '../services/api';

const MAX_KILL_MESSAGES = 5;
const MAX_MESSAGE_LENGTH = 50;

interface ProfileEditModalProps {
  currentName: string;
  currentPicture?: string;
  currentCustomAvatar?: string;
  currentKillMessages?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  currentName,
  currentPicture,
  currentCustomAvatar,
  currentKillMessages,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState(currentName);
  const [customAvatar, setCustomAvatar] = useState<string | null>(currentCustomAvatar || null);
  const [previewImage, setPreviewImage] = useState<string | null>(currentCustomAvatar || null);
  const [killMessages, setKillMessages] = useState<string[]>(currentKillMessages || []);
  const [newKillMessage, setNewKillMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateName = (value: string): boolean => {
    if (!value || value.trim().length < 3) {
      setNameError('Name must be at least 3 characters');
      return false;
    }
    if (value.length > 50) {
      setNameError('Name must be less than 50 characters');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    validateName(value);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Please select a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }

    setError(null);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setCustomAvatar(base64String);
      setPreviewImage(base64String);
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomAvatar = () => {
    setCustomAvatar('');
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddKillMessage = () => {
    const trimmed = newKillMessage.trim();
    if (!trimmed) return;
    if (killMessages.length >= MAX_KILL_MESSAGES) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) return;

    setKillMessages([...killMessages, trimmed]);
    setNewKillMessage('');
  };

  const handleRemoveKillMessage = (index: number) => {
    setKillMessages(killMessages.filter((_, i) => i !== index));
  };

  const handleKillMessageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKillMessage();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateName(name)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await playerApi.updateProfile(name.trim(), customAvatar, killMessages);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Determine what avatar to show in the current section
  const currentAvatarSrc = previewImage || currentPicture;
  const hasCustomAvatar = !!currentCustomAvatar || !!previewImage;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start md:items-center justify-center z-[1000] p-0 md:p-6" onClick={handleBackdropClick}>
      <div className="bg-gradient-card rounded-none md:rounded-[12px] p-0 md:p-8 w-full h-full md:h-auto max-w-full md:max-w-[500px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="mb-0 md:mb-6 flex items-center justify-between sticky md:static top-0 bg-gradient-card border-b border-[#2C2E33] md:border-b-0 p-4 px-5 md:p-0 z-10 flex-shrink-0">
          <h2 className="text-white m-0 text-xl md:text-2xl font-semibold flex-1">Edit Profile</h2>
          <button
            type="button"
            className="flex md:hidden bg-transparent border-none text-[#909296] text-2xl cursor-pointer p-1 px-2 items-center justify-center rounded-[6px] transition-all hover:bg-[rgba(144,146,150,0.1)] hover:text-white active:scale-95 ml-3"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto md:overflow-y-visible p-5 md:p-0 pb-10 md:pb-0 flex flex-col md:block">
          <div className="mb-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-[6px] p-3 mb-5">
                <p className="text-red-400 text-sm m-0">{error}</p>
              </div>
            )}

            {/* Name Input */}
            <div className="mb-5">
              <label htmlFor="name" className="text-[#C1C2C5] text-sm font-semibold block mb-2">Display Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={handleNameChange}
                className="w-full p-3 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter your name"
                minLength={3}
                maxLength={50}
                required
              />
              {nameError && (
                <div className="text-red-400 text-xs mt-1">{nameError}</div>
              )}
            </div>

            {/* Avatar Section */}
            <div className="mb-5">
              <label className="text-[#C1C2C5] text-sm font-semibold block mb-2">Profile Picture</label>

              {/* Current Avatar Display */}
              <div className="flex items-center gap-4 mb-4 p-4 bg-[#25262B] rounded-[8px] border border-[#2C2E33]">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-purple flex items-center justify-center border-2 border-[#2C2E33] flex-shrink-0">
                  {currentAvatarSrc ? (
                    <img
                      src={currentAvatarSrc}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-[#667eea] text-2xl">👤</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {hasCustomAvatar && (
                    <div>
                      <p className="text-[#C1C2C5] text-sm font-medium m-0">Custom avatar</p>
                      {currentPicture && (
                        <p className="text-[#909296] text-xs mt-1 m-0">Overrides your Google profile picture</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Controls */}
              <div className="flex gap-2 mb-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="flex-1 py-2 px-4 bg-[#667eea] text-white border-none rounded-[6px] text-sm font-semibold cursor-pointer transition-all hover:bg-[#5568d3] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  {hasCustomAvatar ? 'Change Avatar' : 'Upload Avatar'}
                </button>

                {hasCustomAvatar && (
                  <button
                    type="button"
                    className="flex-1 py-2 px-4 bg-transparent border border-[#fa5252] text-[#fa5252] rounded-[6px] text-sm font-semibold cursor-pointer transition-all hover:bg-[#fa5252] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleRemoveCustomAvatar}
                    disabled={loading}
                  >
                    Remove Avatar
                  </button>
                )}
              </div>

              <p className="text-[#909296] text-xs m-0">
                Supported formats: JPG, PNG, GIF, WebP. Max size: 2MB
              </p>
            </div>

            {/* Kill Messages Section */}
            <div className="mb-5">
              <label className="text-[#C1C2C5] text-sm font-semibold block mb-2">
                Kill Messages ({killMessages.length}/{MAX_KILL_MESSAGES})
              </label>

              {/* Existing messages list */}
              {killMessages.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {killMessages.map((message, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-[#25262B] rounded-[6px] border border-[#2C2E33]"
                    >
                      <span className="flex-1 text-[#C1C2C5] text-sm truncate">"{message}"</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKillMessage(index)}
                        className="p-1 text-[#909296] hover:text-red-400 transition-colors"
                        disabled={loading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new message input */}
              {killMessages.length < MAX_KILL_MESSAGES && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newKillMessage}
                      onChange={(e) => setNewKillMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                      onKeyDown={handleKillMessageKeyDown}
                      className="w-full p-3 pr-12 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#C1C2C5] text-sm font-[inherit] transition-colors focus:outline-none focus:border-[#667eea] disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter a kill message..."
                      maxLength={MAX_MESSAGE_LENGTH}
                      disabled={loading}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#909296] text-xs">
                      {newKillMessage.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddKillMessage}
                    disabled={loading || !newKillMessage.trim()}
                    className="p-3 bg-[#667eea] text-white border-none rounded-[6px] cursor-pointer transition-all hover:bg-[#5568d3] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              )}

              <p className="text-[#909296] text-xs mt-2 m-0">
                These messages randomly appear when you eliminate a player.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end mt-auto md:mt-6 pt-5 md:pt-0 flex-shrink-0">
              <button
                type="button"
                className="py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] bg-transparent border border-[#2C2E33] text-[#C1C2C5] cursor-pointer font-medium text-sm transition-all hover:bg-[#25262B] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`py-2.5 md:py-3 px-5 md:px-6 rounded-[6px] border-none text-white font-semibold text-sm transition-all ${
                  loading || nameError
                    ? 'bg-[#2C2E33] cursor-not-allowed opacity-50'
                    : 'bg-gradient-purple cursor-pointer opacity-100 hover:-translate-y-0.5'
                }`}
                disabled={loading || !!nameError}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEditModal;
