import { describe, expect, it } from 'vitest';
import { createEntityQueryKeys } from './query-keys';

describe('createEntityQueryKeys', () => {
  it('keeps entity invalidation broad while making list keys explicit', () => {
    const keys = createEntityQueryKeys<{ status: string }>('lands');

    expect(keys.all).toEqual(['lands']);
    expect(keys.list({ status: 'available' })).toEqual(['lands', 'list', { status: 'available' }]);
  });
});
