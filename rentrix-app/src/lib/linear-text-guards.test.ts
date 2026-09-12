import { describe, expect, it } from 'vitest';
import { containsDigitRun, containsEmailLikeToken } from './linear-text-guards';

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
    const hostile = `1${' '.repeat(100_000)}2`;
    const started = performance.now();
    expect(containsDigitRun(hostile, 8)).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('containsEmailLikeToken', () => {
  it('detects ordinary email shapes', () => {
    expect(containsEmailLikeToken('user@example.com')).toBe(true);
    expect(containsEmailLikeToken('contact support@malek.om now')).toBe(true);
    expect(containsEmailLikeToken('a@b.c')).toBe(true);
    expect(containsEmailLikeToken('first.last@sub.domain.co')).toBe(true);
  });

  it('accepts dots inside local and domain parts like the old regex did', () => {
    expect(containsEmailLikeToken('a@b..c')).toBe(true);
    expect(containsEmailLikeToken('weird..name@example.com')).toBe(true);
  });

  it('rejects shapes without a usable dot in the domain', () => {
    expect(containsEmailLikeToken('user@examplecom')).toBe(false);
    expect(containsEmailLikeToken('a@b.')).toBe(false);
    expect(containsEmailLikeToken('a@.b')).toBe(false);
    expect(containsEmailLikeToken('plain text')).toBe(false);
    expect(containsEmailLikeToken('@b.c')).toBe(false);
    expect(containsEmailLikeToken('a@@b.c')).toBe(false);
    expect(containsEmailLikeToken('')).toBe(false);
  });

  it('respects whitespace token boundaries', () => {
    expect(containsEmailLikeToken('user@ example.com')).toBe(false);
    expect(containsEmailLikeToken('user @example.com')).toBe(false);
  });

  it('runs in linear time on adversarial input', () => {
    const hostile = `${'a'.repeat(50_000)}@${'b'.repeat(50_000)}`;
    const started = performance.now();
    expect(containsEmailLikeToken(hostile)).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
