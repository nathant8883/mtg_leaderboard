import { RefreshCw, X, Loader2, AlertCircle } from 'lucide-react';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

/**
 * UpdatePrompt Component
 *
 * Displays a banner when a service worker update is available
 * Shows different states:
 * - Waiting for sync: "Update available - will install after syncing N matches"
 * - Ready to update: "Update available - click to refresh"
 *
 * Features:
 * - Queue-aware: waits for pending matches to sync before updating
 * - Force update option: allows user to update immediately
 * - Dismissible: user can dismiss the prompt
 */
function UpdatePrompt() {
  const { updateAvailable, waitingForSync, pendingCount, forceUpdate, dismissUpdate } =
    useServiceWorkerUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[rgba(102,126,234,0.95)] backdrop-blur-[10px] border-t border-[rgba(102,126,234,0.3)] px-4 py-3 z-[1000] shadow-[0_-4px_16px_rgba(0,0,0,0.3)]">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Icon + Message */}
        <div className="flex items-center gap-3 flex-1">
          {waitingForSync ? (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
              <div className="text-white text-sm">
                <span className="font-semibold">Update available</span>
                <span className="opacity-90">
                  {' '}
                  - Will install after syncing {pendingCount} {pendingCount === 1 ? 'match' : 'matches'}
                </span>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
              <div className="text-white text-sm">
                <span className="font-semibold">App update available</span>
                <span className="opacity-90"> - Click to refresh and get the latest features</span>
              </div>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {waitingForSync ? (
            <button
              onClick={forceUpdate}
              className="px-3 py-1.5 bg-white text-[#667eea] rounded-[6px] text-sm font-semibold hover:bg-[#f0f0f0] transition-colors"
            >
              Update Now
            </button>
          ) : (
            <button
              onClick={forceUpdate}
              className="px-4 py-2 bg-white text-[#667eea] rounded-[6px] text-sm font-semibold hover:bg-[#f0f0f0] transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh App
            </button>
          )}
          <button
            onClick={dismissUpdate}
            className="p-2 rounded-[6px] hover:bg-[rgba(255,255,255,0.2)] transition-colors text-white"
            aria-label="Dismiss update"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdatePrompt;
