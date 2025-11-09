export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#141517]">
      <div className="flex flex-col items-center gap-6">
        {/* Logo with spinner ring */}
        <div className="relative">
          {/* Animated spinner ring */}
          <div className="absolute inset-0 rounded-full animate-spin" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '4px',
            width: '140px',
            height: '140px',
          }}>
            <div className="w-full h-full rounded-full bg-[#141517]"></div>
          </div>

          {/* Trophy logo */}
          <div className="relative flex items-center justify-center w-[140px] h-[140px] animate-pulse">
            <img
              src="/icon.png"
              alt="Pod Pal Logo"
              className="w-24 h-24 object-contain"
              style={{ animation: 'logoFadeIn 0.6s ease-out' }}
            />
          </div>
        </div>

        {/* Title and tagline */}
        <div className="flex flex-col items-center gap-2" style={{ animation: 'fadeIn 0.8s ease-out 0.2s backwards' }}>
          <h1 className="text-3xl font-bold bg-gradient-purple bg-clip-text text-transparent">
            Pod Pal
          </h1>
          <p className="text-sm text-[#909296] font-medium tracking-wide">
            Magic: The Gathering Leaderboard
          </p>
        </div>
      </div>

      <style>{`
        @keyframes logoFadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
