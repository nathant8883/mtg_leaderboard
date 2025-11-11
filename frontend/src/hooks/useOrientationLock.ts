import { useEffect, useState } from 'react';

/**
 * Hook to lock screen orientation to landscape using the Screen Orientation API
 *
 * Features:
 * - Automatically locks to landscape on mount
 * - Unlocks orientation on unmount
 * - Handles unsupported browsers gracefully
 * - Provides status for conditional UI rendering
 *
 * Browser Support:
 * - Chrome/Edge on Android: Full support (PWA or fullscreen)
 * - Safari iOS 16.4+: Only in installed PWA (not in browser)
 * - Firefox: Partial/inconsistent support
 * - Desktop browsers: Generally restricted
 *
 * Important: This only works reliably when:
 * 1. App is installed as PWA (on iOS)
 * 2. App is in fullscreen mode (on Android)
 * 3. May require user gesture on some platforms
 *
 * @returns Status: 'locked' | 'failed' | 'unsupported'
 */
export function useOrientationLock() {
  const [status, setStatus] = useState<'locked' | 'failed' | 'unsupported'>('unsupported');

  useEffect(() => {
    const lockOrientation = async () => {
      // Check if Screen Orientation API is supported
      if (!('orientation' in screen) || !screen.orientation.lock) {
        console.log('[useOrientationLock] Screen Orientation API not supported in this browser');
        setStatus('unsupported');
        return;
      }

      try {
        await screen.orientation.lock('landscape');
        setStatus('locked');
        console.log('[useOrientationLock] ✅ Orientation locked to landscape');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[useOrientationLock] Failed to lock orientation:', errorMessage);
        setStatus('failed');
      }
    };

    const unlockOrientation = () => {
      if ('orientation' in screen && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
          console.log('[useOrientationLock] Orientation unlocked');
        } catch (err) {
          console.warn('[useOrientationLock] Error unlocking orientation:', err);
        }
      }
    };

    // Lock orientation on mount
    lockOrientation();

    // Unlock on unmount
    return () => {
      unlockOrientation();
    };
  }, []);

  return status;
}
