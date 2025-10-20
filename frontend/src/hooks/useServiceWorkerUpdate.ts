import { useEffect, useState } from 'react';
// @ts-ignore - Virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react';
import offlineQueue from '../services/offlineQueue';

/**
 * Custom hook for managing service worker updates with queue awareness
 *
 * Features:
 * - Detects when a new service worker is available
 * - Checks for pending matches before updating
 * - Shows user-friendly messages about update status
 * - Uses onAllSynced callback to trigger update after sync completes
 * - Fallback: periodic check every 5 seconds
 */
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    async onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration) {
      console.log('[SW] Service Worker registered:', swUrl);

      // Warmup strategy: Pre-fetch and cache critical API endpoints
      // This ensures offline functionality works even on first install
      if (registration && registration.active) {
        try {
          console.log('[SW] Warming up cache with critical endpoints...');

          // Determine the API base URL
          // In dev mode, use backend URL directly (localhost:7777)
          // In production, use same origin (backend behind Nginx)
          const isDev = import.meta.env.DEV;
          const baseUrl = isDev ? 'http://localhost:7777' : window.location.origin;

          console.log(`[SW] Warmup using base URL: ${baseUrl} (dev mode: ${isDev})`);

          // Pre-fetch critical endpoints to populate cache
          await Promise.all([
            fetch(`${baseUrl}/api/players/`, {
              credentials: 'include',
              mode: isDev ? 'cors' : 'same-origin',
              headers: { 'Cache-Control': 'no-cache' }
            }).then(res => {
              if (res.ok) console.log('[SW] ✅ Players cached');
              else console.warn(`[SW] ⚠️  Players request returned ${res.status}`);
              return res;
            }).catch(err => console.warn('[SW] ⚠️  Players warmup failed:', err)),

            fetch(`${baseUrl}/api/decks/`, {
              credentials: 'include',
              mode: isDev ? 'cors' : 'same-origin',
              headers: { 'Cache-Control': 'no-cache' }
            }).then(res => {
              if (res.ok) console.log('[SW] ✅ Decks cached');
              else console.warn(`[SW] ⚠️  Decks request returned ${res.status}`);
              return res;
            }).catch(err => console.warn('[SW] ⚠️  Decks warmup failed:', err))
          ]);

          console.log('[SW] Cache warmup complete - app ready for offline use');
        } catch (error) {
          console.warn('[SW] Cache warmup error (non-critical):', error);
        }
      }

      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // 1 hour
      }
    },
    onRegisterError(error: Error) {
      console.error('[SW] Service Worker registration error:', error);
    },
  });

  // Check pending count when update is needed
  useEffect(() => {
    if (needRefresh) {
      checkPendingAndUpdate();
    }
  }, [needRefresh]);

  // Periodic check for pending matches while waiting for sync
  useEffect(() => {
    if (!waitingForSync) return;

    const interval = setInterval(async () => {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);

      if (count === 0) {
        console.log('[SW] Queue synced, ready to update');
        setWaitingForSync(false);
        // Don't auto-update, just change the prompt state
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [waitingForSync, updateServiceWorker]);

  // Register callback for when all matches are synced
  useEffect(() => {
    const callback = async () => {
      if (waitingForSync) {
        console.log('[SW] All matches synced via callback, ready to update');
        setWaitingForSync(false);
        // Don't auto-update, just change the prompt state
      }
    };

    offlineQueue.onAllSynced(callback);

    // Cleanup
    return () => {
      offlineQueue.clearSyncedCallbacks();
    };
  }, [waitingForSync, updateServiceWorker]);

  const checkPendingAndUpdate = async () => {
    const count = await offlineQueue.getPendingCount();
    setPendingCount(count);

    if (count > 0) {
      // Matches pending - wait for sync
      console.log(`[SW] Update available but ${count} matches pending sync`);
      setUpdateAvailable(true);
      setWaitingForSync(true);
    } else {
      // No pending matches - show prompt instead of auto-updating
      console.log('[SW] Update available, no pending matches - showing prompt');
      setUpdateAvailable(true);
      // Don't auto-update, let user click the button
    }
  };

  const forceUpdate = async () => {
    console.log('[SW] Force updating service worker');
    setWaitingForSync(false);
    await updateServiceWorker(true);
  };

  const dismissUpdate = () => {
    console.log('[SW] Update dismissed');
    setNeedRefresh(false);
    setUpdateAvailable(false);
    setWaitingForSync(false);
  };

  return {
    updateAvailable,
    waitingForSync,
    pendingCount,
    forceUpdate,
    dismissUpdate,
  };
}
