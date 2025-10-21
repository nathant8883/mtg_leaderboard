import { useEffect, useRef, useState } from 'react';

/**
 * Hook to prevent screen from timing out using the Screen Wake Lock API
 *
 * Features:
 * - Automatically requests wake lock on mount
 * - Releases wake lock on unmount
 * - Re-requests when tab becomes visible (after being backgrounded)
 * - Handles unsupported browsers gracefully
 * - Provides status for optional UI indicators
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Safari iOS 16.4+: Full support
 * - Firefox: Not yet supported (graceful fallback)
 *
 * @returns Object with isActive status and error state
 */
export function useWakeLock() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
      console.log('[useWakeLock] Wake Lock API not supported in this browser');
      setError('not_supported');
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      setError(null);
      console.log('[useWakeLock] ✅ Wake lock activated');

      // Listen for release events
      wakeLockRef.current.addEventListener('release', () => {
        console.log('[useWakeLock] Wake lock released');
        setIsActive(false);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[useWakeLock] Failed to acquire wake lock:', errorMessage);
      setError(errorMessage);
      setIsActive(false);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('[useWakeLock] Wake lock manually released');
      } catch (err) {
        console.warn('[useWakeLock] Error releasing wake lock:', err);
      }
    }
  };

  useEffect(() => {
    // Request wake lock on mount
    requestWakeLock();

    // Handle visibility change - re-request when tab becomes visible
    // (Wake lock is automatically released when tab is hidden/minimized)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useWakeLock] Tab became visible, re-requesting wake lock');
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  return {
    isActive,
    error,
  };
}
