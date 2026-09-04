import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260901000046_tenant_portal_canonical_projection.sql',
  ),
  'utf8',
);

// The CURRENT authority for the public snapshot after the bounded-projection
// migration; the v46 source is kept as the scope-history pin while this file
// pins the exposure boundary.
const boundedMigrationPath = resolve(
  import.meta.dirname,
  '../../../../supabase/migrations/20260904000000_bound_anonymous_portal_projections.sql',
);
const boundedMigration = readFileSync(boundedMigrationPath, 'utf8');

describe('tenant portal canonical projection', () => {
  it('derives every external section from the token-resolved contract scope', () => {
    expect(migration).toContain('where l.token = p_token');
    expect(migration).toContain('ub.contract_id = v_contract_id');
    expect(migration).toContain('r.contract_id = v_contract_id');
    expect(migration).toContain("vd.related_entity_id = v_contract_id::text");
  });

  it('returns document metadata without exposing storage locations', () => {
    const projection = migration.slice(
      migration.indexOf("select coalesce(jsonb_agg(jsonb_build_object(\n      'title', vd.title"),
      migration.indexOf('from public.vault_documents vd'),
    );
    expect(projection).toContain("'reference', vd.file_name");
    expect(projection).not.toContain('vd.file_url');
    expect(projection).not.toContain('vd.storage_path');
  });

  it('does not infer tenant maintenance from unit occupancy alone', () => {
    expect(migration).toContain("upper(coalesce(m.charged_to::text, '')) = 'TENANT'");
    expect(migration).toContain('between v_contract_start and v_contract_end');
    expect(migration).toContain("~ '^\\d{4}-\\d{2}-\\d{2}$'");
  });

  it('bounds every anon-facing list to a 50-row window with an honest total', () => {
    const tenantBody = boundedMigration.slice(
      boundedMigration.indexOf('create or replace function public.get_tenant_portal_snapshot'),
      boundedMigration.indexOf('-- Owner Portal: bounded, self-contained canonical projection.'),
    );
    // Five lists, five row-number windows, five disclosed totals.
    expect(tenantBody.match(/row_number\(\) over/g)?.length).toBe(5);
    expect(tenantBody.match(/filter \(where r\.rn <= 50\)/g)?.length).toBe(5);
    for (const total of [
      'dueScheduleTotal',
      'servicesTotal',
      'receiptsTotal',
      'documentsTotal',
      'maintenanceTotal',
    ]) {
      expect(tenantBody).toContain(`'${total}'`);
    }
  });

  it('keeps money aggregates complete over the unbounded row set', () => {
    // paidPosition sums must NOT be inside the rn<=50 filter: they aggregate
    // the whole ranked set so totals stay true even when lists are capped.
    const totalsLine = boundedMigration.slice(
      boundedMigration.indexOf("coalesce(sum(r.amount), 0)"),
      boundedMigration.indexOf("into v_due_schedule, v_due_schedule_total"),
    );
    expect(totalsLine).toContain('coalesce(sum(r.paid_amount), 0)');
    expect(totalsLine).not.toContain('r.rn <= 50');
  });

  it('preserves the metadata-only document rule and read-only posture in the bound version', () => {
    expect(boundedMigration).toContain('vd.deleted_at is null');
    expect(boundedMigration).not.toContain('vd.file_url');
    expect(boundedMigration).not.toContain('vd.storage_path');
    expect(boundedMigration).toContain('update public.tenant_portal_links');
    expect(boundedMigration).not.toMatch(/insert\s+into\s+public\.(contracts|invoices|receipts|utility_bills|maintenance_records|vault_documents)/i);
    expect(boundedMigration).not.toMatch(/delete\s+from\s+public\.(contracts|invoices|receipts|utility_bills|maintenance_records|vault_documents)/i);
  });

  it('keeps the external function read-only except link telemetry', () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.(contracts|invoices|receipts|utility_bills|maintenance_records|vault_documents)/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.(contracts|invoices|receipts|utility_bills|maintenance_records|vault_documents)/i);
    expect(migration).toContain('update public.tenant_portal_links');
  });
});
