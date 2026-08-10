import { describe, expect, it } from 'vitest';
import { ContractsListPage } from '@/features/contracts/ContractsListPage';
import { ContractsRouteComponent } from '@/routes/_protected.contracts';

describe('contracts route ownership', () => {
  it('renders only the contracts workspace; People owns leads and communication', () => {
    expect(ContractsRouteComponent).toBe(ContractsListPage);
  });
});
