import { useEffect } from 'react';

/**
 * Hook to detect mobile devices in landscape orientation and apply a CSS class
 * to the document root for styling purposes.
 *
 * This allows the app to show mobile-optimized UI even when viewport width > 768px
 * (which happens on phones in landscape mode).
 *
 * Detection Logic:
 * - Touch device (phone/tablet, not desktop)
 * - Landscape orientation (width > height)
 * - Short viewport (height < 500px) - excludes tablets and desktops
 *
 * When all conditions are met, adds 'mobile-landscape' class to document.documentElement.
 * CSS can then use this class to override desktop styles with mobile styles.
 */
export function useMobileLandscape() {
  useEffect(() => {
    const updateMobileLandscapeClass = () => {
      // Detect touch device (phones/tablets, not mouse-based desktops)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Check if in landscape orientation
      const isLandscape = window.innerWidth > window.innerHeight;

      // Check for short viewport - phones in landscape have ~350-450px height
      // Tablets/desktops in landscape have 600px+ height
      const isShortViewport = window.innerHeight < 500;

      // Only apply mobile-landscape class when all conditions are met
      const isMobileLandscape = isTouchDevice && isLandscape && isShortViewport;

      document.documentElement.classList.toggle('mobile-landscape', isMobileLandscape);
    };

    // Run immediately on mount
    updateMobileLandscapeClass();

    // Listen for orientation changes and window resizes
    window.addEventListener('resize', updateMobileLandscapeClass);
    window.addEventListener('orientationchange', updateMobileLandscapeClass);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('resize', updateMobileLandscapeClass);
      window.removeEventListener('orientationchange', updateMobileLandscapeClass);
      // Remove class on unmount
      document.documentElement.classList.remove('mobile-landscape');
    };
  }, []);
}
