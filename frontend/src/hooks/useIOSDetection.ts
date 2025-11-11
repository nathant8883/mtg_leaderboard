import { useEffect } from 'react';

/**
 * Hook to detect iOS devices and apply CSS classes for safe area handling.
 * Only iOS devices in PWA mode will get the 'ios-pwa' class applied.
 * Android and other devices remain unaffected.
 */
export function useIOSDetection() {
  useEffect(() => {
    const isIOS = () => {
      const platform = navigator.platform;
      const ua = navigator.userAgent;

      // Check for iPhone/iPad/iPod
      if (/iPad|iPhone|iPod/.test(platform)) {
        return true;
      }

      // iPad on iOS 13+ reports as "MacIntel" but has touch support
      if (platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return true;
      }

      // Fallback: check user agent for "iPhone" or "iPad"
      if (ua.includes('iPhone') || ua.includes('iPad')) {
        return true;
      }

      return false;
    };

    const isStandalone = () => {
      // iOS standalone detection
      if ('standalone' in window.navigator) {
        return (window.navigator as any).standalone === true;
      }
      // Android/other standalone detection
      return window.matchMedia('(display-mode: standalone)').matches;
    };

    // Apply classes to HTML element for CSS targeting
    if (isIOS()) {
      document.documentElement.classList.add('ios-device');

      if (isStandalone()) {
        document.documentElement.classList.add('ios-pwa');
      }
    }
  }, []);
}
