# Life Tracker Native Feel — Bugs, State Machine, Polish

**Date:** 2026-04-21
**Status:** Approved
**Supersedes:** `2026-02-28-match-tracker-native-polish-design.md` (approved but never implemented; the `useLongPress.ts` hook produced there is the stale dual-handler version and is unused)

## Problem

Life tracking in `ActiveGame.tsx` has two reported bugs plus a broader "this is a webpage" feel that breaks the PWA illusion:

1. **+11 on release from hold.** When a player holds a ± button to trigger +10 repeat, an extra +1 sometimes lands. Root cause is a race between the 500ms hold timer and the release handler: `wasHolding` is inferred from `holdIntervalRef.current !== null`, but the interval ref is assigned *after* the first `+10` fires inside the setTimeout callback. If release events interleave with that callback, or if a synthetic mouse event double-fires the down handler, both the hold path and the single-tap fallback execute in one press.

2. **Stuck counter when user swipes off the PWA mid-press.** No `touchcancel`/`pointercancel` handler, no `visibilitychange` cleanup, no `pagehide`/`blur` cleanup. When the browser steals the gesture (system swipe, notification, backgrounding) the hold `setInterval` keeps running and the active-button visual state never clears.

3. **Hidden risks in the same area:** shared `holdTimerRef`/`holdIntervalRef`/`holdPosition` refs mean only one button press can be tracked at a time — multi-touch (two players pressing simultaneously) corrupts state. The commander-damage buttons duplicate ~60 lines of the same pattern with the same bugs. `onMouseLeave` is the only desktop escape path and doesn't always fire.

4. **Web-feel tells:** flat +10 every 500ms reads as mechanical rather than native; the "pressed" state is just a color change on the 35%-wide side strip; life total swaps instantly with no micro-animation; browser defaults (tap highlight, long-press callout, overscroll bounce, 300ms click delay) leak through.

## Goals

- Fix the +11 and stuck-counter bugs at the root, not symptomatically.
- Replace flat hold-repeat with an accelerating curve (fine-grained start, fast finish) that matches native life counter apps.
- Make button presses feel tactile: whole-zone press state, number pulse, spring-eased delta bubble.
- Harden browser defaults so the PWA stops broadcasting "web view."
- Deduplicate life-tracking and commander-damage button code.

## Non-goals

- Layout changes. The current 35% left / 30% middle / 35% right split stays.
- Swipe-to-commander-damage redesign. The existing intent-based swipe gesture on `.player-slot` is fine and stays.
- Haptic feedback. Explicitly out of scope — user feels it's not part of native feel for this app.
- Sound effects.
- Rolling-number animations (iOS-picker style). Too finicky for the value; number pulse is enough.

## Design

### 1. Architecture

A new `useHoldButton` hook owns all press/hold behavior. `ActiveGame.tsx` stops managing hold timers, shared refs, and active-button state directly. Each button (± life per player, ± commander damage per opponent) instantiates its own `useHoldButton` with isolated state — **no shared refs across buttons, so multi-touch works**.

```
ActiveGame.tsx
  └─ useHoldButton({ onTick, curve, disabled }) → { bind, isPressed }
       └─ internal state machine (one instance per button)
       └─ registers abort in module-level globalCancelBus

globalCancelBus (module singleton)
  ↑
visibilitychange / pagehide / blur listeners (mounted once in ActiveGame)
```

### 2. `useHoldButton` hook

**File:** `frontend/src/hooks/useHoldButton.ts` (new; the stale `useLongPress.ts` is deleted).

```ts
type Phase = 'idle' | 'pressed' | 'holding';

interface HoldCurve {
  initialDelay: number;  // ms from pointerdown before repeat starts
  stages: Array<{ duration: number; interval: number; step: number }>;
}

interface UseHoldButtonOpts {
  onTick: (step: number) => void;     // tap, first hold repeat, each hold repeat
  curve: HoldCurve;
  disabled?: boolean;
}

interface UseHoldButtonResult {
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp:   (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  };
  isPressed: boolean;
}
```

Internally, a single Pointer Events stream. No mouse handlers, no touch handlers — Pointer Events handles all input types in every browser the app targets (iOS Safari 13+, Android Chrome, desktop Chrome/Firefox/Safari).

**State machine:**

| From | Event | Action | To |
|---|---|---|---|
| idle | pointerdown | fire `onTick(1)` immediately; `setPointerCapture(pointerId)`; schedule `initialDelay` timeout; register abort in `globalCancelBus`; `setIsPressed(true)` | pressed |
| pressed | initialDelay timeout fires | enter stage 0; schedule next tick at `stages[0].interval` | holding |
| pressed | pointerup | clear timeout; deregister; `setIsPressed(false)`; **do nothing else** (tap already fired on down) | idle |
| pressed | pointercancel / pointerleave | same as pointerup | idle |
| holding | tick | fire `onTick(currentStage.step)`; advance stage if its `duration` exceeded; schedule next tick | holding |
| holding | pointerup / cancel / leave | clear current timeout; deregister; `setIsPressed(false)` | idle |

**Why this kills the +11 bug:** the touchdown tick fires *exactly once*, synchronously, before any timer exists. The hold repeats are a separate channel on a separate code path. There is no condition under which both can fire in one press — it's impossible by construction, not by timing luck.

**Why this kills the stuck-counter bug:**
- `setPointerCapture` on pointerdown means the element keeps receiving events even if the finger slides off. The gesture always terminates in `pointerup` or `pointercancel` on the capturing element.
- `pointercancel` fires whenever the browser steals the gesture (system swipe, palm reject, scroll threshold, multi-touch escalation).
- The `globalCancelBus` (§4) catches the remaining case: app backgrounded.

**Recursive `setTimeout` for repeats**, not `setInterval`. Each tick computes its successor's delay from the current stage, so the curve changes mid-hold without drift.

### 3. Acceleration curves

```ts
export const LIFE_CURVE: HoldCurve = {
  initialDelay: 450,
  stages: [
    { duration: 750,      interval: 100, step: 1  }, // 0.45–1.2s: fine control
    { duration: 1300,     interval: 150, step: 5  }, // 1.2–2.5s: medium
    { duration: Infinity, interval: 200, step: 10 }, // 2.5s+:    fast
  ],
};

export const COMMANDER_DAMAGE_CURVE: HoldCurve = {
  initialDelay: 500,
  stages: [
    { duration: 1500,     interval: 200, step: 1 },
    { duration: Infinity, interval: 250, step: 5 },
  ],
};
```

Tuneable constants; easy to revisit post-launch.

### 4. Global cancellation

Module-level singleton:

```ts
// frontend/src/hooks/useHoldButton.ts
const globalCancelBus = {
  aborts: new Set<() => void>(),
  register(fn: () => void) { this.aborts.add(fn); return () => this.aborts.delete(fn); },
  abortAll() { for (const fn of this.aborts) fn(); }
};
```

Mounted once at the top of `ActiveGame`:

```ts
useEffect(() => {
  const abortAll = () => globalCancelBus.abortAll();
  const onVisibility = () => { if (document.hidden) abortAll(); };
  window.addEventListener('pagehide', abortAll);
  window.addEventListener('blur', abortAll);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', abortAll);
    window.removeEventListener('blur', abortAll);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}, []);
```

Any active press anywhere in the component aborts when the app backgrounds or loses focus. Return to the app → no runaway counter, no stuck visual state.

### 5. Integration with swipe-for-commander-damage

The parent `.player-slot` keeps its existing `handleTouchStart/Move/End` gesture detection — that logic works today and doesn't need changing. Coordination with hold buttons:

- The button's `useHoldButton` is a separate event stream from the slot's touch handlers, so they don't directly fight.
- When the parent gesture tracker flips intent to `'swipe'`, it calls `globalCancelBus.abortAll()` to cancel any button press that happens to be active. This reproduces today's "swipe cancels tap" behavior cleanly.
- `touch-action: manipulation` on the button doesn't interfere with the slot's swipe detection because swipes originate from the non-button central 30% (where the big number sits) and the slot's outer regions.

### 6. Visual polish (same PR)

**Whole-card press state:**
```css
.player-card.is-pressing {
  transform: scale(0.97);
  transition: transform 90ms ease-out;
}
```
Driven by `isPressed` from whichever `useHoldButton` for that card is currently active (combined via `||`).

**Life number pulse:**
```css
@keyframes life-pulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
.life-total.is-pulsing { animation: life-pulse 140ms cubic-bezier(0.34, 1.56, 0.64, 1); }
```
Triggered by a `useEffect` on `playerState.life` that toggles a class for 140ms. GPU-composited (transform-only) — no layout thrash at high tick rates.

**Delta bubble spring:**
The existing `+5` indicator in `lifeChangeDeltaMap` gets spring entry + 8px upward drift across its 1s life:
```css
@keyframes delta-float {
  0%   { opacity: 0; transform: translateY(0) scale(0.8); }
  15%  { opacity: 1; transform: translateY(-2px) scale(1.05); }
  100% { opacity: 0; transform: translateY(-10px) scale(1); }
}
```

**Global CSS hardening** (in `@layer base` in `index.css`):
```css
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}
body { overscroll-behavior: none; }
.player-card,
.life-btn-side {
  touch-action: manipulation;
  user-select: none;
}
```

These four lines eliminate: the gray tap-highlight flash, the iOS long-press share menu, rubber-band scrolling when overscrolling, the 300ms click delay, and accidental text selection on rapid taps.

### 7. Commander damage reuse

`handleCommanderDamageButtonDown` / `handleCommanderDamageButtonUp` and their ~60 lines of duplicated hold logic are **deleted**. Commander damage buttons use the same `useHoldButton` hook with `COMMANDER_DAMAGE_CURVE`:

```tsx
const minus = useHoldButton({
  curve: COMMANDER_DAMAGE_CURVE,
  onTick: (step) => handleCommanderDamageChange(opponentPosition, -step),
});
<button {...minus.bind} />
```

### 8. State cleanup in `ActiveGame.tsx`

Removed:
- `holdTimerRef`, `holdIntervalRef`, `holdStartTime`, `holdPosition`, `holdDelta` refs
- `activeButton` state (replaced by `isPressed` from hook instances)
- `clearHoldTimers` helper
- `handleLifeButtonDown` / `handleLifeButtonUp` / commander equivalents
- All `onMouseDown` / `onMouseUp` / `onMouseLeave` / `onTouchStart` / `onTouchEnd` props on buttons (replaced with `{...bind}`)

Net reduction: ~80 lines in `ActiveGame.tsx`.

## Testing

**Unit tests for `useHoldButton`** (Vitest + React Testing Library + fake timers):
- Tap: pointerdown → pointerup before `initialDelay` → exactly one `onTick(1)`
- Hold through stages: verify step values and intervals match curve
- Pointer cancel mid-hold: timeouts cleared, no further ticks
- Disabled state: no events register
- Global abort: triggers release
- Curve switching mid-hold: stage transitions happen at the right times

**Manual test matrix** (must pass on all):
- iOS Safari PWA, Android Chrome PWA, desktop Chrome
- Rapid single taps: every tap registers as ±1, no drops, no +2s
- Hold release at 400ms, 500ms, 600ms (the old race window): no +11
- Swipe off screen mid-hold (system back gesture, home swipe): counter stops
- Background the app mid-hold (switch tabs/apps, come back): no runaway
- Multi-touch: two players press simultaneously, both increment independently
- Swipe-to-commander-damage while a hold is active: hold aborts cleanly, no spurious tick
- Whole-card press state appears and resolves with each press

## Risks

| Risk | Mitigation |
|---|---|
| Pointer Events behavior differs iOS vs Android | Caniuse confirms full support on target browsers; manual test matrix covers real devices |
| Parent slot's touch-based swipe detection conflicts with pointer-based button handlers | They operate on different DOM elements in different event streams; during integration, verify swipe still cancels tap via `globalCancelBus.abortAll()` |
| Acceleration curve feels wrong in practice | Curve lives in one exported constant — trivial to tune post-launch |
| Number pulse causes layout thrash at 30+ changes/sec | Animation is `transform: scale()` only (GPU-composited, no layout/paint) |
| `setPointerCapture` edge cases on iOS | Belt-and-suspenders: `pointerleave` handler in state machine catches escapes |
| Removing `useLongPress.ts` breaks something unexpectedly | `grep -r useLongPress frontend/src` confirms it's unused; safe to delete |

## Open questions

None. Approved for planning.
