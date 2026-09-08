import { expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { financialReadModelRoots, invalidateFinancialReadModels } from './financial-cache';
it('invalidates every financial projection scope without touching unrelated settings', async () => {
  const client = new QueryClient();
  for (const root of financialReadModelRoots) {
    client.setQueryData([root, 'scope-a'], 1);
    client.setQueryData([root, 'scope-b'], 2);
  }
  client.setQueryData(['settings', 'draft'], 'unchanged');
  await invalidateFinancialReadModels(client);
  for (const root of financialReadModelRoots) {
    expect(client.getQueryState([root, 'scope-a'])?.isInvalidated).toBe(true);
    expect(client.getQueryState([root, 'scope-b'])?.isInvalidated).toBe(true);
  }
  expect(client.getQueryState(['settings', 'draft'])?.isInvalidated).toBe(false);
  client.clear();
});
