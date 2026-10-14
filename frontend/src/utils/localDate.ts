/**
 * YYYY-MM-DD in the device's local timezone.
 *
 * Don't use `toISOString().split('T')[0]`: that's the UTC date, so a game
 * finishing on a US evening gets tomorrow's date (and on Dec 31, next season).
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
