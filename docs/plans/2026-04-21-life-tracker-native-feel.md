# Life Tracker Native Feel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the +11-on-release and stuck-counter bugs in life tracking, replace flat hold-repeat with an accelerating curve, and add native-feel polish (whole-card press scale, number pulse, delta spring, CSS hardening) to the PWA match tracker.

**Architecture:** New `useHoldButton` hook built on the Pointer Events API with an explicit `idle → pressed → holding` state machine, `setPointerCapture` for sticky gesture binding, and a module-level `globalCancelBus` that aborts all active presses on `visibilitychange` / `pagehide` / `blur`. Replace all inline hold logic in `ActiveGame.tsx` (both life and commander damage buttons) with the hook. Delete the stale unused `useLongPress.ts`. Polish pass (press scale, number pulse, delta spring, CSS hardening) ships in the same PR.

**Tech Stack:** React 18 + TypeScript, Pointer Events API, Vitest + React Testing Library (new), CSS in `index.css` `@layer base` / `@layer components`.

**Design doc:** `docs/plans/2026-04-21-life-tracker-native-feel-design.md`

**Supersedes:** `docs/plans/2026-02-28-match-tracker-native-polish.md` (never implemented)

---

## Notes for the implementer

- This project is a PWA. Real validation happens on iOS Safari and Android Chrome, not just desktop. The Vitest tests cover logic; the manual QA checklist (Task 16) covers behavior.
- There is currently **no frontend test infrastructure**. Task 1 sets up Vitest. If you want to move fast and skip unit tests, skip Tasks 1, 3, 4, 7, 9, 11 — the hook still gets implemented (steps merge) and the manual QA in Task 16 catches regressions. Default: don't skip; TDD finds hook bugs much faster than device testing.
- After every task: `npm run lint` in `frontend/` must still pass. The user already has this wired.
- Commits are small and frequent. The repo uses conventional-ish commit messages (`feat:`, `fix:`, `docs:`, `refactor:`). Follow that. Every commit message must end with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Do **not** skip hooks (`--no-verify`) on commits.

---

### Task 1: Set up Vitest + React Testing Library

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test-setup.ts`

**Step 1: Install dev dependencies**

Run:
```bash
cd frontend && npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: packages added to `devDependencies`, no errors.

**Step 2: Add test scripts**

Modify `frontend/package.json` — in the `"scripts"` object, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

**Step 3: Create vitest config**

Create `frontend/vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    css: false,
  },
});
```

**Step 4: Create test setup**

Create `frontend/src/test-setup.ts` with:

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 5: Verify setup runs**

Run: `cd frontend && npm test`

Expected: `No test files found` (not an error — zero tests is fine). If it errors, fix before proceeding.

**Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test-setup.ts
git commit -m "$(cat <<'EOF'
chore: set up vitest + react testing library

Zero tests yet. Infrastructure only — upcoming life-tracker hook work
needs unit tests and the frontend didn't have a test runner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Scaffold `useHoldButton` hook (types + empty implementation)

**Files:**
- Create: `frontend/src/hooks/useHoldButton.ts`

**Step 1: Create the file with types and empty hook**

Create `frontend/src/hooks/useHoldButton.ts` with:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface HoldStage {
  /** How long this stage lasts in ms, or Infinity for the final stage */
  duration: number;
  /** ms between onTick calls while in this stage */
  interval: number;
  /** Value passed to onTick while in this stage */
  step: number;
}

export interface HoldCurve {
  /** ms from pointerdown before hold mode starts */
  initialDelay: number;
  /** Ordered list of hold stages. Last stage should have duration: Infinity */
  stages: HoldStage[];
}

export interface UseHoldButtonOptions {
  /** Fired once on pointerdown (the "tap") and on each hold repeat */
  onTick: (step: number) => void;
  curve: HoldCurve;
  disabled?: boolean;
}

export interface UseHoldButtonResult {
  bind: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
    onPointerLeave: (e: ReactPointerEvent) => void;
  };
  isPressed: boolean;
}

// Module-level cancel bus: any active press registers an abort fn here.
// ActiveGame mounts global listeners (visibilitychange, pagehide, blur) that
// call abortAll() to cancel every in-flight press when the app backgrounds.
const globalAborts = new Set<() => void>();

export const globalCancelBus = {
  register(abort: () => void): () => void {
    globalAborts.add(abort);
    return () => globalAborts.delete(abort);
  },
  abortAll(): void {
    for (const abort of [...globalAborts]) abort();
  },
};

export function useHoldButton(opts: UseHoldButtonOptions): UseHoldButtonResult {
  const [isPressed, setIsPressed] = useState(false);

  // TODO: implement in subsequent tasks
  const noop = useCallback(() => { /* no-op */ }, []);

  // Silence unused warnings until implemented
  void opts;
  void useRef;
  void useEffect;

  return {
    bind: {
      onPointerDown: noop,
      onPointerUp: noop,
      onPointerCancel: noop,
      onPointerLeave: noop,
    },
    isPressed,
  };
}
```

**Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: no errors.

**Step 3: Verify lint passes**

Run: `cd frontend && npm run lint`

Expected: no errors.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useHoldButton.ts
git commit -m "$(cat <<'EOF'
feat: scaffold useHoldButton hook

Types + empty implementation. State machine and pointer handling land
in the following commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Write failing test — tap fires onTick(1) exactly once

**Files:**
- Create: `frontend/src/hooks/__tests__/useHoldButton.test.tsx`

**Step 1: Write the test**

Create `frontend/src/hooks/__tests__/useHoldButton.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoldButton, type HoldCurve } from '../useHoldButton';

const TEST_CURVE: HoldCurve = {
  initialDelay: 450,
  stages: [
    { duration: 750, interval: 100, step: 1 },
    { duration: 1300, interval: 150, step: 5 },
    { duration: Infinity, interval: 200, step: 10 },
  ],
};

/** Build a fake PointerEvent with a stubbed setPointerCapture on target */
function makePointerEvent(type: string, pointerId = 1): any {
  const target = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn().mockReturnValue(true),
  };
  return { type, pointerId, currentTarget: target, target };
}

describe('useHoldButton — tap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onTick(1) exactly once on pointerdown, nothing on pointerup', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => {
      result.current.bind.onPointerDown(makePointerEvent('pointerdown'));
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenLastCalledWith(1);

    // Release BEFORE initialDelay — no hold
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.bind.onPointerUp(makePointerEvent('pointerup'));
    });

    // Still exactly 1 call total — no extra +1 on release
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run and verify it fails**

Run: `cd frontend && npm test -- useHoldButton`

Expected: FAIL — `onTick` is called 0 times (stub hook doesn't fire).

**Step 3: Commit the failing test**

```bash
git add frontend/src/hooks/__tests__/useHoldButton.test.tsx
git commit -m "$(cat <<'EOF'
test: add failing test for useHoldButton tap behavior

Red step — implementation lands next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Implement tap behavior — make Task 3 pass

**Files:**
- Modify: `frontend/src/hooks/useHoldButton.ts`

**Step 1: Replace the hook body**

Replace the `useHoldButton` function body (and remove the `noop` / `void` lines) with:

```ts
export function useHoldButton(opts: UseHoldButtonOptions): UseHoldButtonResult {
  const [isPressed, setIsPressed] = useState(false);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const activePointerIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unregisterAbortRef = useRef<(() => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const release = useCallback(() => {
    clearTimer();
    if (unregisterAbortRef.current) {
      unregisterAbortRef.current();
      unregisterAbortRef.current = null;
    }
    activePointerIdRef.current = null;
    setIsPressed(false);
  }, [clearTimer]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (optsRef.current.disabled) return;
    if (activePointerIdRef.current !== null) return; // already tracking a pointer

    activePointerIdRef.current = e.pointerId;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch { /* jsdom or older browser — safe to ignore */ }

    setIsPressed(true);

    // The tap: fire exactly once, synchronously, before any timer.
    optsRef.current.onTick(1);

    // Register abort for global cancel bus (backgrounding, blur, etc.)
    unregisterAbortRef.current = globalCancelBus.register(() => release());

    // Hold state machine is added in later tasks — for now, tap is enough.
  }, [release]);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    release();
  }, [release]);

  const onPointerCancel = useCallback((e: ReactPointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    release();
  }, [release]);

  const onPointerLeave = useCallback((e: ReactPointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    release();
  }, [release]);

  // Clean up on unmount
  useEffect(() => release, [release]);

  return {
    bind: { onPointerDown, onPointerUp, onPointerCancel, onPointerLeave },
    isPressed,
  };
}
```

**Step 2: Run tests to verify they pass**

Run: `cd frontend && npm test -- useHoldButton`

Expected: 1 test passes (the tap test).

**Step 3: Verify lint + typecheck still clean**

Run: `cd frontend && npm run lint && npx tsc --noEmit`

Expected: no errors.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useHoldButton.ts
git commit -m "$(cat <<'EOF'
feat: implement useHoldButton tap path

Pointer-capture on down, fire onTick(1) synchronously, release on
up/cancel/leave. Hold state machine lands next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Write failing tests — hold through all three stages

**Files:**
- Modify: `frontend/src/hooks/__tests__/useHoldButton.test.tsx`

**Step 1: Append the hold-behavior test block**

At the end of `useHoldButton.test.tsx`, before the closing of the file, append:

```tsx
describe('useHoldButton — hold', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not fire repeats before initialDelay (450ms)', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    expect(onTick).toHaveBeenCalledTimes(1); // just the tap

    act(() => { vi.advanceTimersByTime(400); });
    expect(onTick).toHaveBeenCalledTimes(1); // still no repeats
  });

  it('fires stage 0 repeats (step=1, interval=100ms) after initialDelay', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    onTick.mockClear(); // ignore the initial tap — focus on repeats

    act(() => { vi.advanceTimersByTime(450); }); // first repeat at initialDelay
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenLastCalledWith(1);

    act(() => { vi.advanceTimersByTime(100); });
    expect(onTick).toHaveBeenCalledTimes(2);

    act(() => { vi.advanceTimersByTime(100); });
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('advances to stage 1 (step=5, interval=150ms) after stage 0 duration', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    onTick.mockClear();

    // Run past initialDelay (450) + stage 0 duration (750) = 1200ms
    act(() => { vi.advanceTimersByTime(1200); });

    // Next tick after the boundary should use stage 1
    onTick.mockClear();
    act(() => { vi.advanceTimersByTime(150); });
    expect(onTick).toHaveBeenCalledWith(5);
  });

  it('advances to stage 2 (step=10, interval=200ms) after stage 1 duration', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    onTick.mockClear();

    // 450 (initial) + 750 (stage 0) + 1300 (stage 1) = 2500ms → stage 2
    act(() => { vi.advanceTimersByTime(2500); });

    onTick.mockClear();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTick).toHaveBeenCalledWith(10);
  });

  it('stops firing repeats after pointerup', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    act(() => { vi.advanceTimersByTime(800); }); // a couple repeats
    act(() => { result.current.bind.onPointerUp(makePointerEvent('pointerup')); });

    const countAfterUp = onTick.mock.calls.length;
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onTick).toHaveBeenCalledTimes(countAfterUp);
  });
});
```

**Step 2: Run and verify they fail**

Run: `cd frontend && npm test -- useHoldButton`

Expected: 5 tests fail (hold behavior not implemented), 1 test passes (tap from Task 3).

**Step 3: Commit the failing tests**

```bash
git add frontend/src/hooks/__tests__/useHoldButton.test.tsx
git commit -m "$(cat <<'EOF'
test: add failing tests for useHoldButton hold state machine

Red step — implementation lands next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Implement hold state machine — make Task 5 tests pass

**Files:**
- Modify: `frontend/src/hooks/useHoldButton.ts`

**Step 1: Add hold state machine to the hook**

In `useHoldButton.ts`, inside the hook body, add this helper **before** the `onPointerDown` definition:

```ts
  /** Start a timer chain: initialDelay → stage 0 → stage 1 → stage 2. */
  const scheduleHoldStart = useCallback(() => {
    const { curve } = optsRef.current;
    const holdStartedAt = Date.now();

    // Recursive scheduler. Each tick fires onTick(currentStage.step)
    // then schedules the next tick using the stage that applies at that future time.
    const scheduleNextTick = (delayMs: number) => {
      timerRef.current = setTimeout(() => {
        // Figure out which stage we're in based on elapsed time since hold started.
        // Stage boundaries: stage 0 ends at stages[0].duration,
        // stage 1 ends at stages[0].duration + stages[1].duration, etc.
        const elapsed = Date.now() - holdStartedAt;
        let cumulative = 0;
        let stage = curve.stages[curve.stages.length - 1];
        for (const s of curve.stages) {
          cumulative += s.duration;
          if (elapsed < cumulative) { stage = s; break; }
        }

        optsRef.current.onTick(stage.step);
        scheduleNextTick(stage.interval);
      }, delayMs);
    };

    // First hold tick fires at stage 0's interval after initialDelay has passed.
    scheduleNextTick(curve.stages[0].interval);
  }, []);
```

**Step 2: Wire it into `onPointerDown`**

In `onPointerDown`, after the `optsRef.current.onTick(1);` line and after the `globalCancelBus.register(...)` line, add:

```ts
    // Schedule the hold state machine to start after initialDelay.
    timerRef.current = setTimeout(() => {
      scheduleHoldStart();
    }, optsRef.current.curve.initialDelay);
```

And add `scheduleHoldStart` to the `onPointerDown` dependency array:

```ts
  }, [release, scheduleHoldStart]);
```

**Step 3: Run tests to verify hold tests pass**

Run: `cd frontend && npm test -- useHoldButton`

Expected: all 6 tests pass (1 tap + 5 hold).

**Step 4: Verify lint + typecheck**

Run: `cd frontend && npm run lint && npx tsc --noEmit`

Expected: no errors.

**Step 5: Commit**

```bash
git add frontend/src/hooks/useHoldButton.ts
git commit -m "$(cat <<'EOF'
feat: implement useHoldButton hold state machine

Recursive setTimeout scheduler walks through curve stages based on
elapsed time. Tap path and hold path are separate — the tap-on-down
fires exactly once regardless of what the hold scheduler does. This
eliminates the +11 race.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Write failing test — pointercancel mid-hold stops ticks

**Files:**
- Modify: `frontend/src/hooks/__tests__/useHoldButton.test.tsx`

**Step 1: Append the cancel test block**

Append to the test file:

```tsx
describe('useHoldButton — cancellation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('pointercancel mid-hold stops all future ticks', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    act(() => { vi.advanceTimersByTime(800); });
    const countBeforeCancel = onTick.mock.calls.length;

    act(() => { result.current.bind.onPointerCancel(makePointerEvent('pointercancel')); });

    act(() => { vi.advanceTimersByTime(5000); });
    expect(onTick).toHaveBeenCalledTimes(countBeforeCancel);
  });

  it('pointerleave stops future ticks', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    act(() => { vi.advanceTimersByTime(800); });
    const countBeforeLeave = onTick.mock.calls.length;

    act(() => { result.current.bind.onPointerLeave(makePointerEvent('pointerleave')); });

    act(() => { vi.advanceTimersByTime(5000); });
    expect(onTick).toHaveBeenCalledTimes(countBeforeLeave);
  });

  it('globalCancelBus.abortAll() stops every active hold', async () => {
    const { globalCancelBus } = await import('../useHoldButton');
    const onTickA = vi.fn();
    const onTickB = vi.fn();
    const hookA = renderHook(() => useHoldButton({ onTick: onTickA, curve: TEST_CURVE }));
    const hookB = renderHook(() => useHoldButton({ onTick: onTickB, curve: TEST_CURVE }));

    act(() => {
      hookA.result.current.bind.onPointerDown(makePointerEvent('pointerdown', 1));
      hookB.result.current.bind.onPointerDown(makePointerEvent('pointerdown', 2));
    });
    act(() => { vi.advanceTimersByTime(800); });

    const countA = onTickA.mock.calls.length;
    const countB = onTickB.mock.calls.length;

    act(() => { globalCancelBus.abortAll(); });

    act(() => { vi.advanceTimersByTime(5000); });
    expect(onTickA).toHaveBeenCalledTimes(countA);
    expect(onTickB).toHaveBeenCalledTimes(countB);
    expect(hookA.result.current.isPressed).toBe(false);
    expect(hookB.result.current.isPressed).toBe(false);
  });

  it('ignores pointerup from a different pointerId than the one being tracked', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown', 1)); });
    act(() => { vi.advanceTimersByTime(600); });

    // Stray pointerup from a different finger — must not release.
    act(() => { result.current.bind.onPointerUp(makePointerEvent('pointerup', 99)); });

    const countBefore = onTick.mock.calls.length;
    act(() => { vi.advanceTimersByTime(200); });
    expect(onTick.mock.calls.length).toBeGreaterThan(countBefore);
  });
});
```

**Step 2: Run and verify results**

Run: `cd frontend && npm test -- useHoldButton`

Expected: first two cancel tests and the pointerId-discrimination test should already pass (the release logic from Task 4 handles them). The `globalCancelBus.abortAll()` test should pass as well since we registered the abort in Task 4.

If all four pass: no implementation needed, skip to Step 3.

If any fail: implementation is incomplete — check `release()` function in the hook; the abort registered in `onPointerDown` must call `release()` (it does). Debug before proceeding.

**Step 3: Commit**

```bash
git add frontend/src/hooks/__tests__/useHoldButton.test.tsx
git commit -m "$(cat <<'EOF'
test: verify useHoldButton cancellation behavior

Covers pointercancel, pointerleave, globalCancelBus.abortAll, and
pointerId discrimination against stray pointerup events.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Write failing test — disabled state ignores events

**Files:**
- Modify: `frontend/src/hooks/__tests__/useHoldButton.test.tsx`

**Step 1: Append the disabled-state test**

Append:

```tsx
describe('useHoldButton — disabled', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not fire onTick when disabled', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useHoldButton({ onTick, curve: TEST_CURVE, disabled: true })
    );

    act(() => { result.current.bind.onPointerDown(makePointerEvent('pointerdown')); });
    act(() => { vi.advanceTimersByTime(2000); });

    expect(onTick).not.toHaveBeenCalled();
    expect(result.current.isPressed).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd frontend && npm test -- useHoldButton`

Expected: passes — the `if (optsRef.current.disabled) return;` check in `onPointerDown` (from Task 4) handles this.

**Step 3: Commit**

```bash
git add frontend/src/hooks/__tests__/useHoldButton.test.tsx
git commit -m "$(cat <<'EOF'
test: verify useHoldButton disabled state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Export curves and add them to the hook module

**Files:**
- Modify: `frontend/src/hooks/useHoldButton.ts`

**Step 1: Append curve constants to the hook file**

At the end of `useHoldButton.ts`, add:

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

**Step 2: Verify typecheck + tests**

Run: `cd frontend && npx tsc --noEmit && npm test -- useHoldButton`

Expected: no errors, all tests still passing.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useHoldButton.ts
git commit -m "$(cat <<'EOF'
feat: export LIFE_CURVE and COMMANDER_DAMAGE_CURVE constants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Add global cancel listeners in `ActiveGame`

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Step 1: Add the import**

Near the top of `ActiveGame.tsx`, with the other imports, add:

```ts
import { globalCancelBus } from '../../hooks/useHoldButton';
```

**Step 2: Add the effect**

Inside the `ActiveGame` component body, after the existing `useEffect` blocks (search for the timer `useEffect` around line 106 and add below it), add:

```ts
  // Global cancel: abort all active hold presses when the app backgrounds or loses focus.
  // This fixes the "stuck counter when user swipes off the PWA mid-press" bug.
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

**Step 3: Verify typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`

Expected: no errors.

**Step 4: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "$(cat <<'EOF'
feat: wire globalCancelBus listeners in ActiveGame

visibilitychange, pagehide, and blur all abort any active hold press.
Fixes the stuck-counter bug where holding a button while swiping off
the PWA left timers running.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Replace life buttons with `useHoldButton`

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Step 1: Create a per-player wrapper component for the life buttons**

The hook must be called once per button, per player, at top level. Since players are rendered in a `.map()`, the cleanest fix is to extract the player card's life-button section into a new component.

Add this component **inside** `ActiveGame.tsx`, above the `ActiveGame` function declaration:

```tsx
interface LifeButtonsProps {
  position: number;
  disabled: boolean;
  onLifeChange: (position: number, delta: number) => void;
  deltaDisplay: number | undefined;
}

function LifeButtons({ position, disabled, onLifeChange, deltaDisplay }: LifeButtonsProps) {
  const minus = useHoldButton({
    curve: LIFE_CURVE,
    disabled,
    onTick: (step) => onLifeChange(position, -step),
  });
  const plus = useHoldButton({
    curve: LIFE_CURVE,
    disabled,
    onTick: (step) => onLifeChange(position, step),
  });

  const minusLabel = deltaDisplay !== undefined && deltaDisplay < 0 ? String(deltaDisplay) : '−';
  const plusLabel = deltaDisplay !== undefined && deltaDisplay > 0 ? `+${deltaDisplay}` : '+';

  return (
    <>
      <button
        className={`life-btn-side life-btn-left ${minus.isPressed ? 'active' : ''}`}
        disabled={disabled}
        {...minus.bind}
      >
        {minusLabel}
      </button>
      <button
        className={`life-btn-side life-btn-right ${plus.isPressed ? 'active' : ''}`}
        disabled={disabled}
        {...plus.bind}
      >
        {plusLabel}
      </button>
    </>
  );
}
```

Add the import at the top:

```ts
import { useHoldButton, LIFE_CURVE, COMMANDER_DAMAGE_CURVE, globalCancelBus } from '../../hooks/useHoldButton';
```

(replacing the import you added in Task 10 with this expanded one)

**Step 2: Replace the life buttons in the render**

In `ActiveGame.tsx`, find the `{/* Normal Life Tracking Mode */}` block (around line 1151). Replace the two `<button className="life-btn-side ...">` elements (the minus and plus buttons) with:

```tsx
                  <LifeButtons
                    position={player.position}
                    disabled={playerState.eliminated}
                    onLifeChange={handleLifeChange}
                    deltaDisplay={lifeChangeDeltaMap[player.position]}
                  />
```

Keep the surrounding `<div className="absolute inset-0 ...">{playerState.life}</div>` block unchanged.

**Step 3: Verify typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`

Expected: errors about unused `handleLifeButtonDown`, `handleLifeButtonUp`, `activeButton`, `holdTimerRef`, etc. — that's fine, we remove them in Task 13.

**Step 4: Start dev server and smoke-test**

Run in one terminal: `cd frontend && npm run dev`
Run in another: backend is already running per `CLAUDE.md` — verify at http://localhost:5173 that you can start a game and the life buttons still work (tap +1/-1, hold ramps up).

**Step 5: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "$(cat <<'EOF'
feat: replace life buttons with useHoldButton hook

Extract LifeButtons component; each instance owns its own press state
via useHoldButton. Per-button refs mean multi-touch works — two
players can press simultaneously without interfering.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Replace commander damage buttons with `useHoldButton`

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Step 1: Add CommanderDamageButtons wrapper component**

Add this component next to `LifeButtons`:

```tsx
interface CommanderDamageButtonsProps {
  opponentPosition: number;
  onDamageChange: (opponentPosition: number, delta: number) => void;
  deltaDisplay: number | undefined;
}

function CommanderDamageButtons({ opponentPosition, onDamageChange, deltaDisplay }: CommanderDamageButtonsProps) {
  const minus = useHoldButton({
    curve: COMMANDER_DAMAGE_CURVE,
    onTick: (step) => onDamageChange(opponentPosition, -step),
  });
  const plus = useHoldButton({
    curve: COMMANDER_DAMAGE_CURVE,
    onTick: (step) => onDamageChange(opponentPosition, step),
  });

  const minusLabel = deltaDisplay !== undefined && deltaDisplay < 0 ? String(deltaDisplay) : '−';
  const plusLabel = deltaDisplay !== undefined && deltaDisplay > 0 ? `+${deltaDisplay}` : '+';

  return (
    <>
      <button
        className={`life-btn-side life-btn-left ${minus.isPressed ? 'active' : ''}`}
        {...minus.bind}
      >
        {minusLabel}
      </button>
      <button
        className={`life-btn-side life-btn-right ${plus.isPressed ? 'active' : ''}`}
        {...plus.bind}
      >
        {plusLabel}
      </button>
    </>
  );
}
```

**Step 2: Replace the commander damage buttons in render**

Find the `{/* Commander Damage Tracking Mode */}` block → the else branch `// This is an opponent's card` (around line 1243). Replace the two `<button className="life-btn-side ...">` elements with:

```tsx
                      <CommanderDamageButtons
                        opponentPosition={player.position}
                        onDamageChange={handleCommanderDamageChange}
                        deltaDisplay={commanderDamageDeltaMap[player.position]}
                      />
```

Keep the surrounding `<div className="absolute inset-0 ...">{commanderDamage}</div>` block unchanged.

**Step 3: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`

Expected: still unused-variable warnings from old handlers — cleaned up in Task 13.

**Step 4: Smoke-test in the browser**

Run: `cd frontend && npm run dev`

In the match tracker, swipe to commander damage mode and verify ± buttons work with the new accelerating curve.

**Step 5: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "$(cat <<'EOF'
feat: replace commander damage buttons with useHoldButton hook

DRYs up ~60 lines that duplicated the life button hold logic. Uses
COMMANDER_DAMAGE_CURVE (slower ramp than life).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Remove dead hold-button code from `ActiveGame`

**Files:**
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Step 1: Delete the stale refs and state**

Remove these declarations from the `ActiveGame` component body:

- `const [activeButton, setActiveButton] = useState<{ position: number; type: 'minus' | 'plus' } | null>(null);` (around line 58)
- `const holdTimerRef = useRef<number | null>(null);` and the three siblings `holdIntervalRef`, `holdStartTime`, `holdPosition`, `holdDelta` (around lines 93–97)

**Step 2: Delete the helper functions**

Remove these function declarations:

- `clearHoldTimers` (around line 427)
- `handleLifeButtonDown` (around line 438)
- `handleLifeButtonUp` (around line 461)
- `handleCommanderDamageButtonDown` (around line 598)
- `handleCommanderDamageButtonUp` (around line 623)

**Step 3: Delete the cleanup effect for `clearHoldTimers`**

Remove:
```tsx
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearHoldTimers();
    };
  }, []);
```
(around line 493)

**Step 4: Update the swipe handler to use globalCancelBus**

In `handleTouchMove` (around line 822), the line that reads `clearHoldTimers(); setActiveButton(null);` when swipe is detected — replace with:

```ts
          // Abort any active hold on this or any other button the moment a swipe is confirmed.
          globalCancelBus.abortAll();
```

In `handleLifeButtonUp` and `handleCommanderDamageButtonUp`, these functions are already gone — but double-check that no remaining reference exists (the IDE will flag any).

**Step 5: Verify lint + typecheck + tests all pass**

Run: `cd frontend && npm run lint && npx tsc --noEmit && npm test`

Expected: no errors, no unused-variable warnings, all tests pass.

**Step 6: Smoke-test**

Run: `cd frontend && npm run dev`

Smoke check:
- Tap +/- → changes by 1
- Hold +/- for 2 seconds → ramps up
- Swipe across card → enters commander damage mode, any held button aborts
- Switch to another browser tab while holding → come back, counter isn't runaway

**Step 7: Commit**

```bash
git add frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "$(cat <<'EOF'
refactor: remove dead hold-button code from ActiveGame

~80 lines: shared refs, helpers, and mouse/touch handlers that were
replaced by useHoldButton. Swipe-detection now calls
globalCancelBus.abortAll() to cancel any active press.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Delete the stale `useLongPress` hook

**Files:**
- Delete: `frontend/src/hooks/useLongPress.ts`

**Step 1: Verify it's unused**

Run:
```bash
cd /home/nturner/PersonalRepos/MTGLeaderboard && grep -r "useLongPress" frontend/src
```

Expected: no results (or only the file itself). If any files import it, stop — investigate before deleting.

**Step 2: Delete the file**

```bash
rm frontend/src/hooks/useLongPress.ts
```

**Step 3: Verify build still works**

Run: `cd frontend && npm run build`

Expected: build succeeds.

**Step 4: Commit**

```bash
git add -A frontend/src/hooks/useLongPress.ts
git commit -m "$(cat <<'EOF'
refactor: delete unused useLongPress hook

Stale dual-handler implementation from the 2026-02-28 design that was
never wired up. Replaced by useHoldButton.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Visual polish — press scale, number pulse, delta spring, CSS hardening

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/match-tracker/ActiveGame.tsx`

**Step 1: Add CSS hardening in `@layer base`**

Open `frontend/src/index.css`. Find the existing `@layer base { ... }` block. Inside it, add:

```css
  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  body {
    overscroll-behavior: none;
  }
```

**Step 2: Add touch-action + user-select to match-tracker buttons**

Still in `index.css`, find the `.life-btn-side` rule (around line 2459) and add inside its body:

```css
    touch-action: manipulation;
  }
```

Find the `.player-card` rule and add inside its body:

```css
    touch-action: manipulation;
    user-select: none;
  }
```

(Note: `.player-card` already sets `user-select: none` via inheritance from other rules; if it's there, don't duplicate.)

**Step 3: Add whole-card press scale**

In `index.css`, in the `@layer components` block near the other player-card styles, add:

```css
  .player-card.is-pressing {
    transform: scale(0.97);
    transition: transform 90ms ease-out;
  }

  /* Rotated top-row cards need their pressing transform to preserve rotation */
  .players-grid.layout-table.players-3 .player-slot:nth-child(1).is-pressing,
  .players-grid.layout-table.players-3 .player-slot:nth-child(2).is-pressing,
  .players-grid.layout-table.players-4 .player-slot:nth-child(1).is-pressing,
  .players-grid.layout-table.players-4 .player-slot:nth-child(2).is-pressing,
  .players-grid.layout-table.players-5 .player-slot:nth-child(1).is-pressing,
  .players-grid.layout-table.players-5 .player-slot:nth-child(2).is-pressing,
  .players-grid.layout-table.players-5 .player-slot:nth-child(3).is-pressing,
  .players-grid.layout-table.players-6 .player-slot:nth-child(1).is-pressing,
  .players-grid.layout-table.players-6 .player-slot:nth-child(2).is-pressing,
  .players-grid.layout-table.players-6 .player-slot:nth-child(3).is-pressing {
    transform: rotate(180deg) scale(0.97);
    transition: transform 90ms ease-out;
  }
```

**Step 4: Add life number pulse**

Still in `@layer components`:

```css
  @keyframes life-pulse {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
  .life-total.is-pulsing {
    animation: life-pulse 140ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
```

**Step 5: Wire press scale into the React component**

In `ActiveGame.tsx`, update the `LifeButtons` and `CommanderDamageButtons` wrappers to **also return** the `isPressed` flag for the parent to consume. Change their signatures:

For `LifeButtons`, wrap the return in a fragment and expose `isPressed` via a **render prop**. Simpler approach: pass an `onPressingChange` callback:

Update `LifeButtonsProps`:
```ts
interface LifeButtonsProps {
  position: number;
  disabled: boolean;
  onLifeChange: (position: number, delta: number) => void;
  deltaDisplay: number | undefined;
  onPressingChange: (pressing: boolean) => void;
}
```

Inside `LifeButtons`, add:
```ts
  useEffect(() => {
    onPressingChange(minus.isPressed || plus.isPressed);
  }, [minus.isPressed, plus.isPressed, onPressingChange]);
```

Add the matching import at the top:
```ts
import { useState, useEffect, useRef, useCallback } from 'react';
```

(`useEffect` should already be there; `useCallback` is new.)

In the parent `ActiveGame`, add a per-player pressing state:

```ts
  const [pressingByPosition, setPressingByPosition] = useState<Record<number, boolean>>({});
  const handlePressingChange = useCallback((position: number, pressing: boolean) => {
    setPressingByPosition((prev) => ({ ...prev, [position]: pressing }));
  }, []);
```

Update the `<LifeButtons />` JSX:
```tsx
                  <LifeButtons
                    position={player.position}
                    disabled={playerState.eliminated}
                    onLifeChange={handleLifeChange}
                    deltaDisplay={lifeChangeDeltaMap[player.position]}
                    onPressingChange={(pressing) => handlePressingChange(player.position, pressing)}
                  />
```

Repeat the pattern for `CommanderDamageButtons` (pass `opponentPosition` into `handlePressingChange`).

Add `is-pressing` conditionally to the player card's className:
```tsx
            <div
              key={player.position}
              className={`player-card player-slot ${playerState.eliminated ? 'eliminated' : ''} ${playerState.eliminated && playerState.eliminationConfirmed ? 'elimination-confirmed' : ''} ${commanderDamageMode ? 'commander-damage-mode' : ''} ${isTrackingPlayer ? 'tracking-player' : ''} ${selectingFirstPlayer && diceRollPhase === 'idle' ? 'cursor-pointer' : ''} ${pressingByPosition[player.position] ? 'is-pressing' : ''}`}
```

**Step 6: Wire life number pulse**

In the `ActiveGame` function body, add a pulse-state map:

```ts
  const [pulsingPositions, setPulsingPositions] = useState<Record<number, number>>({});
  // Track previous life per player to detect changes
  const prevLifeRef = useRef<Record<number, number>>({});

  useEffect(() => {
    for (const p of players) {
      const current = gameState.playerStates[p.position].life;
      const prev = prevLifeRef.current[p.position];
      if (prev !== undefined && prev !== current) {
        const token = Date.now();
        setPulsingPositions((s) => ({ ...s, [p.position]: token }));
        setTimeout(() => {
          setPulsingPositions((s) => {
            if (s[p.position] !== token) return s;
            const next = { ...s };
            delete next[p.position];
            return next;
          });
        }, 140);
      }
      prevLifeRef.current[p.position] = current;
    }
  }, [gameState, players]);
```

Apply `is-pulsing` conditionally to the `.life-total` div:

```tsx
                    <div className={`life-total ${pulsingPositions[player.position] ? 'is-pulsing' : ''}`}>
                      {playerState.life}
                    </div>
```

**Step 7: Upgrade the delta bubble visual**

In `index.css`, find any existing delta animation (search for `delta` in the file). If none exists, the delta number is drawn via the button label today, so the pulse in Step 6 is the visible feedback. Add a standalone floating delta on top of the life total — insert in `@layer components`:

```css
  @keyframes delta-float {
    0%   { opacity: 0; transform: translate(-50%, 0) scale(0.8); }
    15%  { opacity: 1; transform: translate(-50%, -2px) scale(1.05); }
    100% { opacity: 0; transform: translate(-50%, -14px) scale(1); }
  }
  .delta-bubble {
    position: absolute;
    left: 50%;
    top: 15%;
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 2px 4px rgba(0,0,0,0.4);
    pointer-events: none;
    animation: delta-float 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .delta-bubble.negative { color: #ef4444; }
  .delta-bubble.positive { color: #22c55e; }
```

In the player card render, above the `<div className="life-total ...">`, add:

```tsx
                    {lifeChangeDeltaMap[player.position] !== undefined && lifeChangeDeltaMap[player.position] !== 0 && (
                      <div
                        key={`delta-${lifeChangeDeltaMap[player.position]}-${player.position}`}
                        className={`delta-bubble ${lifeChangeDeltaMap[player.position] > 0 ? 'positive' : 'negative'}`}
                      >
                        {lifeChangeDeltaMap[player.position] > 0 ? '+' : ''}{lifeChangeDeltaMap[player.position]}
                      </div>
                    )}
```

(The `key` includes the delta value so React remounts the element and restarts the animation every time the total delta changes.)

**Step 8: Lint + typecheck + tests + smoke**

Run: `cd frontend && npm run lint && npx tsc --noEmit && npm test`

Expected: all green.

Run: `cd frontend && npm run dev` and verify at http://localhost:5173:
- Tapping a life button: card briefly scales down, number pulses, delta bubble floats up and fades
- Holding a life button: number rapidly ticks with pulse per tick (throttled by the 140ms animation — fine)
- No tap highlight gray flash on iOS (test with Safari Develop → Responsive Design → iPhone)
- No overscroll rubber band on the page
- No long-press callout menu on iOS

**Step 9: Commit**

```bash
git add frontend/src/index.css frontend/src/components/match-tracker/ActiveGame.tsx
git commit -m "$(cat <<'EOF'
feat: native-feel polish for life tracker

- Whole-card press scale (0.97) with 90ms ease-out
- Life total pulse (1.0→1.08→1.0, spring ease) on every change
- Floating delta bubble with spring entry + upward drift
- CSS hardening: -webkit-tap-highlight-color, -webkit-touch-callout,
  overscroll-behavior, touch-action: manipulation
- Rotation-aware press scale for top-row players

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Manual QA on device

**Files:** none (testing)

**Step 1: Build and deploy or test locally**

Option A (fastest): `cd frontend && npm run dev` + iOS Safari at `http://<your-LAN-IP>:5173/` from an actual iPhone/iPad. Make sure the phone is on the same network.

Option B: `npm run build && npm run preview` for a production-like test.

Option C: Full deploy via the `deploy` skill after confirming locally.

**Step 2: Run the manual test matrix**

For each of these combinations, verify the checklist below:

- **iOS Safari PWA** (add to home screen, open from home screen)
- **Android Chrome PWA**
- **Desktop Chrome** (for regression sanity only — not the target platform)

**Checklist:**

1. ☐ Start a 4-player match and record life to first player. Tap + → life goes from 40 to 41, delta bubble floats up, number pulses, card briefly scales down.
2. ☐ Rapid-tap + 10 times in 2 seconds. Life should land at exactly 50. No drops, no double-counts.
3. ☐ Hold + for ~600ms then release. Life should be ~40 + 1 (tap) + 1-2 (stage-0 repeats) = ~42-43. **Not 51**. (This is the +11 regression test.)
4. ☐ Hold + for 3 seconds. Life should ramp from 40 → 41, 42, 43… (fine) then 48, 53, 58… (medium) then 68, 78… (fast).
5. ☐ Hold + and swipe your finger completely off the screen (off the bottom edge). Life should **stop incrementing** the moment the finger leaves. No stuck counter.
6. ☐ Hold + and switch apps (swipe up home indicator). Wait 5 seconds. Return to the app. Counter must have **stopped** at wherever it was when you left. Card should not be stuck in "pressed" state.
7. ☐ Two players press + simultaneously. Both increment independently. Neither steals the other's input.
8. ☐ Swipe horizontally across a player card to enter commander damage mode while holding +. The hold aborts cleanly (no spurious ticks after swipe).
9. ☐ In commander damage mode, tap an opponent's + button. Damage goes 0 → 1. Hold for 2 seconds — damage ramps using the slower `COMMANDER_DAMAGE_CURVE`.
10. ☐ Long-press anywhere on iOS — no share/copy menu appears.
11. ☐ Try to pinch-zoom the match tracker — it shouldn't zoom.
12. ☐ Pull down from the top of the match tracker — no rubber-band overscroll.
13. ☐ Eliminated player's buttons are disabled (no ticks on tap).
14. ☐ On desktop, right-click a button — standard context menu should NOT affect hold state when dismissed.

**Step 3: If any item fails**

Create a follow-up task with the specific failure and the device/browser. Do not merge until all items pass on iOS Safari and Android Chrome.

**Step 4: Record results**

Append a "## QA Results" section to this plan file with date, device matrix, and any follow-ups.

**Step 5: Commit QA notes**

```bash
git add docs/plans/2026-04-21-life-tracker-native-feel.md
git commit -m "$(cat <<'EOF'
docs: record life-tracker QA results

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done criteria

- All unit tests pass (`npm test`)
- All lint + typecheck pass (`npm run lint && npx tsc --noEmit`)
- All 14 manual QA items pass on iOS Safari PWA and Android Chrome PWA
- `ActiveGame.tsx` is shorter by ~80 lines
- No reference to `useLongPress` anywhere in `frontend/src`
