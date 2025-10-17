import { useState } from 'react';

interface LifeInputModalProps {
  onConfirm: (newLife: number) => void;
  onCancel: () => void;
}

function LifeInputModal({ onConfirm, onCancel }: LifeInputModalProps) {
  const [inputValue, setInputValue] = useState('');

  const handleNumberClick = (num: string) => {
    if (inputValue.length < 3) {
      setInputValue(inputValue + num);
    }
  };

  const handleBackspace = () => {
    setInputValue(inputValue.slice(0, -1));
  };

  const handleConfirm = () => {
    if (inputValue) {
      const newLife = parseInt(inputValue) || 0;
      onConfirm(newLife);
    }
  };

  return (
    <div className="life-input-fullscreen-overlay" onClick={onCancel}>
      <div className="life-input-fullscreen" onClick={(e) => e.stopPropagation()}>
        {/* Top section: Display and backspace */}
        <div className="life-input-top">
          <div className="life-input-display-large">
            {inputValue || '0'}
          </div>
          <button className="life-input-backspace" onClick={handleBackspace}>
            ✕
          </button>
        </div>

        {/* Center section: Number pad */}
        <div className="life-input-center">
          <div className="life-input-numpad">
            <button className="life-numpad-btn" onClick={() => handleNumberClick('1')}>1</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('2')}>2</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('3')}>3</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('4')}>4</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('5')}>5</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('6')}>6</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('7')}>7</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('8')}>8</button>
            <button className="life-numpad-btn" onClick={() => handleNumberClick('9')}>9</button>
          </div>
          <button className="life-numpad-btn life-numpad-zero" onClick={() => handleNumberClick('0')}>
            0
          </button>
        </div>

        {/* Bottom section: Action buttons */}
        <div className="life-input-actions-fullscreen">
          <button className="life-action-btn life-action-cancel" onClick={onCancel}>
            CANCEL
          </button>
          <button
            className="life-action-btn life-action-confirm"
            onClick={handleConfirm}
            disabled={!inputValue}
          >
            SET LIFE
          </button>
        </div>
      </div>
    </div>
  );
}

export default LifeInputModal;
