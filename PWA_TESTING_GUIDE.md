# PWA Testing Guide - Phase 6

**Project**: Pod Pal - MTG Commander Tracker
**Testing Date**: 2025-10-19
**Tester**: [Your Name]

---

## Testing Environment Setup

### Prerequisites
- [ ] Development server running (`npm run dev` in frontend)
- [ ] Backend server running (port 7777)
- [ ] Chrome DevTools open (F12)
- [ ] Browser console visible for logs

### Browser Requirements
- [ ] Chrome/Edge (primary testing)
- [ ] Firefox (secondary)
- [ ] iOS Safari (mobile testing)
- [ ] Android Chrome (mobile testing)

---

## Test Suite 0: Cache Warmup (ADDED 2025-10-19)

### 0.1 First Install Cache Warmup

**Purpose**: Verify players and decks are cached automatically on SW registration.

**Steps:**
1. Clear all caches (see PWA_CACHE_CLEAR.md)
2. Open browser console (F12)
3. Load the app (http://localhost:5173)
4. Check console logs for:
   ```
   [SW] Service Worker registered: ...
   [SW] Warming up cache with critical endpoints...
   [SW] ✅ Players cached
   [SW] ✅ Decks cached
   [SW] Cache warmup complete - app ready for offline use
   ```

**Expected Results:**
- ✅ All warmup logs appear within 1-2 seconds
- ✅ Check DevTools → Application → Cache Storage:
  - `api-players-cache` should exist with `/api/players` entry
  - `api-decks-cache` should exist with `/api/decks` entry

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 0.2 Immediate Offline After First Install

**Purpose**: Verify app works offline immediately without browsing first.

**Steps:**
1. Clear all caches
2. Load the app (while online)
3. Wait for "Cache warmup complete" log
4. **Immediately** go offline (DevTools → Network → Offline checkbox)
5. Hard refresh (Ctrl+Shift+R)
6. Click "Record Match"
7. Check player and deck dropdowns

**Expected Results:**
- ✅ App loads offline successfully
- ✅ Player dropdown is populated with all players
- ✅ Deck dropdown is populated with all decks
- ✅ Match form is fully functional

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 1: Basic Offline Functionality

### 1.1 Offline Mode - Record Match While Offline

**Steps:**
1. Open Chrome DevTools → Network tab
2. Check "Offline" checkbox (top of Network tab)
3. Navigate to app (should still load from cache)
4. Click "Record Match" button
5. Fill in match details with 3+ players
6. Submit the match

**Expected Results:**
- ✅ Match form should submit successfully
- ✅ Toast shows "Match saved offline" with Undo button
- ✅ Match appears in Recent Matches with orange border and "Syncing..." badge
- ✅ Spinner icon visible on pending match card
- ✅ Match is stored in IndexedDB (check Application → IndexedDB → OfflineQueueDB)
- ✅ Sync Queue button appears in header with badge count (1)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 1.2 Reconnect - Auto-Sync on WiFi

**Steps:**
1. With match still pending from 1.1
2. Uncheck "Offline" in DevTools (simulate reconnect)
3. Wait 2-3 seconds

**Expected Results:**
- ✅ Console logs: `[useOnlineStatus] Network connection restored`
- ✅ Console logs: `[useOnlineStatus] Auto-syncing 1 pending matches (WiFi detected)`
- ✅ Match syncs automatically
- ✅ Toast shows "Match synced to server!"
- ✅ Orange border disappears from match card
- ✅ Sync Queue button badge count decreases to 0
- ✅ Match appears in Recent Matches with normal styling

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 1.3 Slow 3G Connection - Throttling

**Steps:**
1. DevTools → Network tab → Throttling dropdown
2. Select "Slow 3G" (not "Offline")
3. Record a new match
4. Submit and observe behavior

**Expected Results:**
- ✅ Match queues immediately (optimistic UI)
- ✅ Sync attempt takes 5-10 seconds
- ✅ Eventually syncs successfully or times out with retry
- ✅ No UI freeze during slow network

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 2: Optimistic UI & Undo

### 2.1 Undo Within 5-Second Window

**Steps:**
1. Ensure you're online
2. Record a match
3. Click Submit
4. Immediately click "Undo" button in toast (within 5 seconds)

**Expected Results:**
- ✅ Match immediately removed from UI
- ✅ Toast shows "Match removed"
- ✅ Match deleted from IndexedDB queue
- ✅ Match does NOT appear in Recent Matches after page refresh
- ✅ Pending count remains 0

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 2.2 Undo After 5-Second Window

**Steps:**
1. Record a match
2. Wait 6+ seconds (let toast auto-dismiss)
3. Try to undo (should not be possible)

**Expected Results:**
- ✅ After 5 seconds, toast auto-dismisses
- ✅ Undo button no longer available
- ✅ Match stays in queue/syncs normally
- ✅ Match visible in Recent Matches

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 3: Deduplication

### 3.1 Duplicate Match Prevention (5-Minute Window)

**Steps:**
1. Go offline (DevTools → Network → Offline)
2. Record a match with specific players/decks (remember the details)
3. Submit the match
4. Immediately record THE SAME match again (same players, same winner)
5. Submit the duplicate

**Expected Results:**
- ✅ First match: Success toast, appears in Recent Matches
- ✅ Second match: Toast shows "This match was already recorded recently"
- ✅ Second match NOT added to queue (only 1 match in IndexedDB)
- ✅ Sync Queue shows only 1 pending match

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 3.2 Different Match - Should NOT Deduplicate

**Steps:**
1. Still offline
2. Record a match with players A, B, C (winner: A)
3. Submit
4. Record a match with players A, B, C (winner: B) ← different winner
5. Submit

**Expected Results:**
- ✅ Both matches accepted
- ✅ 2 separate pending matches in queue
- ✅ Both appear in Recent Matches

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 4: Error Handling & Sync Queue UI

### 4.1 Error 404 - Player/Deck Deleted

**Setup:**
1. Create a test player in Admin Panel (note the ID)
2. Create a test deck for that player
3. Go offline
4. Record a match with that player/deck
5. Go back online
6. In Admin Panel, DELETE that player (before match syncs)

**Steps:**
1. Open Sync Queue modal
2. Wait for sync attempt (or click "Retry All Failed")

**Expected Results:**
- ✅ Match fails with 404 error
- ✅ Error message: "Player or deck no longer exists"
- ✅ Red border around match card in Sync Queue
- ✅ "Remove" button shown (userAction: 'remove')
- ✅ Clicking Remove deletes match from queue
- ✅ Console logs: `[OfflineQueue] Conflict detected for match`

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 4.2 Network Error - No Internet

**Steps:**
1. Record a match while online (but immediately go offline before it syncs)
2. Open Sync Queue modal
3. Click "Retry" on the failed match (while still offline)

**Expected Results:**
- ✅ Error code: 0 (network error)
- ✅ Error message: "No internet connection"
- ✅ Error strategy: `retry: true, maxAttempts: Infinity`
- ✅ Retry button remains available
- ✅ Retry count increments with each attempt
- ✅ Console logs: `[OfflineQueue] Will retry match...`

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 4.3 Bulk Operations - Delete All

**Steps:**
1. Go offline
2. Record 3 different matches (all queued)
3. Open Sync Queue modal
4. Click "Delete All" button in footer
5. Confirm the dialog

**Expected Results:**
- ✅ Confirmation dialog shows: "Are you sure you want to delete all 3 pending matches?"
- ✅ After confirm, all matches removed from queue
- ✅ Sync Queue modal closes automatically
- ✅ Sync Queue button badge disappears (count = 0)
- ✅ Recent Matches no longer shows pending matches
- ✅ IndexedDB OfflineQueueDB is empty

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 5: Smart Sync Timing (Mobile Data Detection)

### 5.1 Simulate Mobile Data - Auto-Sync Disabled

**Note:** Network Information API may not be available in desktop Chrome. Test on real mobile device or use Chrome DevTools Device Emulation.

**Steps (Desktop Simulation):**
1. Open DevTools → Console
2. Run:
   ```javascript
   // Override connection object (simulation)
   Object.defineProperty(navigator, 'connection', {
     value: {
       effectiveType: '3g',
       type: 'cellular',
       saveData: false
     },
     writable: true
   });
   ```
3. Go offline, record a match
4. Go back online
5. Observe behavior

**Expected Results:**
- ✅ Console logs: `[useOnlineStatus] Connection type: 3g, metered: true`
- ✅ Console logs: `[useOnlineStatus] Skipping auto-sync on metered connection`
- ✅ Mobile data warning banner appears (blue/purple theme)
- ✅ Banner text: "1 match pending. Auto-sync paused to save mobile data."
- ✅ "Sync Now" button visible in banner
- ✅ Clicking "Sync Now" triggers immediate sync

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 5.2 Simulate WiFi - Auto-Sync Enabled

**Steps:**
1. Open DevTools → Console
2. Run:
   ```javascript
   // Override connection object (simulation)
   Object.defineProperty(navigator, 'connection', {
     value: {
       effectiveType: '4g',
       type: 'wifi',
       saveData: false
     },
     writable: true
   });
   ```
3. Go offline, record a match
4. Go back online
5. Observe behavior

**Expected Results:**
- ✅ Console logs: `[useOnlineStatus] Connection type: 4g, metered: false`
- ✅ Console logs: `[useOnlineStatus] Auto-syncing 1 pending matches (WiFi detected)`
- ✅ No mobile data warning banner
- ✅ Match syncs automatically
- ✅ Toast shows "Match synced to server!"

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 6: Service Worker Updates

### 6.1 SW Update With Pending Matches

**Steps:**
1. Go offline, record 2 matches (both pending)
2. Make a small change to frontend code (e.g., add console.log)
3. Save the file (triggers Vite rebuild)
4. Wait 10-20 seconds

**Expected Results:**
- ✅ UpdatePrompt banner appears at bottom of screen
- ✅ Purple/blue gradient background
- ✅ Spinner icon spinning
- ✅ Text: "Update available - Will install after syncing 2 matches"
- ✅ "Update Now" button available (force update)
- ✅ Clicking "Update Now" immediately refreshes app
- ✅ OR: Go online, wait for matches to sync, then update installs automatically

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 6.2 SW Update With No Pending Matches

**Steps:**
1. Ensure queue is empty (no pending matches)
2. Make a small change to frontend code
3. Save the file
4. Wait 10-20 seconds

**Expected Results:**
- ✅ UpdatePrompt banner appears
- ✅ Alert/info icon (not spinner)
- ✅ Text: "App update available - Click to refresh and get the latest features"
- ✅ "Refresh App" button with refresh icon
- ✅ Clicking "Refresh App" immediately reloads page
- ✅ New code takes effect after reload

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 7: Install Prompt

### 7.1 Chrome/Android - Native Install Prompt

**Setup:** Test on Chrome desktop or Android device (not in standalone mode)

**Steps:**
1. Open app in Chrome (not installed)
2. Wait 3 seconds

**Expected Results:**
- ✅ InstallPrompt banner appears at top of screen (slides down)
- ✅ Download icon and "Install Pod Pal" title
- ✅ "Get the full app experience" subtitle
- ✅ Description: "Install the app for offline access..."
- ✅ "Install App" button with download icon
- ✅ Clicking "Install App" triggers native install prompt
- ✅ After install, banner doesn't show again
- ✅ X button dismisses permanently (stored in localStorage)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 7.2 iOS Safari - Manual Install Instructions

**Setup:** Test on iPhone/iPad Safari (not in standalone mode)

**Steps:**
1. Open app in Safari on iOS device
2. Wait 3 seconds

**Expected Results:**
- ✅ InstallPrompt banner appears
- ✅ "Install Pod Pal" title
- ✅ "To install on iOS:" heading
- ✅ Step 1: "Tap the Share button below" (with Share icon)
- ✅ Step 2: "Scroll down and tap Add to Home Screen" (with Plus icon)
- ✅ Step 3: "Tap 'Add' in the top right corner"
- ✅ Blue info box with instructions
- ✅ X button dismisses
- ✅ After dismissing, doesn't show again (localStorage)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 7.3 Already Installed - No Prompt

**Steps:**
1. Install app (either method above)
2. Open app in standalone mode (from home screen icon)
3. Observe behavior

**Expected Results:**
- ✅ InstallPrompt banner does NOT appear
- ✅ Console logs: App detected as standalone mode
- ✅ App runs normally without install prompt

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 8: Edge Cases

### 8.1 Multiple Tabs - Sync Race Condition

**Steps:**
1. Open app in Tab 1
2. Open app in Tab 2 (same browser)
3. Go offline in BOTH tabs
4. Record match A in Tab 1
5. Record match B in Tab 2
6. Go back online in both tabs
7. Observe sync behavior

**Expected Results:**
- ✅ Both matches queue independently
- ✅ Both matches sync successfully (no race condition)
- ✅ No duplicate syncs
- ✅ Both tabs update after sync completes
- ✅ Both tabs show same Recent Matches list

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 8.2 Queue Persistence - Browser Restart

**Steps:**
1. Go offline
2. Record 2 matches (both pending)
3. Close browser completely (not just tab)
4. Reopen browser
5. Navigate to app

**Expected Results:**
- ✅ App loads from cache (service worker)
- ✅ Pending matches still visible in Recent Matches
- ✅ Sync Queue button shows badge with count (2)
- ✅ Opening Sync Queue shows both pending matches
- ✅ IndexedDB data persisted across restart
- ✅ Going online triggers auto-sync

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 8.3 IndexedDB Quota - Large Queue

**Steps:**
1. Go offline
2. Record 50+ matches (script this if needed)
3. Check IndexedDB size (DevTools → Application → IndexedDB)

**Expected Results:**
- ✅ All matches stored successfully
- ✅ No quota errors in console
- ✅ App remains responsive
- ✅ Sync Queue displays all matches
- ✅ Going online syncs all matches sequentially

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 9: Conflict Resolution

### 9.1 ID-Based Conflict Detection

**Setup:**
1. Go offline
2. Record match with players A, B, C
3. Note player A's ID
4. Go back online (but don't let it sync yet - quickly go offline again)
5. In another tab, delete player A from Admin Panel
6. Go back online in first tab

**Steps:**
1. Open Sync Queue
2. Click "Retry" on the pending match

**Expected Results:**
- ✅ Match fails with 404 error
- ✅ Error message: "Players deleted: [Player A Name]"
- ✅ Console logs detailed conflict info
- ✅ userAction: 'remove'
- ✅ "Remove" button shown
- ✅ Match cannot be synced (permanently failed)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

### 9.2 Name Changes - Should NOT Block Sync

**Steps:**
1. Go offline
2. Record match with player "Alice"
3. Don't let it sync
4. In Admin Panel, rename "Alice" to "Alice Smith"
5. Go back online
6. Let match sync

**Expected Results:**
- ✅ Match syncs successfully
- ✅ Match uses player ID (not name) for sync
- ✅ Recent Matches shows updated name "Alice Smith"
- ✅ No conflict error
- ✅ Console logs: Match synced successfully

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Suite 10: Console Logging & Debugging

### 10.1 Verify Logging Levels

**Steps:**
1. Open DevTools Console
2. Perform various actions (offline, record match, sync, error)
3. Review console output

**Expected Results:**
- ✅ `[useOnlineStatus]` logs for network events
- ✅ `[OfflineQueue]` logs for queue operations
- ✅ `[SW]` logs for service worker events
- ✅ `[Install]` logs for install prompt
- ✅ Clear, readable log messages
- ✅ No excessive logging (not spammy)
- ✅ No unhandled errors or warnings

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes: ___________________________________________

---

## Test Results Summary

| Test Suite | Total Tests | Passed | Failed | Pass Rate |
|-----------|-------------|--------|--------|-----------|
| 1. Basic Offline | 3 | _ | _ | _% |
| 2. Optimistic UI | 2 | _ | _ | _% |
| 3. Deduplication | 2 | _ | _ | _% |
| 4. Error Handling | 3 | _ | _ | _% |
| 5. Smart Sync | 2 | _ | _ | _% |
| 6. SW Updates | 2 | _ | _ | _% |
| 7. Install Prompt | 3 | _ | _ | _% |
| 8. Edge Cases | 3 | _ | _ | _% |
| 9. Conflict Resolution | 2 | _ | _ | _% |
| 10. Console Logging | 1 | _ | _ | _% |
| **TOTAL** | **23** | **_** | **_** | **_%** |

---

## Critical Issues Found

1. **[Issue Title]**
   - **Severity**: Critical / High / Medium / Low
   - **Description**: _________________________
   - **Steps to Reproduce**: _________________
   - **Expected vs Actual**: _________________
   - **Status**: Open / Fixed / Won't Fix

---

## Non-Critical Issues / Improvements

1. **[Suggestion]**
   - **Description**: _________________________
   - **Priority**: High / Medium / Low

---

## Browser Compatibility

| Browser | Version | Offline | Sync | Install | Notes |
|---------|---------|---------|------|---------|-------|
| Chrome Desktop | _ | [ ] | [ ] | [ ] | _____ |
| Edge Desktop | _ | [ ] | [ ] | [ ] | _____ |
| Firefox Desktop | _ | [ ] | [ ] | [ ] | _____ |
| Safari iOS | _ | [ ] | [ ] | [ ] | _____ |
| Chrome Android | _ | [ ] | [ ] | [ ] | _____ |

---

## Testing Sign-Off

**Tester**: ___________________
**Date**: ___________________
**Overall Assessment**: Pass / Fail / Pass with Issues
**Ready for Production**: Yes / No / With Fixes

**Additional Notes:**
________________________________________________________________
________________________________________________________________
________________________________________________________________
