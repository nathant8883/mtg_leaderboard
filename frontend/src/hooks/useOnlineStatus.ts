import { useState, useEffect } from 'react';
import offlineQueue from '../services/offlineQueue';

/**
 * Hook to track online/offline status and trigger auto-sync on reconnect
 *
 * Features:
 * - Monitors browser online/offline events
 * - Detects metered connections (cellular data) via Network Information API
 * - Automatically syncs pending matches when connection is restored (WiFi only)
 * - Provides online status and connection type for UI conditional rendering
 * - Smart sync timing: avoid auto-sync on mobile data to save bandwidth
 *
 * @returns Object with online status, connection type, and manual sync function
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMetered, setIsMetered] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    // Detect connection type using Network Information API
    const updateConnectionInfo = () => {
      // @ts-ignore - Network Information API not in TS types yet
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (connection) {
        const type = connection.effectiveType || connection.type || 'unknown';
        const saveData = connection.saveData || false;

        // Consider connection metered if:
        // 1. effectiveType is 'slow-2g', '2g', '3g' (cellular)
        // 2. saveData mode is enabled
        // 3. type is 'cellular'
        const metered =
          saveData ||
          type === 'cellular' ||
          ['slow-2g', '2g', '3g'].includes(type);

        setIsMetered(metered);
        setConnectionType(type);

        console.log(`[useOnlineStatus] Connection type: ${type}, metered: ${metered}`);
      } else {
        // Network Information API not available - assume unmetered
        setIsMetered(false);
        setConnectionType('unknown');
      }
    };

    // Handler for when browser goes online
    const handleOnline = async () => {
      console.log('[useOnlineStatus] Network connection restored');
      setIsOnline(true);
      updateConnectionInfo();

      // Auto-sync pending matches when connection restored
      // ONLY if connection is NOT metered (WiFi) to save mobile data
      const pendingCount = await offlineQueue.getPendingCount();
      if (pendingCount > 0) {
        // @ts-ignore
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const currentlyMetered = connection?.saveData ||
          connection?.type === 'cellular' ||
          ['slow-2g', '2g', '3g'].includes(connection?.effectiveType || '');

        if (!currentlyMetered) {
          console.log(`[useOnlineStatus] Auto-syncing ${pendingCount} pending matches (WiFi detected)`);
          setIsSyncing(true);

          await offlineQueue.syncAll({
            onProgress: (completed, total) => {
              console.log(`[useOnlineStatus] Sync progress: ${completed}/${total}`);
            },
            onComplete: (succeeded, failed) => {
              console.log(`[useOnlineStatus] Sync complete: ${succeeded} succeeded, ${failed} failed`);
              setIsSyncing(false);
            },
          });
        } else {
          console.log(`[useOnlineStatus] Skipping auto-sync on metered connection (${pendingCount} pending)`);
        }
      }
    };

    // Handler for when browser goes offline
    const handleOffline = () => {
      console.log('[useOnlineStatus] Network connection lost');
      setIsOnline(false);
    };

    // Handler for connection type changes
    const handleConnectionChange = () => {
      updateConnectionInfo();
    };

    // Register event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection type changes (if API available)
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Initial connection check
    updateConnectionInfo();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  /**
   * Manually trigger sync of all pending matches
   * Useful for "Retry All" buttons in UI
   */
  const syncNow = async () => {
    if (!isOnline) {
      console.warn('[useOnlineStatus] Cannot sync while offline');
      return;
    }

    setIsSyncing(true);
    await offlineQueue.syncAll({
      onComplete: () => {
        setIsSyncing(false);
      },
    });
  };

  return {
    isOnline,
    isSyncing,
    isMetered,
    connectionType,
    syncNow,
  };
}
