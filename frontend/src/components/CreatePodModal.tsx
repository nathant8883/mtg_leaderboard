import React, { useState, useEffect } from 'react';
import { usePod } from '../contexts/PodContext';
import { Pod } from '../services/api';
import './CreatePodModal.css';
import toast from 'react-hot-toast';

interface CreatePodModalProps {
  onClose: () => void;
  onSubmit?: (name: string, description?: string) => Promise<void>;
  initialData?: Pod;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ onClose, onSubmit, initialData }) => {
  const { createPod } = usePod();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set initial values if editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
    }
  }, [initialData]);

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
        await onSubmit(name.trim(), description.trim() || undefined);
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
