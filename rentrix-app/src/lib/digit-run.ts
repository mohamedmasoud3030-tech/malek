/**
 * Linear digit-run detection.
 *
 * Replaces the nested-quantifier pattern `(?:\d[\s-]*){8,}` (flagged for
 * super-linear backtracking) with a single-pass scan of identical semantics:
 * it reports whether the text contains a run of at least `minDigits` digits,
 * where digits may be separated by whitespace or hyphens — the shape of
 * phone numbers, IBANs and account numbers that sensitive-content guards
 * must never echo back. Any other character terminates the run.
 */
export function containsDigitRun(value: string, minDigits: number): boolean {
  let digits = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (char >= '0' && char <= '9') {
      digits += 1;
      if (digits >= minDigits) return true;
    } else if (char === ' ' || char === '-' || (char >= '\t' && char <= '\r')) {
      // Separator inside the run — keep counting digits.
    } else {
      digits = 0;
    }
  }
  return false;
}
