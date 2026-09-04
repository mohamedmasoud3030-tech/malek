import { describe, expect, it } from 'vitest';
import { defineEntityKeys, invalidateEntity } from './query-keys';

describe('defineEntityKeys', () => {
  it('produces the canonical all/list/detail key shape', () => {
    const keys = defineEntityKeys('contracts');

    expect(keys.all).toEqual(['contracts']);
    expect(keys.lists()).toEqual(['contracts', 'list']);
    expect(keys.list({ status: 'active' })).toEqual(['contracts', 'list', { status: 'active' }]);
    expect(keys.detail('c-1')).toEqual(['contracts', 'detail', 'c-1']);
  });

  it('keeps parameterised list keys as [scope, "list", filters] — the shape Lands and Leads rely on for cache identity', () => {
    // Migration parity (Architecture Census P1-B): Lands and Leads previously
    // built list keys through createEntityQueryKeys. The consolidated helper
    // must emit the identical runtime key so no cache entries split.
    const landKeys = defineEntityKeys('lands');
    const leadKeys = defineEntityKeys('leads');

    expect(landKeys.all).toEqual(['lands']);
    expect(landKeys.list({ status: 'available' })).toEqual(['lands', 'list', { status: 'available' }]);

    expect(leadKeys.all).toEqual(['leads']);
    expect(leadKeys.list({ status: 'new' })).toEqual(['leads', 'list', { status: 'new' }]);
  });

  it('exposes a stable all namespace for prefix invalidation', async () => {
    const calls: unknown[][] = [];
    const queryClient = {
      invalidateQueries({ queryKey }: { queryKey: readonly unknown[] }) {
        calls.push([...queryKey]);
        return Promise.resolve();
      },
    };

    await invalidateEntity(
      queryClient as never,
      defineEntityKeys('lands').all,
      defineEntityKeys('leads').all,
    );

    expect(calls).toEqual([['lands'], ['leads']]);
  });
});
