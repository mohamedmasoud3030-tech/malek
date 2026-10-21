import { describe, expect, it } from 'vitest';
import { asJsonRecord } from './json-record';

describe('asJsonRecord', () => {
  it('accepts object records and rejects arrays and non-objects', () => {
    const record = { id: 'company-1' };
    expect(asJsonRecord(record)).toBe(record);
    expect(asJsonRecord(null)).toEqual({});
    expect(asJsonRecord(['not', 'a', 'record'])).toEqual({});
    expect(asJsonRecord('not a record')).toEqual({});
  });
});
