import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// P0 regression guard: the deposit contract picker must present readable
// business labels (tenant — unit — property) instead of truncated UUIDs,
// while the UUID remains the internal option value and payload field.

const workspace = readFileSync(resolve(import.meta.dirname, './deposits-workspace.tsx'), 'utf8');
const service = readFileSync(resolve(import.meta.dirname, './deposit-service.ts'), 'utf8');
const options = readFileSync(resolve(import.meta.dirname, './deposit-contract-options.ts'), 'utf8');

describe('deposit contract options are human-readable', () => {
  it('fetches tenant, property, and unit display fields for the picker', () => {
    expect(workspace).toContain('people:tenant_id(id,full_name)');
    expect(workspace).toContain('properties:property_id(id,title)');
    expect(workspace).toContain('units:unit_id(id,unit_number)');
  });

  it('labels options with the readable formatter and keeps the UUID as the value', () => {
    expect(workspace).toContain('value={contract.id}');
    expect(workspace).toContain('{formatContractOptionLabel(contract)}');
    // The old opaque label is gone.
    expect(workspace).not.toContain('{contract.id.slice(0, 8)} - عقار');
  });

  it('shows a visual confirmation of the selected contract before saving', () => {
    expect(workspace).toContain('selectedContract');
    expect(workspace).toContain('describeSelectedContract(selectedContract)');
    expect(workspace).toContain('العقد المحدد');
  });

  it('keeps the create payload unchanged (contract_id, amount, dates, notes, request_id)', () => {
    expect(workspace).toContain('contract_id: createForm.contract_id');
    expect(workspace).toContain('amount: createForm.amount');
    expect(workspace).toContain('received_date: createForm.received_date');
    expect(workspace).toContain('notes: createForm.notes || null');
    expect(workspace).toContain('request_id: crypto.randomUUID()');
  });

  it('the deposits list no longer titles rows with a truncated contract UUID or raw tenant_id', () => {
    expect(workspace).not.toContain('وديعة عقد {deposit.contract_id.slice(0, 8)}');
    expect(workspace).not.toContain('deposit.tenant_name || deposit.tenant_id');
    expect(workspace).not.toContain('deposit.property_title || deposit.property_id');
    expect(workspace).not.toContain('deposit.unit_number || deposit.unit_id');
    expect(workspace).toContain('formatDepositContractReference(deposit)');
  });

  it('the printed clearance document references the contract readably, never the raw UUID', () => {
    expect(workspace).not.toContain("{ label: 'معرف العقد', value: deposit.contract_id }");
    expect(workspace).toContain('const contractReference = formatDepositContractReference(deposit);');
    expect(workspace).toContain("{ label: 'العقد', value: contractReference }");
  });

  it('the list query resolves tenant names through the contract and never exposes raw ids as names', () => {
    expect(service).toContain('contracts:contract_id(people:tenant_id(id,full_name))');
    expect(service).toContain("tenant_name: row.contracts?.people?.full_name ?? row.people?.full_name ?? null");
    expect(service).toContain('property_title: row.properties?.title ?? null');
    expect(service).toContain('unit_number: row.units?.unit_number ?? null');
    // No UUID-as-name fallbacks remain.
    expect(service).not.toContain('?? row.tenant_id ?? null');
    expect(service).not.toContain('?? row.property_id ?? null');
    expect(service).not.toContain('?? row.unit_id ?? null');
  });

  it('the shared formatter degrades to Arabic fallbacks and never prints UUIDs', () => {
    expect(options).toContain('مستأجر غير محدد');
    expect(options).toContain('وحدة غير محددة');
    expect(options).toContain('عقار غير محدد');
    expect(options).not.toContain('contract.id.slice');
    expect(options).not.toContain('tenant_id.slice');
  });
});
