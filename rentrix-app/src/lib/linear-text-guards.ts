/**
 * Linear text-guard scanners.
 *
 * These guards detect sensitive content shapes (digit runs, email-like
 * tokens) in free text. They are single-pass O(n) scans instead of
 * quantifier-heavy regexes: unanchored `class+ literal` regexes degrade
 * super-linearly on hostile input (Sonar flags exactly that), and these
 * guards run on arbitrary text (notification payloads, support requests),
 * which is where such input would come from.
 */

/**
 * Reports whether the text contains a run of at least `minDigits` digits,
 * where digits may be separated by whitespace or hyphens — the shape of
 * phone numbers, IBANs and account numbers that sensitive-content guards
 * must never echo back. Any other character terminates the run.
 * (Replaces the nested-quantifier pattern `(?:\d[\s-]*){8,}`.)
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

function isSpaceChar(char: string): boolean {
  return char === ' ' || (char >= '\t' && char <= '\r');
}

/**
 * Reports whether the text contains an email-like token: one or more
 * non-space characters, then '@', then a domain part containing a dot that
 * has at least one character before and after it inside the same
 * whitespace-delimited token. Equivalent to what the classic
 * `[^\s@]+@[^\s@]+\.[^\s@]+` detection matched, without backtracking.
 */
export function containsEmailLikeToken(value: string): boolean {
  let localLength = 0; // non-space, non-'@' chars of the current token
  let afterAt = false; // an '@' with a non-empty local part was consumed
  let labelLength = 0; // domain chars since '@' or the last dot
  let dotAfterLabel = false; // a dot with >=1 char before it in the domain
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (isSpaceChar(char)) {
      localLength = 0;
      afterAt = false;
      labelLength = 0;
      dotAfterLabel = false;
      continue;
    }
    if (char === '@') {
      if (!afterAt && localLength > 0) {
        afterAt = true;
        labelLength = 0;
        dotAfterLabel = false;
      } else {
        // Double '@' or a leading '@' — this token cannot be an email.
        afterAt = false;
        localLength = 0;
        labelLength = 0;
        dotAfterLabel = false;
      }
      continue;
    }
    if (!afterAt) {
      localLength += 1;
      continue;
    }
    if (char === '.') {
      if (labelLength > 0) dotAfterLabel = true;
      labelLength = 0;
      continue;
    }
    labelLength += 1;
    if (dotAfterLabel) return true;
  }
  return false;
}
