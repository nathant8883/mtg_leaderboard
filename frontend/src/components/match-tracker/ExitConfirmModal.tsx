import { useState, useEffect } from 'react';
import './ExitConfirmModal.css';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ExitConfirmModal({ isOpen, onCancel, onConfirm }: ExitConfirmModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 250);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      onConfirm();
    }, 250);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`exit-modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className="exit-modal-content">
        <div className="exit-modal-handle" />
        <h2 className="exit-modal-title">Exit Game?</h2>
        <p className="exit-modal-message">
          Unsaved progress will be lost.
        </p>
        <div className="exit-modal-actions">
          <button className="exit-modal-cancel" onClick={handleClose}>
            Cancel
          </button>
          <button className="exit-modal-confirm" onClick={handleConfirm}>
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExitConfirmModal;
