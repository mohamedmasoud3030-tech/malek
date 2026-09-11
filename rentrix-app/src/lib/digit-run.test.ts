import { describe, expect, it } from 'vitest';
import { containsDigitRun } from './digit-run';

describe('containsDigitRun', () => {
  it('detects plain digit runs at the threshold', () => {
    expect(containsDigitRun('12345678', 8)).toBe(true);
    expect(containsDigitRun('abc 12345678 xyz', 8)).toBe(true);
    expect(containsDigitRun('1234567', 8)).toBe(false);
  });

  it('counts digits across space and hyphen separators (phone/IBAN shapes)', () => {
    expect(containsDigitRun('968 9123 4567', 8)).toBe(true);
    expect(containsDigitRun('968-9123-4567', 8)).toBe(true);
    expect(containsDigitRun('+968 9123 4567', 8)).toBe(true);
  });

  it('terminates runs on any other character', () => {
    expect(containsDigitRun('1234x5678', 8)).toBe(false);
    expect(containsDigitRun('1234.5678', 8)).toBe(false);
    expect(containsDigitRun('12 34 ab 56 78', 8)).toBe(false);
  });

  it('handles edge inputs', () => {
    expect(containsDigitRun('', 8)).toBe(false);
    expect(containsDigitRun('--------', 8)).toBe(false);
    expect(containsDigitRun('1', 1)).toBe(true);
  });

  it('runs in linear time on adversarial input', () => {
    // Long separator runs between sparse digits must not blow up.
    const hostile = `1${' '.repeat(100_000)}2`;
    const started = performance.now();
    expect(containsDigitRun(hostile, 8)).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
