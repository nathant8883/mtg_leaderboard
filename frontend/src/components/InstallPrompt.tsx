import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

/**
 * InstallPrompt Component
 *
 * Prompts users to install the PWA with platform-specific instructions
 *
 * Features:
 * - Standard PWA install prompt (Chrome/Edge/Android)
 * - iOS Safari fallback with manual instructions
 * - Detects if app is already installed
 * - Dismissible with localStorage persistence
 *
 * Platform Detection:
 * - iOS Safari: Show manual "Add to Home Screen" instructions
 * - Chrome/Edge/Android: Show native install prompt
 * - Already installed: Don't show prompt
 */
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if app is already installed (running in standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check if user has dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    setIsDismissed(dismissed === 'true');

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event (Chrome/Edge/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show prompt for iOS after a delay (if not dismissed and not standalone)
    if (iOS && !standalone && !dismissed) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[Install] User accepted the install prompt');
    } else {
      console.log('[Install] User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
    setIsDismissed(true);
  };

  // Don't show if app is already installed, dismissed, or prompt not ready
  if (isStandalone || isDismissed || !showPrompt) return null;

  return (
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 max-w-md w-[calc(100%-32px)] bg-gradient-card border border-[#2C2E33] rounded-[12px] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[1000] animate-slide-down">
      {/* Close Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-[4px] hover:bg-[#25262B] transition-colors text-[#909296] hover:text-white"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      {/* iOS Instructions */}
      {isIOS ? (
        <div className="pr-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-purple rounded-[8px] flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base m-0">Install Pod Pal</h3>
              <p className="text-[#909296] text-xs m-0">Get the full app experience</p>
            </div>
          </div>

          <div className="bg-[rgba(102,126,234,0.1)] border border-[rgba(102,126,234,0.2)] rounded-[8px] p-3">
            <p className="text-white text-sm mb-2 font-medium">To install on iOS:</p>
            <ol className="text-[#C1C2C5] text-sm space-y-2 pl-5 m-0">
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1.5">
                  1. Tap the
                  <Share className="w-4 h-4 inline" />
                  <span className="font-medium">Share</span> button below
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1.5">
                  2. Scroll down and tap
                  <Plus className="w-4 h-4 inline" />
                  <span className="font-medium">Add to Home Screen</span>
                </span>
              </li>
              <li>3. Tap "Add" in the top right corner</li>
            </ol>
          </div>
        </div>
      ) : (
        // Standard Install Prompt (Chrome/Edge/Android)
        <div className="pr-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-purple rounded-[8px] flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base m-0">Install Pod Pal</h3>
              <p className="text-[#909296] text-xs m-0">Access instantly from your home screen</p>
            </div>
          </div>

          <p className="text-[#C1C2C5] text-sm mb-3">
            Install the app for offline access, faster loading, and a native app experience.
          </p>

          <button
            onClick={handleInstall}
            className="w-full px-4 py-2.5 bg-gradient-purple text-white rounded-[8px] font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Install App
          </button>
        </div>
      )}
    </div>
  );
}

export default InstallPrompt;
