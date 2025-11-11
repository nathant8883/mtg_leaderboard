import React, { useState, useEffect, useRef } from 'react';
import { usePod } from '../contexts/PodContext';
import { Pod } from '../services/api';
import './CreatePodModal.css';
import toast from 'react-hot-toast';

interface CreatePodModalProps {
  onClose: () => void;
  onSubmit?: (name: string, description?: string, customImage?: string) => Promise<void>;
  initialData?: Pod;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ onClose, onSubmit, initialData }) => {
  const { createPod } = usePod();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customImage, setCustomImage] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set initial values if editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setCustomImage(initialData.custom_image || '');
      setPreviewImage(initialData.custom_image || null);
    }
  }, [initialData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('Please select a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setCustomImage(base64String);
      setPreviewImage(base64String);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomImage = () => {
    setCustomImage('');
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Pod name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      // Use custom onSubmit if provided (for admin panel), otherwise use context
      if (onSubmit) {
        await onSubmit(name.trim(), description.trim() || undefined, customImage || undefined);
      } else {
        await createPod(name.trim(), description.trim() || undefined);
      }
      toast.success(initialData ? 'Pod updated successfully!' : 'Pod created successfully!', {
        duration: 3000,
        position: 'top-center',
      });
      onClose();
    } catch (error) {
      console.error('Error with pod:', error);
      toast.error(initialData ? 'Failed to update pod' : 'Failed to create pod');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-pod-modal-overlay" onClick={onClose}>
      <div className="create-pod-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-pod-modal-header">
          <h2 className="create-pod-modal-title">{initialData ? 'Edit Pod' : 'Create New Pod'}</h2>
          <button className="create-pod-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="create-pod-modal-content">
            <div className="create-pod-modal-field">
              <label htmlFor="pod-name" className="create-pod-modal-label">
                Pod Name <span className="create-pod-modal-required">*</span>
              </label>
              <input
                id="pod-name"
                type="text"
                className="create-pod-modal-input"
                placeholder="Enter pod name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoFocus
                required
              />
              <div className="create-pod-modal-hint">
                Choose a name for your playgroup (max 50 characters)
              </div>
            </div>

            <div className="create-pod-modal-field">
              <label htmlFor="pod-description" className="create-pod-modal-label">
                Description (Optional)
              </label>
              <textarea
                id="pod-description"
                className="create-pod-modal-textarea"
                placeholder="Add a description for your pod..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                rows={4}
              />
              <div className="create-pod-modal-hint">
                Add a description to help members understand this pod's purpose
              </div>
            </div>

            <div className="create-pod-modal-field">
              <label className="create-pod-modal-label">
                Pod Image (Optional)
              </label>

              {/* Image Preview */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '16px',
                padding: '16px',
                background: '#25262B',
                borderRadius: '8px',
                border: '1px solid #2C2E33'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #2C2E33',
                  flexShrink: 0
                }}>
                  <img
                    src={previewImage || '/logo.png'}
                    alt="Pod preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {previewImage ? (
                    <div>
                      <p style={{ color: '#C1C2C5', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                        Custom pod image
                      </p>
                      <p style={{ color: '#909296', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                        This will be displayed in the pod drawer and navbar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: '#C1C2C5', fontSize: '14px', fontWeight: 500, margin: 0 }}>
                        Pod Pal logo (default)
                      </p>
                      <p style={{ color: '#909296', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                        Upload a custom image to personalize your pod
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Controls */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="create-pod-modal-button create-pod-submit"
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  {previewImage ? 'Change Image' : 'Upload Image'}
                </button>

                {previewImage && (
                  <button
                    type="button"
                    className="create-pod-modal-button create-pod-cancel"
                    style={{ flex: 1, borderColor: '#fa5252', color: '#fa5252' }}
                    onClick={handleRemoveCustomImage}
                    disabled={isSubmitting}
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <div className="create-pod-modal-hint">
                Supported formats: JPG, PNG, GIF, WebP. Max size: 2MB
              </div>
            </div>
          </div>

          <div className="create-pod-modal-footer">
            <button
              type="button"
              className="create-pod-modal-button create-pod-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-pod-modal-button create-pod-submit"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (initialData ? 'Updating...' : 'Creating...') : (initialData ? 'Update Pod' : 'Create Pod')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
