# PWA Cache Clearing Guide

Quick reference for clearing Service Worker and Cache Storage during development and testing.

---

## 🔧 FIX: Multiple Refresh Issue (2025-10-19)

**Problem**: App was forcing multiple page refreshes on load.

**Root Cause**: Aggressive auto-update configuration in `vite.config.ts`:
- `registerType: 'autoUpdate'` - Auto-installed updates without user consent
- `skipWaiting: true` - New service worker activated immediately
- `clientsClaim: true` - SW claimed all clients instantly

**Solution Applied**:
Changed to user-controlled updates:
```typescript
VitePWA({
  registerType: 'prompt',  // ✅ Requires user action
  workbox: {
    skipWaiting: false,    // ✅ Wait for user
    clientsClaim: false,   // ✅ Don't force control
  }
})
```

**After Applying Fix**: Clear old service worker cache using methods below, then hard refresh.

**Additional Fix (2025-10-19)**: Service worker dev mode now uses `localhost:7777` directly instead of trying to proxy through Vite. Uses `import.meta.env.DEV` for environment detection.

---

## Browser DevTools Console Method

### Quick Command (Copy & Paste)

```javascript
(async () => {
  // Unregister all service workers
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (let registration of registrations) {
    await registration.unregister();
  }

  // Clear all caches
  const cacheNames = await caches.keys();
  for (let cacheName of cacheNames) {
    await caches.delete(cacheName);
  }

  console.log(`✅ Cleared ${registrations.length} service worker(s)`);
  console.log(`✅ Cleared ${cacheNames.length} cache(s)`);
  console.log('Cache names deleted:', cacheNames);

  // Reload the page to start fresh
  location.reload();
})();
```

**How to use:**
1. Open browser DevTools Console (`F12` or `Ctrl+Shift+J` / `Cmd+Option+J`)
2. Paste the code above
3. Press Enter
4. Page will auto-reload with clean caches

---

## Bookmarklet (One-Click Clear)

Create a bookmark with this URL for instant cache clearing:

```javascript
javascript:(async()=>{const r=await navigator.serviceWorker.getRegistrations();for(let x of r)await x.unregister();const c=await caches.keys();for(let n of c)await caches.delete(n);alert(`Cleared ${r.length} SW, ${c.length} caches`);location.reload();})();
```

**Setup:**
1. Create a new bookmark in your browser
2. Set the URL/Location to the code above
3. Name it "Clear PWA Cache"
4. Click whenever you need to clear caches

---

## Playwright Testing Method

For automated testing with Playwright MCP tools:

```javascript
// Use with mcp__playwright__browser_evaluate
async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (let registration of registrations) {
    await registration.unregister();
  }

  const cacheNames = await caches.keys();
  for (let cacheName of cacheNames) {
    await caches.delete(cacheName);
  }

  return {
    unregistered: registrations.length,
    cachesCleared: cacheNames.length
  };
}
```

---

## When to Clear PWA Caches

✅ **Always clear when:**
- After changing TypeScript config (`tsconfig.json`, `tsconfig.app.json`)
- After fixing import/export errors (especially `import type` changes)
- After modifying Service Worker config (`vite.config.ts` PWA settings)
- When seeing "module does not provide export" errors
- Before running clean Playwright test suites
- After updating `vite-plugin-pwa` configuration
- When testing offline functionality

⚠️ **Common Issues Solved by Clearing:**
- Stale JavaScript modules with old imports
- Cached API responses with outdated schema
- TypeScript compilation cached incorrectly
- Workbox cache conflicts between dev/prod
- Service Worker update not applying

---

## Manual Clearing via DevTools UI

### Chrome/Edge
1. Open DevTools (`F12`)
2. Go to **Application** tab
3. **Service Workers** section → Click "Unregister" on each worker
4. **Cache Storage** section → Right-click each cache → Delete
5. Reload page (`Ctrl+R` or `Cmd+R`)

### Firefox
1. Open DevTools (`F12`)
2. Go to **Storage** tab
3. **Service Workers** → Click "Unregister"
4. **Cache Storage** → Expand and delete all caches
5. Reload page

### Safari
1. Enable Developer Menu: Preferences → Advanced → Show Develop menu
2. Develop → Empty Caches
3. Develop → Service Workers → Select your domain → Unregister
4. Reload page

---

## Vite Dev Server Cache

Sometimes you also need to clear Vite's module cache:

```bash
# Clear Vite cache
rm -rf frontend/node_modules/.vite

# Restart dev server
npm run dev
```

---

## Nuclear Option (Clear Everything)

When all else fails:

```bash
# Kill all Node/Vite processes
pkill -9 -f "vite"

# Clear Vite cache
rm -rf frontend/node_modules/.vite

# Clear Service Worker registrations (run in browser console)
# Use the DevTools command above

# Restart dev server
npm run dev
```

---

## Testing Checklist

Before running PWA tests:

- [ ] Clear Service Worker registrations
- [ ] Clear all Cache Storage
- [ ] Clear Vite dev cache (`node_modules/.vite`)
- [ ] Restart Vite dev server
- [ ] Hard refresh browser (`Ctrl+Shift+R` / `Cmd+Shift+R`)
- [ ] Verify no console errors on load

---

## Notes

- **Service Workers persist** across page reloads - must be explicitly unregistered
- **Cache Storage is separate** from browser cache (Ctrl+F5 won't clear it)
- **Vite HMR** doesn't always update Service Worker changes
- **IndexedDB** (offline queue) is NOT cleared by these commands
  - To clear IndexedDB: DevTools → Application → IndexedDB → Right-click → Delete

---

Last Updated: 2025-10-19
