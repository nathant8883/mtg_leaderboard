import { useState } from 'react';

interface GameConfigProps {
  onSelectPlayerCount: (count: number) => void;
}

function GameConfig({ onSelectPlayerCount }: GameConfigProps) {
  const [selectedCount, setSelectedCount] = useState<number | null>(null);

  const playerCounts = [3, 4, 5, 6];

  const handleSelect = (count: number) => {
    setSelectedCount(count);
  };

  const handleContinue = () => {
    if (selectedCount) {
      onSelectPlayerCount(selectedCount);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#1a1b1e] to-[#2c2e33]">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
          Match Tracker
        </h1>
        <p className="text-[#9ca3af] text-lg font-medium">How many players?</p>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-[400px] mb-12">
        {playerCounts.map((count) => (
          <button
            key={count}
            className={`
              flex flex-col items-center justify-center gap-3 p-8 rounded-[16px] border-2 cursor-pointer transition-all duration-200
              ${selectedCount === count
                ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] border-[#667eea] scale-105 shadow-[0_8px_24px_rgba(102,126,234,0.4)]'
                : 'bg-[#1a1b1e] border-[#2c2e33] hover:border-[#667eea] hover:bg-[#25262b]'
              }
            `}
            onClick={() => handleSelect(count)}
          >
            <span className="text-5xl">👥</span>
            <span className="text-4xl font-bold text-white">{count}</span>
            <span className="text-sm font-semibold text-[#9ca3af]">Players</span>
          </button>
        ))}
      </div>

      <button
        className={`
          w-full max-w-[400px] py-4 px-8 rounded-[12px] text-lg font-bold transition-all duration-200
          ${selectedCount
            ? 'bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-[0_4px_12px_rgba(16,185,129,0.4)] hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(16,185,129,0.5)] cursor-pointer'
            : 'bg-[#2c2e33] text-[#6b7280] cursor-not-allowed opacity-50'
          }
        `}
        onClick={handleContinue}
        disabled={!selectedCount}
      >
        Continue
      </button>
    </div>
  );
}

export default GameConfig;
