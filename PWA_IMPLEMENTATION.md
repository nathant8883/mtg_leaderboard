# PWA Offline Implementation Plan

**Project**: Pod Pal - MTG Commander Tracker
**Started**: 2025-10-19
**Status**: In Progress (Phase 1-5 Complete, 83% done)

---

## Overview
Transform MTG Leaderboard into a fully offline-capable Progressive Web App with intelligent sync, conflict resolution, and optimistic UI updates.

## Core Technical Decisions
- ✅ **vite-plugin-pwa** with Workbox for caching (not queue management)
- ✅ **Manual IndexedDB queue** using Dexie.js (better control than Background Sync API)
- ✅ **Hash-based deduplication** with 5-minute window
- ✅ **Optimistic UI** with immediate feedback and undo capability
- ✅ **Exponential backoff** retry with per-error-code strategies (implemented in Phase 2)
- ✅ **ID-based conflict resolution** (not name-based) - Completed Phase 4
- ✅ **Cache warmup strategy** - Pre-fetches critical API data on SW registration (implemented 2025-10-19)

---

## Implementation Status

### ✅ Phase 1: PWA Setup & Caching (COMPLETED)
**Duration**: 2-3 hours
**Completed**: 2025-10-19

#### Tasks Completed:
- [x] Install `vite-plugin-pwa` and `dexie` dependencies
- [x] Create PWA manifest configuration in `vite.config.ts`
  - App name: "Pod Pal - MTG Commander Tracker"
  - Theme color: #667eea
  - Background: #141517
  - Display: standalone
- [x] Configure Workbox with `skipWaiting` and `clientsClaim`
- [x] Setup runtime caching strategies:
  - Players API: `StaleWhileRevalidate` (24h cache)
  - Decks API: `StaleWhileRevalidate` (24h cache)
- [x] Generate PWA icons (192x192, 512x512) - SVG placeholders
  - Location: `/frontend/public/icons/`
  - Note: Convert to PNG for production

#### Files Modified:
- `frontend/package.json` - Added vite-plugin-pwa@^0.21.1, dexie@^4.0.10
- `frontend/vite.config.ts` - Added VitePWA plugin configuration

#### Files Created:
- `frontend/public/icons/icon-192x192.svg`
- `frontend/public/icons/icon-512x512.svg`
- `frontend/public/icons/README.md` - Icon conversion instructions

---

### ✅ Phase 2: IndexedDB Queue System (COMPLETED)
**Duration**: 3-4 hours
**Completed**: 2025-10-19

#### Tasks Completed:
- [x] Create TypeScript types for queue (`queueTypes.ts`)
- [x] Create match hashing utility (`matchHash.ts`)
- [x] Create Dexie database schema and `offlineQueue.ts` service
- [x] Implement hash-based deduplication in `addMatch()`
- [x] Implement queue methods:
  - `getPendingMatches()`
  - `markSynced()`
  - `deleteMatch()`
  - `syncMatch()`
  - `syncAll()`
- [x] Add `onAllSynced()` callback system for SW updates
- [x] Implement exponential backoff with 30s cap

#### Queue Schema:
```typescript
interface QueuedMatch {
  id: string;  // UUID v4 for client-side tracking
  matchData: CreateMatchRequest;
  metadata: {
    queuedAt: number;        // When user created match
    submittedAt?: number;    // When sync was attempted
    playerSnapshots: {id: string, name: string}[];
    deckSnapshots: {id: string, name: string}[];
  };
  status: 'pending' | 'syncing' | 'error';
  retryCount: number;
  lastError?: {
    code: number;
    message: string;
    timestamp: number;
  };
}
```

#### Files Created:
- `frontend/src/types/queueTypes.ts` - Complete type definitions for queue system
- `frontend/src/utils/matchHash.ts` - SHA-256 hash generation for deduplication
- `frontend/src/services/offlineQueue.ts` - Full Dexie database and queue service implementation

#### Dependencies Added:
- `uuid@latest` - UUID v4 generation for client-side match IDs
- `@types/uuid@latest` - TypeScript types for uuid package

---

### ✅ Phase 3: Optimistic UI Flow (COMPLETED)
**Duration**: 2-3 hours
**Completed**: 2025-10-19

#### Tasks Completed:
- [x] Create `useOnlineStatus` hook with auto-sync on reconnect
- [x] Update App.tsx with 10-step optimistic flow:
  1. Generate tempId (UUID via crypto.randomUUID())
  2. Add to IndexedDB queue with deduplication check
  3. Immediately update React state with pending status
  4. Show "Match saved (offline/syncing)" toast with undo button
  5. On sync success: replace tempId with server ID
  6. Update status to 'synced' (remove from pending state)
  7. Show "Match synced" toast
  8. On undo: remove from queue
  9. Remove from UI state
  10. Show "Match removed" toast
- [x] Add pending match badges to RecentMatches
- [x] Implement 5-second undo with toast management
- [x] Add offline banner to header
- [x] Add PendingMatch type extending Match interface

#### Files Created:
- `frontend/src/hooks/useOnlineStatus.ts` - Hook for tracking online/offline status and triggering auto-sync

#### Files Modified:
- `frontend/src/App.tsx` - Complete optimistic UI implementation with pending match state management
- `frontend/src/components/RecentMatches.tsx` - Added pending match detection and badges with spinner icon

#### Implementation Highlights:
- **Auto-sync on reconnect**: useOnlineStatus hook monitors browser online/offline events
- **Deduplication**: Hash-based duplicate detection prevents double submissions
- **Undo functionality**: 5-second window with toast dismiss and queue cleanup
- **Pending indicators**: Orange-bordered cards with spinning loader and "Syncing..." badge
- **Offline banner**: Persistent banner at top of app when offline
- **TypeScript safety**: Type guards (`isPendingMatch`) ensure type-safe pending detection

---

### ✅ Phase 4: Sync & Error Handling (COMPLETED)
**Duration**: 4-5 hours
**Completed**: 2025-10-19

#### Tasks Completed:
- [x] Create ERROR_STRATEGIES object with exponential backoff (already in Phase 2)
- [x] Implement `syncMatch()` with comprehensive error handling (already in Phase 2)
- [x] Build conflict detection (ID-based, validates players/decks still exist)
- [x] Create SyncQueue component with progress tracking
- [x] Add user action handlers:
  - `edit` - Show edit button (placeholder for future implementation)
  - `reauth` - Redirect to login page
  - `remove` - Delete match from queue
  - `resolve` - Show remove button for conflict resolution
- [x] Add sync queue button in header with pending count badge
- [x] Implement polling for pending count updates
- [x] Add auto-refresh of queue and matches after sync operations

#### Error Strategies:
```typescript
const ERROR_STRATEGIES = {
  400: { retry: false, userAction: 'edit', message: 'Invalid match data' },
  401: { retry: false, userAction: 'reauth', message: 'Please log in again' },
  404: { retry: false, userAction: 'remove', message: 'Player or deck deleted' },
  409: { retry: false, userAction: 'resolve', message: 'Duplicate match' },
  429: { retry: true, backoff: 'exponential', message: 'Rate limited' },
  500: { retry: true, maxAttempts: 3, message: 'Server error' },
  503: { retry: true, maxAttempts: 5, message: 'Service unavailable' },
  network: { retry: true, maxAttempts: Infinity, message: 'No connection' }
};
```

#### Files Created:
- `frontend/src/components/SyncQueue.tsx` - Full queue management UI with error handling

#### Files Modified:
- `frontend/src/services/offlineQueue.ts` - Added ID-based conflict detection to syncMatch()
- `frontend/src/App.tsx` - Integrated SyncQueue component with header button and polling

#### Implementation Highlights:
- **Conflict Detection**: Validates all player IDs and deck IDs before syncing, provides detailed error messages
- **SyncQueue Component**:
  - Real-time queue display with 2-second polling
  - Status indicators (pending, syncing, error) with appropriate icons
  - Error messages with color-coded borders
  - Action buttons based on error strategy (retry, edit, reauth, remove)
  - Retry count display
  - Individual and bulk retry operations
- **Header Integration**:
  - Conditional "Sync Queue" button (only shows when pendingCount > 0)
  - Red notification badge with pending count
  - Orange color scheme matching offline theme
- **Auto-refresh**: Pending count updates every 3 seconds, refreshes after sync operations

---

### ✅ Phase 5: Polish & Edge Cases (COMPLETED)
**Duration**: 2-3 hours
**Completed**: 2025-10-19
**Fixed**: 2025-10-19 - Removed aggressive auto-refresh behavior

#### Tasks Completed:
- [x] Implement SW update logic with queue awareness
- [x] Create offline banner and sync status indicators (already in Phase 3)
- [x] Create InstallPrompt component with iOS fallback
- [x] Add smart sync timing (mobile data detection)
- [x] Add bulk operations (clear all, delete all)
- [x] Add offline UI styles (already complete)
- [x] **FIX**: Changed `registerType` from 'autoUpdate' to 'prompt' to prevent forced refreshes
- [x] **FIX**: Disabled `skipWaiting` and `clientsClaim` to require user consent for SW updates
- [x] **FIX**: Removed auto-update after sync completion - now requires user click
- [x] **ENHANCEMENT**: Added cache warmup strategy - pre-fetches `/api/players` and `/api/decks` on SW registration

#### SW Update Logic Implemented:
- ✅ Checks for pending matches before updating
- ✅ Shows "Update available - will install after syncing N matches" message
- ✅ Uses `onAllSynced()` callback to detect sync completion
- ✅ Fallback: periodic check every 5 seconds
- ✅ Dismissible update prompt
- ✅ Manual update button (requires user click, no auto-refresh)
- ✅ **FIXED**: Changed from aggressive auto-update to user-controlled updates

#### Smart Sync Features:
- ✅ Network Information API integration
- ✅ Detects metered connections (cellular data)
- ✅ Auto-sync disabled on mobile data to save bandwidth
- ✅ Manual "Sync Now" button on mobile data warning banner
- ✅ Connection type monitoring with event listeners

#### Files Created:
- `frontend/src/hooks/useServiceWorkerUpdate.ts` - SW update hook with queue awareness
- `frontend/src/components/UpdatePrompt.tsx` - Update banner with different states
- `frontend/src/components/InstallPrompt.tsx` - PWA install prompt with iOS/Android support

#### Files Modified:
- `frontend/src/hooks/useOnlineStatus.ts` - Added mobile data detection, smart sync logic
- `frontend/src/components/SyncQueue.tsx` - Added "Delete All" bulk operation
- `frontend/src/App.tsx` - Integrated UpdatePrompt, InstallPrompt, mobile data warning banner
- `frontend/src/index.css` - Added slide-down animation for install prompt

#### Cache Warmup Strategy:
- ✅ Pre-fetches `/api/players` and `/api/decks` when SW is registered
- ✅ Runs automatically on first install (no user interaction needed)
- ✅ Ensures offline functionality works even if user goes offline immediately after install
- ✅ Non-blocking: warmup failures are logged but don't prevent app from working
- ✅ Environment-aware: Uses `localhost:7777` in dev mode, same-origin in production
- ✅ CORS-enabled for development cross-origin requests
- ✅ Uses `import.meta.env.DEV` for clean environment detection

#### Implementation Highlights:
- **UpdatePrompt Component**:
  - Queue-aware: waits for pending matches to sync before updating SW
  - Two states: "Waiting for sync" and "Ready to update"
  - Force update option for immediate refresh
  - Dismissible with localStorage persistence
- **InstallPrompt Component**:
  - Platform detection (iOS vs Chrome/Edge/Android)
  - iOS: Manual instructions with Share button + Add to Home Screen
  - Chrome/Android: Native install prompt
  - Auto-detects if app is already installed (standalone mode)
  - Dismissible with localStorage persistence (3-second delay before showing)
- **Smart Sync Timing**:
  - Network Information API for connection type detection
  - Metered connection detection (cellular, 2G/3G, saveData mode)
  - Auto-sync only on WiFi/unmetered connections
  - Mobile data warning banner with manual sync button
- **Bulk Operations**:
  - "Delete All" button in SyncQueue footer
  - Confirmation dialog to prevent accidental deletions
  - Clears entire IndexedDB queue

---

### ⏳ Phase 6: Testing & Bug Fixes
**Duration**: 2-3 hours
**Status**: In Progress

#### Critical Bug Fix (2025-10-19)
**Issue**: MatchTracker component was bypassing offline queue system
- **Problem**: `MatchTracker.tsx` (live game tracker) was making direct API calls via `matchApi.create()`
- **Symptom**: "Failed to save match: Network Error" when saving matches offline
- **Root Cause**: MatchTracker wasn't integrated with the PWA offline infrastructure
- **Fix Applied**:
  - Added imports: `toast`, `offlineQueue`, `useOnlineStatus`, `playerApi`, `deckApi`, `Player`, `Deck`
  - Added `useOnlineStatus` hook to detect online/offline state
  - Added state for players/decks and loaded them on mount for snapshot creation
  - Replaced direct `matchApi.create()` call with offline queue flow:
    - Adds match to IndexedDB queue
    - Shows success toast based on online status
    - Attempts immediate sync if online
    - Queues for later sync if offline
  - Replaced `alert()` calls with `toast()` notifications
- **Files Modified**: `frontend/src/pages/MatchTracker.tsx`
- **Result**: MatchTracker now supports full offline functionality with queue management

#### Test Scenarios:
- [ ] **Cache Warmup**: Verify players/decks cached on first install (check console for "Cache warmup complete")
- [ ] **Immediate Offline**: Install PWA, go offline before opening, verify match form works
- [ ] **Network throttling**: Test offline mode and slow 3G
- [ ] **Error scenarios**: Test all error codes (400, 401, 404, 409, 429, 500, 503, network)
- [ ] **Multiple tabs**: Open app in multiple tabs simultaneously
- [ ] **IndexedDB quota**: Test quota handling with large datasets
- [ ] **Clock skew**: Test with system clock changes
- [ ] **Service worker lifecycle**: Test update, activation, and user-controlled updates
- [ ] **Match deduplication**: Test hash collision prevention (submit same match multiple times)
- [ ] **Conflict resolution**: Test all conflict UI flows (edit, reauth, remove, resolve)
- [ ] **Undo functionality**: Test undo within 5-second window
- [ ] **Queue persistence**: Close browser, reopen, verify pending matches still exist
- [ ] **No forced refreshes**: Verify no automatic page reloads occur

---

## Total Timeline
**Estimated**: 15-21 hours (2-3 days of focused development)
**Completed**: ~15-17 hours (Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5)
**Remaining**: ~0-4 hours (Phase 6 - Testing)

---

## Key Architecture Decisions

### Why Manual IndexedDB Queue vs Workbox Background Sync?
- **Browser Support**: Background Sync API not supported in Safari/Firefox
- **Control**: More control over conflict resolution and retry logic
- **Metadata**: Can store rich metadata (snapshots, error details) with each queued match
- **User Actions**: Can implement edit/delete/resolve actions on queued items

### Why Hash-based Deduplication?
- Prevents duplicate submissions from multiple clicks
- 5-minute window catches accidental re-submissions
- More robust than UUID-only approach

### Why ID-based Conflict Resolution?
- Player/deck names can change while offline
- IDs are stable identifiers
- Only block sync if ID is missing (deleted entity)
- Name changes are informational, not blocking

---

## Production Checklist

Before deploying to production:
- [ ] Convert SVG icons to PNG (192x192, 512x512)
- [ ] Test PWA install on iOS Safari (different flow than Android/Chrome)
- [ ] Test offline functionality on mobile data
- [ ] Add analytics for offline usage patterns
- [ ] Set up monitoring for sync failures
- [ ] Document user-facing offline features in help section
- [ ] Test service worker updates with real users
- [ ] Verify IndexedDB quota limits for heavy users

---

## Notes

### Browser Compatibility
- **Service Worker**: Chrome 40+, Firefox 44+, Safari 11.1+, Edge 17+
- **IndexedDB**: Universal support in modern browsers
- **Background Sync API**: Chrome 49+, Edge 79+ (NOT Safari/Firefox)
- **PWA Install**: Varies by platform (best on Android Chrome)

### Known Limitations
- iOS Safari PWA install requires manual "Add to Home Screen" (no prompt)
- Safari doesn't support Background Sync API (we handle with manual fallback)
- IndexedDB has storage quota limits (varies by browser, typically 50% of available disk)

### Future Enhancements
- Implement Periodic Background Sync for automatic retries (Chrome only)
- Add offline analytics to track usage patterns
- Implement delta sync for large datasets
- Add compression for queued match data
- Implement sync priority queue (winner matches first)
