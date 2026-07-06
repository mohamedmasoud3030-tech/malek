import { describe, expect, it } from 'vitest';
import { formatPropertyUnitSummary } from './property-card-utils';

describe('formatPropertyUnitSummary helper', () => {
  it('does not display developer wording when units are undefined', () => {
    const result = formatPropertyUnitSummary(undefined, undefined);
    
    // Ensure the developer wording is removed
    expect(result.text).not.toContain('الوحدات غير محسوبة هنا');
    
    // Instead it must return a clean, clear message or neutral label
    expect(result.text).toBe('تفاصيل الوحدات');
  });

  it('displays accurate unit counts when available', () => {
    const result = formatPropertyUnitSummary(5, 2);
    expect(result.text).toBe('2/5 وحدة');
    expect(result.hasCount).toBe(true);
  });
});
