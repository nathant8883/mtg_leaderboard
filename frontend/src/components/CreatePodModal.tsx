import React, { useState } from 'react';
import { usePod } from '../contexts/PodContext';
import './CreatePodModal.css';
import toast from 'react-hot-toast';

interface CreatePodModalProps {
  onClose: () => void;
}

export const CreatePodModal: React.FC<CreatePodModalProps> = ({ onClose }) => {
  const { createPod } = usePod();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Pod name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await createPod(name.trim(), description.trim() || undefined);
      toast.success('Pod created successfully!', {
        duration: 3000,
        position: 'top-center',
      });
      onClose();
    } catch (error) {
      console.error('Error creating pod:', error);
      toast.error('Failed to create pod');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-pod-modal-overlay" onClick={onClose}>
      <div className="create-pod-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-pod-modal-header">
          <h2 className="create-pod-modal-title">Create New Pod</h2>
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
              {isSubmitting ? 'Creating...' : 'Create Pod'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
