import { describe, expect, it } from 'vitest';
import { scopeOwnerRows } from './owner-settlement-scope';

describe('scopeOwnerRows', () => {
  const rows = [
    { id: 'settlement-a', owner_id: 'owner-a' },
    { id: 'settlement-b', owner_id: 'owner-b' },
    { id: 'settlement-c', owner_id: 'owner-a' },
  ];

  it('preserves the global workspace when no owner scope is supplied', () => {
    expect(scopeOwnerRows(rows)).toEqual(rows);
  });

  it('keeps only rows belonging to the contextual owner', () => {
    expect(scopeOwnerRows(rows, 'owner-a').map((row) => row.id)).toEqual([
      'settlement-a',
      'settlement-c',
    ]);
  });

  it('fails closed to an empty scope when the requested owner has no rows', () => {
    expect(scopeOwnerRows(rows, 'owner-missing')).toEqual([]);
  });
});
