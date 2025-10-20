import './LandscapePrompt.css';

/**
 * LandscapePrompt Component
 *
 * Displays a fullscreen overlay prompting users to rotate their device to landscape mode.
 * Only visible when the device is in portrait orientation.
 *
 * Uses CSS media queries for instant orientation detection - no JavaScript overhead.
 * Works cross-platform (iOS & Android) as a graceful fallback when native orientation
 * locking is not supported.
 */
function LandscapePrompt() {
  return (
    <div className="landscape-prompt">
      <div className="landscape-prompt-content">
        {/* Animated rotation icon */}
        <div className="landscape-prompt-icon">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Phone outline in portrait */}
            <rect x="7" y="2" width="10" height="16" rx="1" />
            <line x1="12" y1="16" x2="12" y2="16" />
            {/* Rotation arrows */}
            <path d="M20 12a8 8 0 0 1-8 8" opacity="0.5" />
            <polyline points="20 16 20 12 16 12" opacity="0.5" />
            <path d="M4 12a8 8 0 0 1 8-8" opacity="0.5" />
            <polyline points="4 8 4 12 8 12" opacity="0.5" />
          </svg>
        </div>

        {/* Message */}
        <h2 className="landscape-prompt-title">Please Rotate Your Device</h2>
        <p className="landscape-prompt-message">
          For the best match tracking experience, please rotate your device to landscape mode.
        </p>
      </div>
    </div>
  );
}

export default LandscapePrompt;
