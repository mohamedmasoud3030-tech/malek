/**
 * Drops trailing slashes from a path/origin in a single pass.
 *
 * The linear stand-in for the classic `value.replace(/\/+$/, '')`, whose
 * quantifier unwinds at every scan position when no slash run is present
 * (super-linear worst case — flagged by Sonar).
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === '/') end -= 1;
  return value.slice(0, end);
}
