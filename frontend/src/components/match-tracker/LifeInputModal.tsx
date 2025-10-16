import { useState } from 'react';

interface LifeInputModalProps {
  currentLife: number;
  onConfirm: (newLife: number) => void;
  onCancel: () => void;
}

function LifeInputModal({ currentLife, onConfirm, onCancel }: LifeInputModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<'set' | 'add' | 'subtract'>('set');

  const handleNumberClick = (num: string) => {
    if (inputValue.length < 3) {
      setInputValue(inputValue + num);
    }
  };

  const handleBackspace = () => {
    setInputValue(inputValue.slice(0, -1));
  };

  const handleClear = () => {
    setInputValue('');
    setMode('set');
  };

  const handleModeToggle = (newMode: 'add' | 'subtract') => {
    if (mode === newMode) {
      setMode('set');
    } else {
      setMode(newMode);
    }
  };

  const calculateNewLife = () => {
    const value = parseInt(inputValue) || 0;
    switch (mode) {
      case 'add':
        return currentLife + value;
      case 'subtract':
        return Math.max(0, currentLife - value);
      case 'set':
      default:
        return value;
    }
  };

  const handleConfirm = () => {
    if (inputValue) {
      const newLife = calculateNewLife();
      onConfirm(newLife);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="life-input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="life-input-display-compact">
          <span className="life-input-mode-compact">
            {mode === 'add' && '+'}
            {mode === 'subtract' && '−'}
            {mode === 'set' && '='}
          </span>
          <span className="life-input-value-compact">{inputValue || '0'}</span>
        </div>

        <div className="life-input-modes">
          <button
            className={`mode-btn ${mode === 'add' ? 'active' : ''}`}
            onClick={() => handleModeToggle('add')}
          >
            + Add
          </button>
          <button
            className={`mode-btn ${mode === 'subtract' ? 'active' : ''}`}
            onClick={() => handleModeToggle('subtract')}
          >
            − Subtract
          </button>
          <button
            className={`mode-btn ${mode === 'set' ? 'active' : ''}`}
            onClick={() => setMode('set')}
          >
            = Set
          </button>
        </div>

        <div className="number-pad">
          <button className="number-btn" onClick={() => handleNumberClick('7')}>7</button>
          <button className="number-btn" onClick={() => handleNumberClick('8')}>8</button>
          <button className="number-btn" onClick={() => handleNumberClick('9')}>9</button>
          <button className="number-btn" onClick={() => handleNumberClick('4')}>4</button>
          <button className="number-btn" onClick={() => handleNumberClick('5')}>5</button>
          <button className="number-btn" onClick={() => handleNumberClick('6')}>6</button>
          <button className="number-btn" onClick={() => handleNumberClick('1')}>1</button>
          <button className="number-btn" onClick={() => handleNumberClick('2')}>2</button>
          <button className="number-btn" onClick={() => handleNumberClick('3')}>3</button>
          <button className="number-btn clear-btn" onClick={handleClear}>C</button>
          <button className="number-btn" onClick={() => handleNumberClick('0')}>0</button>
          <button className="number-btn backspace-btn" onClick={handleBackspace}>⌫</button>
        </div>

        <div className="life-input-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!inputValue}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default LifeInputModal;
