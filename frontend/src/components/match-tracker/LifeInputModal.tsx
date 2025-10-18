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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[2000]" onClick={onCancel}>
      <div className="w-full h-full flex flex-col p-8 bg-gradient-to-br from-[#1a1b1e] to-[#0f1012]" onClick={(e) => e.stopPropagation()}>
        {/* Top section: Display and backspace */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex-1 text-center text-8xl font-black text-[#10b981] font-mono tracking-wider">
            {inputValue || '0'}
          </div>
          <button
            className="w-20 h-20 rounded-[16px] bg-[#ef4444]/20 border-2 border-[#ef4444] text-[#ef4444] text-4xl font-bold hover:bg-[#ef4444]/30 active:scale-95 transition-all duration-150 flex items-center justify-center"
            onClick={handleBackspace}
          >
            ✕
          </button>
        </div>

        {/* Center section: Number pad */}
        <div className="flex-1 flex flex-col items-center justify-center mb-8">
          <div className="grid grid-cols-3 gap-4 max-w-[400px] w-full mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                className="aspect-square rounded-[20px] bg-[#2c2e33] border-2 border-[#3c3e43] text-white text-4xl font-bold hover:bg-[#3c3e43] hover:border-[#667eea] hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
                onClick={() => handleNumberClick(String(num))}
              >
                {num}
              </button>
            ))}
          </div>
          <button
            className="aspect-square rounded-[20px] bg-[#2c2e33] border-2 border-[#3c3e43] text-white text-4xl font-bold hover:bg-[#3c3e43] hover:border-[#667eea] hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg w-[calc(33.333%-0.666rem)] max-w-[124px]"
            onClick={() => handleNumberClick('0')}
          >
            0
          </button>
        </div>

        {/* Bottom section: Action buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            className="py-6 rounded-[16px] bg-[rgba(255,255,255,0.1)] border-2 border-[rgba(255,255,255,0.2)] text-white text-xl font-bold hover:bg-[rgba(255,255,255,0.15)] active:scale-98 transition-all duration-150"
            onClick={onCancel}
          >
            CANCEL
          </button>
          <button
            className={`
              py-6 rounded-[16px] text-xl font-bold transition-all duration-150
              ${inputValue
                ? 'bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-[0_4px_12px_rgba(16,185,129,0.4)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.5)] active:scale-98 cursor-pointer'
                : 'bg-[#2c2e33] text-[#6b7280] cursor-not-allowed opacity-50'
              }
            `}
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
