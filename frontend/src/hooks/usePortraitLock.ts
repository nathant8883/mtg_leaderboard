import { useEffect, useState } from 'react';

/**
 * Hook to lock screen orientation to portrait using the Screen Orientation API
 *
 * Features:
 * - Automatically locks to portrait on mount
 * - Unlocks orientation on unmount
 * - SILENTLY handles unsupported browsers (no prompts/warnings to user)
 * - Returns status for debugging only
 *
 * Important: On iOS Safari (not PWA), this will fail silently - which is
 * the desired behavior. The app will gracefully fall back to showing
 * mobile-optimized layout in landscape via CSS.
 *
 * @returns Status: 'locked' | 'failed' | 'unsupported'
 */
export function usePortraitLock() {
  const [status, setStatus] = useState<'locked' | 'failed' | 'unsupported'>('unsupported');

  useEffect(() => {
    const lockOrientation = async () => {
      // Check if Screen Orientation API is supported
      if (!('orientation' in screen) || !screen.orientation.lock) {
        setStatus('unsupported');
        return;
      }

      try {
        await screen.orientation.lock('portrait');
        setStatus('locked');
      } catch {
        // Silent failure - expected on iOS browser
        setStatus('failed');
      }
    };

    const unlockOrientation = () => {
      if ('orientation' in screen && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
        } catch {
          // Silent failure
        }
      }
    };

    lockOrientation();

    return () => {
      unlockOrientation();
    };
  }, []);

  return status;
}
