# PWA Offline Testing Guide

**Project**: Pod Pal - MTG Commander Tracker
**Date**: 2025-10-19
**Purpose**: How to properly test offline functionality with Chrome DevTools

---

## Understanding Different "Offline" Modes

### ❌ DevTools Network Tab "Offline" (DON'T USE)
**Location**: DevTools → Network tab → "Offline" checkbox

**Problem**: Blocks network requests at the browser level BEFORE they reach the service worker
```
Browser → ❌ BLOCKED HERE → Service Worker (never reached)
```
**Result**: Service worker cache cannot intercept and serve cached responses
**Use Case**: None for PWA testing - too aggressive

---

### ✅ DevTools Application Tab "Offline" (RECOMMENDED)
**Location**: DevTools → Application tab → Service Workers section → "Offline" checkbox

**How it works**: Simulates offline mode at the service worker level
```
Browser → Service Worker (offline mode) → Serves from cache ✅
```
**Result**: Service worker cache works as designed
**Use Case**: **Primary method for testing PWA offline functionality**

---

### ✅ Real Network Toggle (PRODUCTION-LIKE)
**Methods**:
- Turn off WiFi
- Enable airplane mode
- Unplug ethernet cable

**How it works**: Requests reach service worker, network calls fail, cache serves
```
Browser → Service Worker → Network call fails → Cache fallback ✅
```
**Result**: Most realistic offline testing
**Use Case**: Final validation before production deployment

---

### ✅ Kill Backend Server (API-ONLY OFFLINE)
**Method**: Stop the backend server (port 7777)

**How it works**: Frontend + SW cache work, only API fails
```
Browser ✅ → Service Worker ✅ → Backend ❌ → Cache fallback ✅
```
**Result**: Tests API caching without affecting frontend assets
**Use Case**: Isolates API offline behavior

---

## Recommended Testing Procedure

### Test 1: Service Worker Cache (DevTools Method)

**Prerequisites**:
- Build and run production build: `npm run build && npm run preview`
- Backend running on port 7777
- Frontend at http://localhost:5173

**Steps**:
1. **Open Chrome at http://localhost:5173**
2. **Open DevTools** (F12)
3. **Go to Console tab** - Watch for cache warmup logs:
   ```
   [SW] Service Worker registered: /sw.js
   [SW] Warming up cache with critical endpoints...
   [SW] ✅ Players cached
   [SW] ✅ Decks cached
   [SW] Cache warmup complete - app ready for offline use
   ```
4. **Navigate to Match Tracker** - Verify players load
5. **Go to Application tab → Service Workers section**
6. **Check "Offline" checkbox** (in Service Workers panel, NOT Network tab)
7. **Refresh page** (F5)
8. **Navigate to Match Tracker again**
9. **Check Console** - Should see:
   ```
   [MatchTracker] Fetching players and decks...
   [MatchTracker] ✅ Loaded X players and Y decks
   [PlayerAssignment] Loaded X players
   ```
10. **Record a match and save**

**Expected Results**:
- ✅ Players appear in selection UI
- ✅ Match saves with toast: "📴 Match saved offline - will sync when online"
- ✅ Match appears in pending state with orange border
- ✅ "Sync Queue" button shows pending count
- ✅ Console shows no network errors (or errors are caught gracefully)

---

### Test 2: Backend Offline (Simplest)

**Steps**:
1. **Load app while online** at http://localhost:5173
2. **Wait for cache warmup** (check console logs)
3. **Navigate to Match Tracker** - Verify it works
4. **Stop the backend server**:
   ```bash
   # Find the backend process
   lsof -ti:7777 | xargs kill
   ```
5. **Refresh the page**
6. **Navigate to Match Tracker**
7. **Record and save a match**

**Expected Results**:
- ✅ App loads from cache (frontend assets cached)
- ✅ Players/decks load from cache (API responses cached)
- ✅ Match saves to IndexedDB queue
- ✅ Sync attempts fail gracefully (expected - backend is down)
- ✅ When you restart backend and go back online, matches sync automatically

---

### Test 3: Real Network Toggle (Most Realistic)

**Steps**:
1. **Load app while online** at http://localhost:5173
2. **Wait for cache warmup**
3. **Navigate to Match Tracker** - Verify it works
4. **Turn off WiFi** (or enable airplane mode)
5. **Refresh the page**
6. **Navigate to Match Tracker**
7. **Record and save a match**
8. **Turn WiFi back on**

**Expected Results**:
- ✅ Exact same behavior as Test 1
- ✅ When you go back online, auto-sync should trigger
- ✅ Pending match syncs to server automatically

---

## Common Issues & Solutions

### Issue: "Error loading players" in Console
**Symptom**: Console shows network errors when loading Match Tracker offline

**Possible Causes**:
1. Using DevTools Network tab "Offline" (use Service Workers "Offline" instead)
2. Cache warmup didn't complete before going offline
3. Service worker not registered properly

**Solution**:
- Verify cache warmup logs appeared
- Use Application → Service Workers "Offline" checkbox
- Check Service Workers panel shows "activated and running"

---

### Issue: No Players Appear in Match Tracker
**Symptom**: Match Tracker loads but player selection is empty

**Possible Causes**:
1. Cache warmup didn't run (page loaded while already offline)
2. API cache strategy not configured correctly
3. Went offline before visiting Match Tracker at least once

**Solution**:
- Always load app while ONLINE first
- Verify cache warmup logs in console
- Navigate to Match Tracker while online at least once
- Then test offline functionality

---

### Issue: Match Doesn't Save Offline
**Symptom**: Match form submission fails completely

**Possible Causes**:
1. MatchTracker not using offline queue (should be fixed)
2. IndexedDB quota exceeded
3. JavaScript error preventing queue write

**Solution**:
- Check console for JavaScript errors
- Verify "Match saved offline" toast appears
- Check Application → IndexedDB → OfflineQueueDB
- Verify queue entries are being created

---

## Verification Checklist

Before considering offline functionality complete, verify:

- [ ] Cache warmup logs appear on first load
- [ ] Service worker activates and runs
- [ ] Match Tracker loads players offline (DevTools SW "Offline" mode)
- [ ] Match Tracker loads players offline (real WiFi toggle)
- [ ] Match Tracker loads players offline (backend killed)
- [ ] Matches save to queue when offline
- [ ] Pending matches show in UI with orange border
- [ ] "Sync Queue" button shows pending count
- [ ] Auto-sync triggers when coming back online
- [ ] Manual "Retry All" works in Sync Queue modal
- [ ] Conflict detection works (404, 409 errors)
- [ ] Error handling works (network, server, auth errors)

---

## Key Files Reference

### Service Worker Configuration
**File**: `frontend/vite.config.ts`
- Cache strategies for `/api/players` and `/api/decks`
- StaleWhileRevalidate with 24h expiration

### Cache Warmup Logic
**File**: `frontend/src/hooks/useServiceWorkerUpdate.ts`
- Pre-fetches `/api/players` and `/api/decks` on SW registration
- Runs automatically on first load

### Offline Queue System
**File**: `frontend/src/services/offlineQueue.ts`
- IndexedDB storage using Dexie
- Queue management and sync logic
- Error handling and retry strategies

### Match Tracker Integration
**File**: `frontend/src/pages/MatchTracker.tsx`
- Uses offline queue for match saving
- Loads players/decks (served from cache when offline)

---

## Quick Reference Commands

```bash
# Build production PWA
npm run build

# Run production preview
npm run preview

# Stop backend (for testing)
lsof -ti:7777 | xargs kill

# Start backend
cd backend && uv run uvicorn app.main:app --reload --port 7777

# Clear all caches (fresh start)
# DevTools → Application → Clear storage → Clear site data

# View IndexedDB queue
# DevTools → Application → IndexedDB → OfflineQueueDB → queuedMatches

# View Service Worker cache
# DevTools → Application → Cache Storage → workbox-precache-* and workbox-runtime-*
```

---

## Testing Scenarios Summary

| Scenario | Method | Expected Result |
|----------|--------|-----------------|
| Load app offline first time | WiFi off → Load app | ❌ Won't work - need cache warmup |
| Load online, go offline, use | WiFi on → Cache warmup → WiFi off → Use app | ✅ Works perfectly |
| Load online, kill backend | Online → Cache warmup → Kill backend → Use app | ✅ Works perfectly |
| DevTools Network "Offline" | Network tab checkbox | ❌ Too aggressive - cache blocked |
| DevTools SW "Offline" | Application → SW checkbox | ✅ Works perfectly |
| Real WiFi toggle | Airplane mode / WiFi off | ✅ Most realistic test |

---

## Notes

- **First load must be online** - Cache warmup requires network access to fetch and cache data
- **DevTools Network "Offline" doesn't work** - Use Service Workers "Offline" instead
- **Real offline testing is best** - Final validation should use airplane mode or WiFi toggle
- **Cache persists across sessions** - Once cached, data available until cache expires (24h) or cleared
- **Match queue persists** - IndexedDB survives page refreshes and browser restarts
