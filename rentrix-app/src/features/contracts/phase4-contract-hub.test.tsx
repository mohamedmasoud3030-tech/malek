import { describe, expect, it } from 'vitest';
import { LeasingHubPage } from '@/features/relationships-hub/leasing-hub-workspace';
import { ContractsRouteComponent } from '@/routes/_protected.contracts';

describe('contracts route ownership', () => {
  it('routes the primary contracts entry through the unified Leasing workspace', () => {
    expect(ContractsRouteComponent).toBe(LeasingHubPage);
  });
});
