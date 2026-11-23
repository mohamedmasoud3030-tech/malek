import { describe, expect, it } from 'vitest';
import { normalizeUnitIds } from './unit-ids';

describe('normalizeUnitIds', () => {
  it('filters empty IDs, deduplicates, and sorts for stable queries', () => {
    expect(normalizeUnitIds(['unit-2', '', 'unit-1', 'unit-2'])).toEqual(['unit-1', 'unit-2']);
  });
});
