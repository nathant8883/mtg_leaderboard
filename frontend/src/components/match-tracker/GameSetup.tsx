import { useState } from 'react';

interface GameSetupProps {
  initialPlayerCount: number;
  initialStartingLife: number;
  onComplete: (playerCount: number, startingLife: number) => void;
  onExit: () => void;
}

function GameSetup({ initialPlayerCount, initialStartingLife, onComplete, onExit }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState<number>(initialPlayerCount);
  const [startingLife, setStartingLife] = useState<number>(initialStartingLife);

  const playerCountOptions = [3, 4, 5, 6];

  const handleStartingLifeChange = (delta: number) => {
    const newLife = startingLife + delta;
    if (newLife >= 1 && newLife <= 200) {
      setStartingLife(newLife);
    }
  };

  const handleNext = () => {
    onComplete(playerCount, startingLife);
  };

  return (
    <div className="min-h-screen max-h-screen p-4 pb-20 overflow-y-hidden box-border flex flex-col">
      <div className="text-center mb-6 relative">
        <button
          className="absolute left-0 top-0 w-11 h-11 bg-[rgba(255,255,255,0.1)] border-2 border-[rgba(255,255,255,0.2)] rounded-[8px] text-white text-2xl cursor-pointer transition-all flex items-center justify-center p-0 hover:bg-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.3)] hover:scale-105"
          onClick={onExit}
          title="Exit to Home"
        >
          ✕
        </button>
        <h1 className="text-[28px] font-semibold m-0 bg-gradient-purple bg-clip-text text-transparent">Match Setup</h1>
      </div>

      {/* Player Count Selector */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#9ca3af] m-0 mb-3 uppercase tracking-[0.5px]">Number of Players</h3>
        <div className="flex gap-2">
          {playerCountOptions.map((count) => (
            <button
              key={count}
              className={`flex-1 p-3 rounded-[8px] text-white text-lg font-bold cursor-pointer transition-all ${
                playerCount === count
                  ? 'bg-gradient-purple border-[#667eea]'
                  : 'bg-[#1a1b1e] border-[#2c2e33] hover:border-[#667eea]'
              } border-2`}
              onClick={() => setPlayerCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Starting Life Selector */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#9ca3af] m-0 mb-3 uppercase tracking-[0.5px]">Starting Life</h3>
        <div className="flex items-center justify-center gap-6 mb-4">
          <button
            className="w-16 h-16 bg-[#2c2e33] border-2 border-[#3c3e43] rounded-[12px] text-white text-[32px] font-bold cursor-pointer transition-all flex items-center justify-center hover:bg-[#667eea] hover:border-[#667eea] hover:scale-105 active:scale-95"
            onClick={() => handleStartingLifeChange(-1)}
          >
            −
          </button>
          <div className="text-5xl font-bold font-mono min-w-[100px] text-center text-[#10b981]">{startingLife}</div>
          <button
            className="w-16 h-16 bg-[#2c2e33] border-2 border-[#3c3e43] rounded-[12px] text-white text-[32px] font-bold cursor-pointer transition-all flex items-center justify-center hover:bg-[#667eea] hover:border-[#667eea] hover:scale-105 active:scale-95"
            onClick={() => handleStartingLifeChange(1)}
          >
            +
          </button>
        </div>
        <div className="flex gap-2 justify-center">
          {[20, 30, 40].map((life) => (
            <button
              key={life}
              className={`py-2 px-4 rounded-[6px] text-sm font-semibold cursor-pointer transition-all ${
                startingLife === life
                  ? 'bg-[rgba(16,185,129,0.2)] border-[#10b981] text-[#10b981]'
                  : 'bg-[#1a1b1e] border-[#2c2e33] text-[#9ca3af] hover:border-[#10b981] hover:text-[#10b981]'
              } border`}
              onClick={() => setStartingLife(life)}
            >
              {life}
            </button>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <button
        className="w-full py-4 px-8 bg-gradient-to-br from-[#10b981] to-[#059669] border-none rounded-[8px] text-white text-base font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(16,185,129,0.4)]"
        onClick={handleNext}
      >
        Next
      </button>
    </div>
  );
}

export default GameSetup;
