import { useNavigate } from 'react-router-dom';

/**
 * 404 Not Found page
 * Shown when user navigates to an invalid route
 */
export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-[120px] leading-none mb-4">🎴</div>
      <h1 className="text-4xl font-bold text-white mb-3">404 - Page Not Found</h1>
      <p className="text-[#909296] text-lg mb-8 max-w-md">
        This page doesn't exist. The commander you're looking for may have been exiled to the command zone.
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-gradient-purple border-none rounded-[8px] text-white cursor-pointer font-semibold text-base transition-all duration-200 shadow-[0_2px_8px_rgba(102,126,234,0.3)] hover:shadow-[0_4px_12px_rgba(102,126,234,0.5)] hover:transform hover:translateY-[-2px]"
      >
        Return to Dashboard
      </button>
    </div>
  );
}
