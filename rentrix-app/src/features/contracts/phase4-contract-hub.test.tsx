import { describe, expect, it } from 'vitest';
import { RelationshipsHubPage } from '@/features/relationships-hub/relationships-hub-workspace';
import { ContractsRouteComponent } from '@/routes/_protected.contracts';

describe('contracts route wiring', () => {
  it('ContractsRouteComponent points to the relationships hub page', () => {
    expect(ContractsRouteComponent).toBe(RelationshipsHubPage);
  });
});
