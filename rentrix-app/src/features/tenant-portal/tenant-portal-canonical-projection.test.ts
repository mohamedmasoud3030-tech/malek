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

  it('keeps the external function read-only except link telemetry', () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.(contracts|invoices|receipts|utility_bills|maintenance_records|vault_documents)/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.(contracts|invoices|receipts|utility_bills|maintenance_records|vault_documents)/i);
    expect(migration).toContain('update public.tenant_portal_links');
  });
});
