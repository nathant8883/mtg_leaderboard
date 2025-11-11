/**
 * Type definitions for Screen Orientation API
 *
 * The Screen Orientation API is not yet fully typed in TypeScript's lib.dom.d.ts
 * This file extends the ScreenOrientation interface with the lock() and unlock() methods.
 *
 * Browser Support:
 * - Chrome/Edge on Android: Full support
 * - Safari iOS 16.4+: Only in installed PWA
 * - Firefox: Partial support
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
 */

interface ScreenOrientation extends EventTarget {
  /**
   * Locks the screen orientation to the specified type.
   *
   * @param orientation - The orientation to lock to ('portrait', 'landscape', etc.)
   * @returns Promise that resolves when the orientation is locked
   * @throws DOMException if the lock cannot be acquired
   */
  lock(orientation: OrientationLockType): Promise<void>;

  /**
   * Unlocks the screen orientation, allowing it to change freely.
   */
  unlock(): void;

  /**
   * Returns the current screen orientation type.
   */
  readonly type: OrientationType;

  /**
   * Returns the current screen orientation angle.
   */
  readonly angle: number;
}

type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

type OrientationType =
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

interface Screen {
  readonly orientation: ScreenOrientation;
}
