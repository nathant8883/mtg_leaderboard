# Match Tracker Native Polish — Touch Bugs & PWA Feel

**Date:** 2026-02-28
**Status:** Approved

## Problem

Two reported bugs in the match tracker's hold-to-increment buttons, plus general "web app" feel that breaks the native illusion:

1. **Extra +1 on release from hold mode** — When releasing after holding for +10 increments, an extra +1 damage often gets applied. Root cause: dual mouse+touch event handlers fire independently, and the release handler runs twice — once clearing the hold, once seeing no active hold and applying +1.

2. **Stuck +10 when tabbing out** — If a user switches apps while holding a button, the `setInterval` keeps firing in the background. `onTouchEnd`/`onMouseUp` never fires because the finger lifted off-screen. No `visibilitychange` listener exists to clean up hold timers.

3. **Browser behaviors leak through** — Overscroll bounce, context menus on long-press, double-tap zoom, text selection during rapid taps, and missing safe area insets for notched devices.

## Design

### 1. `useLongPress` Hook (New File)

**File:** `frontend/src/hooks/useLongPress.ts`

Replaces all manual `holdTimerRef`/`holdIntervalRef`/`clearHoldTimers()` logic with a reusable hook.

**API:**
```typescript
const { getPointerHandlers, cancelAll } = useLongPress({
  onTap: (id: string) => void,       // Quick release (< threshold)
  onHoldStart: (id: string) => void,  // Once when hold threshold reached
  onHoldRepeat: (id: string) => void, // Each interval tick while held
  onRelease: (id: string) => void,    // Any release (tap or hold)
  holdThreshold?: number,  // ms before hold mode (default: 500)
  repeatInterval?: number, // ms between repeats (default: 500)
});

// Spread onto buttons:
<button {...getPointerHandlers('player-3-minus')}>-</button>
```

**Key behaviors:**
- Uses `onPointerDown`/`onPointerUp`/`onPointerCancel`/`onPointerLeave` — single event model, eliminates mouse+touch duplication that causes the extra +1 bug
- Calls `element.setPointerCapture(pointerId)` on pointer down — guarantees the up event fires on the same element even if the finger slides off
- Listens for `document.visibilitychange` — clears all timers when page goes hidden (fixes stuck +10 bug)
- Tracks active pointer ID to reject multi-touch (second finger ignored)
- Returns stable memoized handler references
- Exposes `cancelAll()` for external cancellation (swipe gesture integration)

### 2. ActiveGame.tsx Integration

**Remove:**
- `holdTimerRef` and `holdIntervalRef` refs
- `clearHoldTimers()` function
- `handleLifeButtonDown()` / `handleLifeButtonUp()`
- `handleCommanderDamageButtonDown()` / `handleCommanderDamageButtonUp()`
- All `onMouseDown`/`onMouseUp`/`onMouseLeave`/`onTouchStart`/`onTouchEnd` on damage buttons

**Add:**
- Two `useLongPress` instances:
  - Life buttons: 500ms hold threshold, 500ms repeat, ±10 on hold
  - Commander damage buttons: 1000ms hold threshold, 1000ms repeat, ±5 on hold
- Swipe gesture calls `cancelAll()` when swipe intent confirmed

**Button JSX simplification:**
```tsx
// Before (6 handlers per button):
<button
  onMouseDown={() => handleLifeButtonDown(pos, -1)}
  onMouseUp={handleLifeButtonUp}
  onMouseLeave={handleLifeButtonUp}
  onTouchStart={(e) => { e.preventDefault(); handleLifeButtonDown(pos, -1); }}
  onTouchEnd={(e) => { e.preventDefault(); handleLifeButtonUp(); }}
>

// After (1 spread):
<button {...lifePress.getPointerHandlers(`life-${pos}-minus`)}>
```

**Preserved (no changes):**
- `handleLifeChange()` and `handleCommanderDamageChange()` state mutations
- Swipe gesture detection logic
- `activeButton` visual state tracking
- Delta display maps

### 3. Native-Feel CSS

Applied only during active match tracking via `.match-tracker-active` class on the game container.

**Overscroll/bounce prevention:**
```css
.match-tracker-active {
  overscroll-behavior: none;
  overflow: hidden;
  position: fixed;
  inset: 0;
}
```
`position: fixed` + `overflow: hidden` is the most reliable cross-browser approach for preventing iOS rubber-banding.

**Context menu blocking:**
```css
.match-tracker-active {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```
Plus JS: `onContextMenu={(e) => e.preventDefault()}` on game container.

**Safe area insets:**
```css
.match-tracker-active {
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}
```

**Double-tap zoom prevention:**
```css
.match-tracker-active {
  touch-action: manipulation;
}
```
Disables double-tap-to-zoom while keeping pan/pinch. Eliminates 300ms tap delay.

### 4. Not In Scope

- Sound effects
- Haptic feedback (Vibration API)
- Gesture coordinator / touch framework
- Press animations (scale-down, spring-back)
- Render optimization for rapid presses
- Transition animations between views
- Orientation lock enforcement (already CSS-handled)

## Files Touched

| File | Action |
|------|--------|
| `frontend/src/hooks/useLongPress.ts` | Create |
| `frontend/src/components/match-tracker/ActiveGame.tsx` | Modify (replace button handlers) |
| `frontend/src/index.css` | Modify (add match-tracker-active styles) |
