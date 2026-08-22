import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// P0 regression guard: the deposit contract picker must present readable
// business labels (tenant — unit — property) instead of truncated UUIDs,
// while the UUID remains the internal option value and payload field.
// After refactor, checks are spread across queries, controller, forms, columns, doc.

const workspace = readFileSync(resolve(import.meta.dirname, './deposits-workspace.tsx'), 'utf8');
const controller = readFileSync(resolve(import.meta.dirname, './use-deposit-workspace-controller.ts'), 'utf8');
const queries = readFileSync(resolve(import.meta.dirname, './deposit-workspace-queries.ts'), 'utf8');
const forms = readFileSync(resolve(import.meta.dirname, './deposit-action-forms.tsx'), 'utf8');
const columns = readFileSync(resolve(import.meta.dirname, './deposit-table-columns.tsx'), 'utf8');
const doc = readFileSync(resolve(import.meta.dirname, './deposit-clearance-document.ts'), 'utf8');
const service = readFileSync(resolve(import.meta.dirname, './deposit-service.ts'), 'utf8');
const options = readFileSync(resolve(import.meta.dirname, './deposit-contract-options.ts'), 'utf8');

const all = [workspace, controller, queries, forms, columns, doc].join('\n');

describe('deposit contract options are human-readable', () => {
  it('fetches tenant, property, and unit display fields for the picker', () => {
    expect(queries).toContain('people:people!contracts_tenant_id_fkey(id,full_name)');
    expect(queries).toContain('properties:properties!contracts_property_id_fkey(id,title)');
    expect(queries).toContain('units:units!contracts_unit_id_fkey(id,unit_number)');
  });

  it('labels options with the readable formatter and keeps the UUID as the value', () => {
    expect(forms).toContain('value={contract.id}');
    expect(forms).toContain('formatContractOptionLabel');
    expect(all).not.toContain('{contract.id.slice(0, 8)} - عقار');
  });

  it('shows a visual confirmation of the selected contract before saving', () => {
    expect(controller).toContain('selectedContract');
    expect(forms).toContain('describeSelectedContract');
    expect(forms).toContain('العقد المحدد');
  });

  it('keeps the create payload unchanged (contract_id, amount, dates, notes, request_id)', () => {
    expect(controller).toContain('contract_id: createForm.contract_id');
    expect(controller).toContain('amount: createForm.amount');
    expect(controller).toContain('received_date: createForm.received_date');
    expect(controller).toContain('notes: createForm.notes || null');
    expect(controller).toContain('request_id: crypto.randomUUID()');
  });

  it('the deposits list no longer titles rows with a truncated contract UUID or raw tenant_id', () => {
    expect(all).not.toContain('وديعة عقد {deposit.contract_id.slice(0, 8)}');
    expect(all).not.toContain('deposit.tenant_name || deposit.tenant_id');
    expect(all).not.toContain('deposit.property_title || deposit.property_id');
    expect(all).not.toContain('deposit.unit_number || deposit.unit_id');
    expect(columns).toContain('formatDepositContractReference');
  });

  it('the printed clearance document references the contract readably, never the raw UUID', () => {
    expect(doc).not.toContain("{ label: 'معرف العقد', value: deposit.contract_id }");
    expect(doc).toContain('formatDepositContractReference');
    expect(doc).toContain("label: 'العقد'");
    expect(doc).toContain('contractReference');
  });

  it('the list query resolves tenant names through the contract and never exposes raw ids as names', () => {
    expect(service).toContain('contracts:contract_id(people:tenant_id(id,full_name))');
    expect(service).toContain("tenant_name: row.contracts?.people?.full_name ?? row.people?.full_name ?? null");
    expect(service).toContain('property_title: row.properties?.title ?? null');
    expect(service).toContain('unit_number: row.units?.unit_number ?? null');
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
