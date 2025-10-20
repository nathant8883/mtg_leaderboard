# PWA Offline Implementation Plan

**Project**: Pod Pal - MTG Commander Tracker
**Started**: 2025-10-19
**Status**: In Progress (Phase 1 Complete)

---

## Overview
Transform MTG Leaderboard into a fully offline-capable Progressive Web App with intelligent sync, conflict resolution, and optimistic UI updates.

## Core Technical Decisions
- ✅ **vite-plugin-pwa** with Workbox for caching (not queue management)
- ✅ **Manual IndexedDB queue** using Dexie.js (better control than Background Sync API)
- ⏳ **Hash-based deduplication** with 5-minute window
- ⏳ **ID-based conflict resolution** (not name-based)
- ⏳ **Optimistic UI** with immediate feedback and undo capability
- ⏳ **Exponential backoff** retry with per-error-code strategies

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

### ⏳ Phase 3: Optimistic UI Flow
**Duration**: 2-3 hours
**Status**: Not Started

#### Tasks:
- [ ] Create `useOnlineStatus` hook with auto-sync on reconnect
- [ ] Update MatchForm with 10-step optimistic flow:
  1. Generate tempId
  2. Add to IndexedDB queue
  3. Immediately update React state with pending status
  4. Show "Match saved (offline)" toast with undo button
  5. On sync success: replace tempId with server ID
  6. Update status to 'synced'
  7. Show "Match synced" toast
  8. On undo: remove from queue
  9. Remove from UI state
  10. Show "Match removed" toast
- [ ] Add pending match badges to RecentMatches
- [ ] Implement 5-second undo with toast management

#### Files to Create:
- `frontend/src/hooks/useOnlineStatus.ts`

#### Files to Modify:
- `frontend/src/components/MatchForm.tsx`
- `frontend/src/components/RecentMatches.tsx`

---

### ⏳ Phase 4: Sync & Error Handling
**Duration**: 4-5 hours
**Status**: Not Started

#### Tasks:
- [ ] Create ERROR_STRATEGIES object with exponential backoff
- [ ] Implement `syncMatch()` with comprehensive error handling
- [ ] Build conflict detection (ID-based, fetch current data from API)
- [ ] Create SyncQueue component with progress tracking
- [ ] Add user action handlers:
  - `edit` - Open modal to fix match data
  - `reauth` - Redirect to login, preserve queue
  - `remove` - Delete match from queue
  - `resolve` - Show conflict resolution UI

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

#### Files to Create:
- `frontend/src/components/SyncQueue.tsx`

#### Files to Modify:
- `frontend/src/services/offlineQueue.ts` - Add error handling

---

### ⏳ Phase 5: Polish & Edge Cases
**Duration**: 2-3 hours
**Status**: Not Started

#### Tasks:
- [ ] Implement SW update logic with queue awareness
- [ ] Create offline banner and sync status indicators
- [ ] Create InstallPrompt component with iOS fallback
- [ ] Add smart sync timing (mobile data detection)
- [ ] Add bulk operations (clear synced, delete all)
- [ ] Add offline UI styles to App.css

#### SW Update Logic:
- Check for pending matches before updating
- Show "Update available - will install after syncing" message
- Use `onAllSynced()` callback to trigger update
- Fallback: periodic check every 5 seconds

#### Files to Create:
- `frontend/src/components/InstallPrompt.tsx`

#### Files to Modify:
- `frontend/src/App.tsx` - Add offline banner, SW update handling
- `frontend/src/App.css` - Offline UI styles

---

### ⏳ Phase 6: Testing
**Duration**: 2-3 hours
**Status**: Not Started

#### Test Scenarios:
- [ ] Network throttling (offline mode, slow 3G)
- [ ] All error scenarios (400, 401, 404, 409, 429, 500, 503, network)
- [ ] Multiple tabs simultaneously
- [ ] IndexedDB quota handling
- [ ] Clock skew scenarios
- [ ] Service worker lifecycle (update, skipWaiting)
- [ ] Match deduplication (hash collision prevention)
- [ ] Conflict resolution UI flows
- [ ] Undo functionality within 5-second window
- [ ] Queue persistence across browser restarts

---

## Total Timeline
**Estimated**: 15-21 hours (2-3 days of focused development)
**Completed**: ~6 hours (Phase 1 + Phase 2)
**Remaining**: ~9-15 hours

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
