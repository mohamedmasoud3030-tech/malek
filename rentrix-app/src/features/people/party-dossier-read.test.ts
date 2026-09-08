import { beforeEach, expect, it, vi } from 'vitest';
import { getPersonDossier } from './people-service';
import { getTenantDossier } from '../tenants/tenantWorkspaceService';
import { listContractsForTenants } from '../contracts/services/contractService';

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
beforeEach(() => vi.clearAllMocks());

function install(failContractSuffix = false) {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    people: [{ id: 'party', type: 'tenant', full_name: 'مستأجر' }],
    contracts: [
      ...Array.from({ length: 1001 }, (_, i) => ({ id: `c${i}`, tenant_id: 'party', status: 'ACTIVE' })),
      { id: 'foreign', tenant_id: 'another-party' },
      { id: 'deleted', tenant_id: 'party', deleted_at: '2026-09-09' },
    ],
    invoices: [{ id: 'invoice', contract_id: 'c1000', amount: 100, tax_amount: 5, paid_amount: 40, credited_amount: 65 }],
    receipts: [], communication_records: [],
  };
  backend.from.mockImplementation((table: string) => {
    let rows = tables[table] ?? [];
    let single = false;
    let from = 0;
    let to = 999;
    const q = {
      select: () => q, order: () => q, returns: () => q,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return q; },
      in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return q; },
      is: (key: string, value: unknown) => { rows = rows.filter((row) => (row[key] ?? null) === value); return q; },
      maybeSingle: () => { single = true; return q; },
      limit: (size: number) => { to = size - 1; return q; },
      range: (start: number, end: number) => { from = start; to = end; return q; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(
        failContractSuffix && table === 'contracts' && from > 0
          ? { data: null, error: new Error('contract suffix unavailable') }
          : { data: single ? rows[0] ?? null : rows.slice(from, to + 1), error: null },
      )),
    };
    return q;
  });
}

it.each([getPersonDossier, getTenantDossier])('dossier %s includes the final contract and its invoice without reading other parties', async (load) => {
  install();
  const result = await load('party', { includeFinancial: true, includeActivity: false });
  expect(result.contracts).toHaveLength(1001);
  expect(result.contracts.map((row) => row.id)).not.toContain('foreign');
  expect(result.contracts.map((row) => row.id)).not.toContain('deleted');
  expect(result.invoices).toHaveLength(1);
  expect(result.invoices[0]).toMatchObject({ id: 'invoice', tax_amount: 5, credited_amount: 65 });
  expect(backend.from).not.toHaveBeenCalledWith('communication_records');
});

it.each([getPersonDossier, getTenantDossier])('dossier %s retains financial/activity permission gates', async (load) => {
  install();
  const result = await load('party', { includeFinancial: false, includeActivity: false });
  expect(result.invoices).toEqual([]);
  for (const table of ['invoices', 'receipts', 'communication_records']) expect(backend.from).not.toHaveBeenCalledWith(table);
});

it('rejects incomplete contract context rather than issuing a partial financial dossier', async () => {
  install(true);
  await expect(getTenantDossier('party', { includeFinancial: true, includeActivity: true })).rejects.toThrow('contract suffix unavailable');
  expect(backend.from).not.toHaveBeenCalledWith('invoices');
});

it('never turns an empty party ID scope into an unfiltered contract read', async () => {
  install();
  expect(await listContractsForTenants([''])).toEqual([]);
  expect(backend.from).not.toHaveBeenCalled();
});
