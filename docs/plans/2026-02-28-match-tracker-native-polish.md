# Match Tracker Native Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two hold-button bugs (extra +1 on release, stuck +10 on tab-out) and add native-feel CSS to the PWA match tracker.

**Architecture:** Rewrite the existing unused `useLongPress` hook to use the Pointer Events API with pointer capture, visibility-change cleanup, and a multi-button ID system. Replace all inline hold-button logic in ActiveGame.tsx with two hook instances (life buttons, commander damage buttons). Add native-feel CSS properties scoped to the active game container.

**Tech Stack:** React + TypeScript, Pointer Events API, CSS

**Design doc:** `docs/plans/2026-02-28-match-tracker-native-polish-design.md`

---

### Task 1: Rewrite `useLongPress` hook with Pointer Events API

**Files:**
- Modify: `frontend/src/hooks/useLongPress.ts`

**Context:** The existing `useLongPress.ts` hook is **unused anywhere** in the codebase. It uses the old mouse+touch dual-handler pattern that causes the extra +1 bug. We'll rewrite it completely with the Pointer Events API.

**Step 1: Rewrite the hook**

Replace the entire contents of `frontend/src/hooks/useLongPress.ts` with:

```typescript
import { useRef, useCallback, useEffect } from 'react';

interface LongPressConfig {
  /** Called on quick tap (released before hold threshold) */
  onTap: (id: string) => void;
  /** Called once when hold threshold is reached */
  onHoldStart: (id: string) => void;
  /** Called on each repeat interval while held */
  onHoldRepeat: (id: string) => void;
  /** Called on any release (after tap or hold) */
  onRelease?: (id: string) => void;
  /** Milliseconds before entering hold mode (default: 500) */
  holdThreshold?: number;
  /** Milliseconds between repeat callbacks while held (default: 500) */
  repeatInterval?: number;
}

interface PointerHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}

export function useLongPress(config: LongPressConfig) {
  const {
    onTap,
    onHoldStart,
    onHoldRepeat,
    onRelease,
    holdThreshold = 500,
    repeatInterval = 500,
  } = config;

  // Store config in refs so callbacks always see latest values
  const configRef = useRef(config);
  configRef.current = config;

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activeButtonIdRef = useRef<string | null>(null);
  const isHoldingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const cancelAll = useCallback(() => {
    clearTimers();
    activePointerIdRef.current = null;
    activeButtonIdRef.current = null;
    isHoldingRef.current = false;
  }, [clearTimers]);

  // Clean up on visibility change (fixes stuck +10 when tabbing out)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimers();
    };
  }, [cancelAll, clearTimers]);

  const getPointerHandlers = useCallback(
    (buttonId: string): PointerHandlers => {
      const handlePointerDown = (e: React.PointerEvent) => {
        // Reject if another pointer is already active (no multi-touch)
        if (activePointerIdRef.current !== null) return;

        // Capture the pointer so up/cancel always fire on this element
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        activePointerIdRef.current = e.pointerId;
        activeButtonIdRef.current = buttonId;
        isHoldingRef.current = false;

        // Clear any stale timers
        clearTimers();

        // Start the hold threshold timer
        holdTimerRef.current = setTimeout(() => {
          isHoldingRef.current = true;
          configRef.current.onHoldStart(buttonId);

          holdIntervalRef.current = setInterval(() => {
            configRef.current.onHoldRepeat(buttonId);
          }, configRef.current.repeatInterval ?? 500);
        }, configRef.current.holdThreshold ?? 500);
      };

      const handlePointerUp = (e: React.PointerEvent) => {
        // Only respond to the pointer that started the press
        if (e.pointerId !== activePointerIdRef.current) return;

        const wasHolding = isHoldingRef.current;
        const id = activeButtonIdRef.current;

        clearTimers();
        activePointerIdRef.current = null;
        activeButtonIdRef.current = null;
        isHoldingRef.current = false;

        if (id !== null) {
          if (!wasHolding) {
            // Released before threshold — this is a tap
            configRef.current.onTap(id);
          }
          if (configRef.current.onRelease) {
            configRef.current.onRelease(id);
          }
        }
      };

      const handlePointerCancel = (e: React.PointerEvent) => {
        if (e.pointerId !== activePointerIdRef.current) return;
        const id = activeButtonIdRef.current;
        cancelAll();
        if (id !== null && configRef.current.onRelease) {
          configRef.current.onRelease(id);
        }
      };

      return {
        onPointerDown: handlePointerDown,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        onPointerLeave: handlePointerCancel,
      };
    },
    [clearTimers, cancelAll]
  );

  return { getPointerHandlers, cancelAll, isHolding: isHoldingRef };
}
```

**Key design decisions:**
- `configRef` pattern: Store config in a ref so the `setTimeout`/`setInterval` callbacks always read the latest `onTap`/`onHoldStart`/`onHoldRepeat` without needing them in dependency arrays (avoids stale closures).
- `setPointerCapture`: Guarantees `pointerup` fires on the original element even if the finger slides off. Eliminates the need for `onMouseLeave` as a cleanup mechanism.
- `visibilitychange` listener: Clears all timers when the page goes hidden. This fixes the "stuck +10" bug.
- Single active pointer: Rejects additional pointers, preventing multi-touch confusion.
- `cancelAll()`: Exposed for external cancellation (swipe gesture integration).

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to `useLongPress.ts`.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useLongPress.ts
git commit -m "feat: rewrite useLongPress hook with Pointer Events API and visibility cleanup"
```

---

### Task 2: Integrate `useLongPress` for life damage buttons in ActiveGame

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Context:** ActiveGame.tsx currently has inline hold logic using `holdTimerRef`, `holdIntervalRef`, `holdStartTime`, `holdPosition`, `holdDelta` refs, plus `clearHoldTimers`, `handleLifeButtonDown`, and `handleLifeButtonUp` functions. We'll replace these with the `useLongPress` hook for life buttons first, then commander damage buttons in the next task.

**Step 1: Add the import and instantiate the hook**

At the top of ActiveGame.tsx, add to the existing import section:

```typescript
import { useLongPress } from '../../hooks/useLongPress';
```

Then, inside the component function body (near the other state declarations, around line 97 after the hold refs), add the life press hook instance:

```typescript
  // Life button long-press handling via Pointer Events API
  const lifePress = useLongPress({
    onTap: (id) => {
      const [, posStr, type] = id.split('-'); // "life-{pos}-{minus|plus}"
      const position = Number(posStr);
      const delta = type === 'plus' ? 1 : -1;
      handleLifeChange(position, delta);
    },
    onHoldStart: (id) => {
      const [, posStr, type] = id.split('-');
      const position = Number(posStr);
      const delta = type === 'plus' ? 10 : -10;
      handleLifeChange(position, delta);
    },
    onHoldRepeat: (id) => {
      const [, posStr, type] = id.split('-');
      const position = Number(posStr);
      const delta = type === 'plus' ? 10 : -10;
      handleLifeChange(position, delta);
    },
    onRelease: () => {
      setActiveButton(null);
    },
    holdThreshold: 500,
    repeatInterval: 500,
  });
```

**Important:** This must be placed AFTER `handleLifeChange` is defined (which is around line 375-425) and AFTER `setActiveButton` is available. A good location is right after the existing `handleLifeButtonUp` function (line ~490), but we'll be removing that function. So place it right after `handleLifeChange` and the delta cleanup effects (around line 520).

**Step 2: Update life button JSX to use hook handlers**

Find the life button JSX (around lines 1149-1183). Replace each life button's 6 event handlers with the hook's pointer handlers plus the `activeButton` visual logic on pointer down.

**Left button (−1 life):** Replace the current button (which has `onMouseDown`, `onMouseUp`, `onMouseLeave`, `onTouchStart`, `onTouchEnd`) with:

```tsx
<button
  className={`life-btn-side life-btn-left ${activeButton?.position === player.position && activeButton?.type === 'minus' ? 'active' : ''}`}
  {...lifePress.getPointerHandlers(`life-${player.position}-minus`)}
  onPointerDown={(e) => {
    setActiveButton({ position: player.position, type: 'minus' });
    lifePress.getPointerHandlers(`life-${player.position}-minus`).onPointerDown(e);
  }}
  disabled={playerState.eliminated}
>
  {lifeChangeDeltaMap[player.position] < 0 ? lifeChangeDeltaMap[player.position] : '−'}
</button>
```

Wait — spreading `getPointerHandlers` and then overriding `onPointerDown` would cause the spread's `onPointerDown` to be overridden. Instead, we need to compose them. A cleaner approach: set `activeButton` inside the hook's `onTap`/`onHoldStart` callbacks and clear it in `onRelease`. Let me revise.

**Revised Step 1:** Update the hook instance to also manage `activeButton` state:

```typescript
  // Life button long-press handling via Pointer Events API
  const lifePress = useLongPress({
    onTap: (id) => {
      const [, posStr, type] = id.split('-');
      const position = Number(posStr);
      const delta = type === 'plus' ? 1 : -1;
      setActiveButton({ position, type: type as 'plus' | 'minus' });
      handleLifeChange(position, delta);
      // activeButton will be cleared by onRelease
    },
    onHoldStart: (id) => {
      const [, posStr, type] = id.split('-');
      const position = Number(posStr);
      const delta = type === 'plus' ? 10 : -10;
      handleLifeChange(position, delta);
    },
    onHoldRepeat: (id) => {
      const [, posStr, type] = id.split('-');
      const position = Number(posStr);
      const delta = type === 'plus' ? 10 : -10;
      handleLifeChange(position, delta);
    },
    onRelease: () => {
      setActiveButton(null);
    },
    holdThreshold: 500,
    repeatInterval: 500,
  });
```

Hmm, but `activeButton` should show immediately on press (for visual feedback), not after the tap is confirmed. The original code sets it in `handleLifeButtonDown`. We need to set it on pointer down. Let's add a helper that wraps the pointer down:

**Final approach for Step 1:** Create a wrapper that composes visual state + hook logic:

```typescript
  // Helper to get life button props (pointer handlers + visual state)
  const getLifeButtonProps = (position: number, type: 'minus' | 'plus') => {
    const buttonId = `life-${position}-${type}`;
    const handlers = lifePress.getPointerHandlers(buttonId);
    return {
      ...handlers,
      onPointerDown: (e: React.PointerEvent) => {
        setActiveButton({ position, type });
        handlers.onPointerDown(e);
      },
    };
  };
```

**Revised life button JSX:**

Left button:
```tsx
<button
  className={`life-btn-side life-btn-left ${activeButton?.position === player.position && activeButton?.type === 'minus' ? 'active' : ''}`}
  {...getLifeButtonProps(player.position, 'minus')}
  disabled={playerState.eliminated}
>
  {lifeChangeDeltaMap[player.position] < 0 ? lifeChangeDeltaMap[player.position] : '−'}
</button>
```

Right button:
```tsx
<button
  className={`life-btn-side life-btn-right ${activeButton?.position === player.position && activeButton?.type === 'plus' ? 'active' : ''}`}
  {...getLifeButtonProps(player.position, 'plus')}
  disabled={playerState.eliminated}
>
  {lifeChangeDeltaMap[player.position] > 0 ? `+${lifeChangeDeltaMap[player.position]}` : '+'}
</button>
```

**Step 3: Update swipe gesture to cancel life press**

In the `handleTouchMove` function (around line 793-828), where swipe intent is detected and `clearHoldTimers()` is called, add `lifePress.cancelAll()`:

Find this block (around line 815-820):
```typescript
if (velocity > 0.3) {
  gesture.intent = 'swipe';
  gesture.isIntentDetermined = true;
  clearHoldTimers();
  setActiveButton(null);
}
```

Replace `clearHoldTimers()` with `lifePress.cancelAll()` (and we'll also add `commanderPress.cancelAll()` in Task 3). For now:

```typescript
if (velocity > 0.3) {
  gesture.intent = 'swipe';
  gesture.isIntentDetermined = true;
  lifePress.cancelAll();
  setActiveButton(null);
}
```

**Step 4: Remove the swipe-guard from handleLifeButtonUp**

The old `handleLifeButtonUp` had a check `if (gestureState.current.intent === 'swipe') return;`. This is no longer needed because swipe detection now calls `lifePress.cancelAll()` directly. The hook's pointer up handler will see that timers are already cleared and `activeButtonIdRef` is null, so it won't fire a tap.

**Step 5: DON'T remove the old functions yet**

The old `handleLifeButtonDown`, `handleLifeButtonUp`, `clearHoldTimers`, and refs are still needed by the commander damage buttons. We'll remove them in Task 3 after both button types are migrated.

However, we should verify the life buttons are no longer using the old functions. Search for any remaining references to `handleLifeButtonDown` or `handleLifeButtonUp` in the JSX and ensure they've all been replaced.

**Step 6: Verify in browser**

```bash
cd frontend && npm run dev
```

Open the match tracker, start a game with 4 players. Test:
- Quick tap on +/− buttons → changes life by ±1
- Hold button for >500ms → changes life by ±10, repeats every 500ms
- Release after hold → no extra +1 tacked on
- Tab out while holding → button stops (no stuck +10)
- Swipe on player card → hold is cancelled, commander damage mode enters

**Step 7: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "feat: integrate useLongPress hook for life damage buttons"
```

---

### Task 3: Integrate `useLongPress` for commander damage buttons & remove old code

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Context:** Commander damage buttons use the same hold pattern but with different timing (1000ms threshold/interval, ±5 multiplier). After migrating these, we can remove all old hold logic.

**Step 1: Add commander damage hook instance**

Below the `lifePress` hook instance, add:

```typescript
  // Commander damage button long-press handling
  const commanderPress = useLongPress({
    onTap: (id) => {
      const [, posStr, type] = id.split('-');
      const opponentPosition = Number(posStr);
      const delta = type === 'plus' ? 1 : -1;
      setActiveButton({ position: opponentPosition, type: type as 'plus' | 'minus' });
      handleCommanderDamageChange(opponentPosition, delta);
    },
    onHoldStart: (id) => {
      const [, posStr, type] = id.split('-');
      const opponentPosition = Number(posStr);
      const delta = type === 'plus' ? 5 : -5;
      handleCommanderDamageChange(opponentPosition, delta);
    },
    onHoldRepeat: (id) => {
      const [, posStr, type] = id.split('-');
      const opponentPosition = Number(posStr);
      const delta = type === 'plus' ? 5 : -5;
      handleCommanderDamageChange(opponentPosition, delta);
    },
    onRelease: () => {
      setActiveButton(null);
    },
    holdThreshold: 1000,
    repeatInterval: 1000,
  });

  // Helper to get commander damage button props
  const getCommanderButtonProps = (opponentPosition: number, type: 'minus' | 'plus') => {
    const buttonId = `cmdr-${opponentPosition}-${type}`;
    const handlers = commanderPress.getPointerHandlers(buttonId);
    return {
      ...handlers,
      onPointerDown: (e: React.PointerEvent) => {
        if (trackingPlayerPosition === null) return;
        setActiveButton({ position: opponentPosition, type });
        handlers.onPointerDown(e);
      },
    };
  };
```

**Step 2: Update commander damage button JSX**

Find the commander damage button JSX (around lines 1240-1272). Replace each button's 6 event handlers.

Left button (−1 commander damage):
```tsx
<button
  className={`life-btn-side life-btn-left ${activeButton?.position === player.position && activeButton?.type === 'minus' ? 'active' : ''}`}
  {...getCommanderButtonProps(player.position, 'minus')}
>
  {commanderDamageDeltaMap[player.position] < 0 ? commanderDamageDeltaMap[player.position] : '−'}
</button>
```

Right button (+1 commander damage):
```tsx
<button
  className={`life-btn-side life-btn-right ${activeButton?.position === player.position && activeButton?.type === 'plus' ? 'active' : ''}`}
  {...getCommanderButtonProps(player.position, 'plus')}
>
  {commanderDamageDeltaMap[player.position] > 0 ? `+${commanderDamageDeltaMap[player.position]}` : '+'}
</button>
```

**Step 3: Update swipe cancel to include commander press**

In `handleTouchMove` where we added `lifePress.cancelAll()`, also add `commanderPress.cancelAll()`:

```typescript
if (velocity > 0.3) {
  gesture.intent = 'swipe';
  gesture.isIntentDetermined = true;
  lifePress.cancelAll();
  commanderPress.cancelAll();
  setActiveButton(null);
}
```

**Step 4: Remove old hold button code**

Now that both button types use the hook, remove all of these:

1. **Refs** (around lines 93-97): Remove `holdTimerRef`, `holdIntervalRef`, `holdStartTime`, `holdPosition`, `holdDelta`

2. **`clearHoldTimers` function** (lines 427-436): Remove entirely

3. **`handleLifeButtonDown` function** (lines 438-459): Remove entirely

4. **`handleLifeButtonUp` function** (lines 461-490): Remove entirely

5. **`handleCommanderDamageButtonDown` function** (lines 598-620): Remove entirely

6. **`handleCommanderDamageButtonUp` function** (lines 623-652): Remove entirely

7. **Cleanup useEffect** (lines 492-497): Remove the `clearHoldTimers` cleanup effect (the hook handles its own cleanup now)

8. **Any remaining `clearHoldTimers()` calls**: Search for any other call sites in the file and replace them:
   - In `handleTouchMove`: already replaced in Step 3
   - In any `useEffect` cleanup: removed in step 7
   - Anywhere else: replace with `lifePress.cancelAll(); commanderPress.cancelAll();`

**Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors. If there are errors about missing functions, search for any remaining references to the removed functions and update them.

**Step 6: Verify in browser**

Test the full flow:
- Life buttons: tap → ±1, hold → ±10 repeating
- Commander damage buttons: tap → ±1, hold → ±5 repeating
- Swipe to enter/exit commander damage mode while holding → cancels hold
- Tab out while holding any button → stops immediately
- Release after hold → no extra single increment

**Step 7: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "feat: migrate commander damage buttons to useLongPress, remove old hold logic"
```

---

### Task 4: Add native-feel CSS for the match tracker

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Context:** The match tracker runs in landscape on phones placed in the center of the table. Browser behaviors like overscroll bounce, context menus on long-press, double-tap zoom, and text selection break the native feel. We'll add CSS properties scoped to the active game container.

**Step 1: Add CSS class for native feel**

In `frontend/src/index.css`, find the `.players-grid` styles (around line 1376). Add the following BEFORE the `.players-grid` block:

```css
/* Native-feel overrides for active match tracker */
.match-tracker-native {
  overscroll-behavior: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
```

**Why these properties:**
- `overscroll-behavior: none` — prevents rubber-band bounce on iOS/Android when scrolling at edges
- `-webkit-touch-callout: none` — prevents iOS from showing callout menu on long-press of links/images
- `-webkit-user-select: none` + `user-select: none` — prevents accidental text selection during rapid taps (note: the `.player-card` already has `user-select: none` at line 1766, this extends it to the full container)
- `touch-action: manipulation` — disables double-tap-to-zoom while keeping pan/pinch, eliminates the 300ms tap delay on buttons

**Step 2: Apply the class and context menu prevention to the root container**

In ActiveGame.tsx, find the root `<div>` (line 907):

```tsx
<div className="min-h-screen flex flex-col">
```

Change to:

```tsx
<div
  className="min-h-screen flex flex-col match-tracker-native"
  onContextMenu={(e) => e.preventDefault()}
>
```

**Step 3: Add safe area insets to the players-grid**

In `frontend/src/index.css`, find the `.players-grid` block (line 1376) and add safe area padding:

```css
  .players-grid {
    /* existing styles... */
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }
```

Note: Use the fallback value `0px` so the `env()` doesn't break on browsers that don't support it. Check the existing `.players-grid` styles first — if it already has padding, add the safe-area values additively using `calc()`.

**Step 4: Verify the viewport meta tag**

Check `frontend/index.html` for `viewport-fit=cover` in the viewport meta tag. If it's missing, add it:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

This is required for `env(safe-area-inset-*)` to work on iOS.

**Step 5: Verify in browser**

Open the match tracker on a phone (or use Chrome DevTools mobile emulation):
- Long-press on a button → no context menu appears
- Double-tap on a button → no zoom (should just trigger two taps)
- Scroll past the edge → no rubber-band bounce
- No text selection when tapping rapidly

**Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/components/match-tracker/ActiveGame.tsx frontend/index.html
git commit -m "feat: add native-feel CSS for match tracker (overscroll, context menu, safe area)"
```

---

### Task 5: Final integration test and cleanup

**Files:**
- Potentially: `frontend/src/components/match-tracker/ActiveGame.tsx` (minor fixes only)

**Step 1: Run TypeScript type check**

```bash
cd frontend && npx tsc --noEmit --pretty
```

Expected: No errors.

**Step 2: Run the dev server and full manual test**

```bash
cd frontend && npm run dev
```

Test matrix (test each scenario):

| Scenario | Expected Result |
|----------|----------------|
| Tap life + button | Life goes up by 1 |
| Tap life − button | Life goes down by 1 |
| Hold life + button >500ms | Life increases by 10, then repeats every 500ms |
| Hold life − button >500ms | Life decreases by 10, then repeats every 500ms |
| Release after hold | No extra +1/-1 tacked on |
| Hold, then swipe | Hold cancels, enters commander damage mode |
| Hold, switch apps, return | Button not stuck, no +10 spam |
| Tap commander + button | Commander damage up by 1 |
| Hold commander + button >1s | Commander damage up by 5, repeats every 1s |
| Long-press on card area | No context menu |
| Double-tap button | Two single taps, no zoom |
| Scroll past edge | No bounce/overscroll |
| Test with 3, 4, 5, 6 players | All layouts work correctly |

**Step 3: Fix any issues found during testing**

Apply minimal fixes as needed.

**Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during match tracker integration testing"
```
