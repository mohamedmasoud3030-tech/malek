/**
 * TD — Bounded anonymous portal projections (PGlite, full migration replay).
 *
 * The tenant/owner portal snapshot functions are the only anon-executable
 * SECURITY DEFINER surface. This suite proves the architectural invariant:
 *
 *   - every anon-facing LIST inside a snapshot is bounded to the newest
 *     (tenant due schedule: earliest-due) 50 rows in the section's canonical
 *     display order, and reports the full matching count through *Total;
 *   - every aggregate (invoiced/paid/remaining/overdue, settlement totals,
 *     portfolio counts) stays computed over the COMPLETE scoped row set —
 *     bounding a list must never falsify a displayed total;
 *   - the Owner Portal projection is self-contained: the superseded
 *     app_private legacy seam is gone and its removal does not change the
 *     public contract (token validation, invalid statuses, link telemetry);
 *   - invalid/expired/revoked tokens still short-circuit with status
 *     'invalid' and leak nothing;
 *   - the public ACL boundary for both snapshot RPCs is unchanged (anon +
 *     authenticated execute only, security definer, pinned search_path).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../p1/replay-bootstrap';

const COMPANY = 'b7000000-0000-4000-8000-000000000001';
const ISSUER = 'b7000000-0000-4000-8000-000000000011';
const OWNER = 'b7000000-0000-4000-8000-000000000021';
const PROPERTY = 'b7000000-0000-4000-8000-000000000031';
const UNIT = 'b7000000-0000-4000-8000-000000000041';
const TENANT = 'b7000000-0000-4000-8000-000000000051';
const CONTRACT = 'b7000000-0000-4000-8000-000000000061';
const AGREEMENT = 'b7000000-0000-4000-8000-000000000069';
const AGREEMENT_VERSION = 'b7000000-0000-4000-8000-000000000070';
const TENANT_TOKEN = 'b7000000-0000-4000-8000-000000000071';
const OWNER_TOKEN = 'b7000000-0000-4000-8000-000000000081';

const CAP = 50;
const OVER_CAP = CAP + 5; // 55 rows per section: 5 rows must fall outside the window

let db: PGlite;

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params as never[])).rows;
}

async function loadSnapshot(fn: string, token: string): Promise<Record<string, unknown>> {
  const rows = await query<{ snap: string | null }>(
    `select public.${fn}($1::uuid)::text as snap`,
    [token],
  );
  if (!rows[0]?.snap) throw new Error(`${fn}: empty snapshot result`);
  return JSON.parse(rows[0].snap) as Record<string, unknown>;
}

async function snapshotArray(snapshot: Record<string, unknown>, key: string): Promise<unknown[]> {
  const snap = snapshot.snapshot as Record<string, unknown>;
  const value = snap[key];
  expect(Array.isArray(value), `${key} must remain an array`).toBe(true);
  return value as unknown[];
}

function snapshotField<T = unknown>(snapshot: Record<string, unknown>, key: string): T {
  return (snapshot.snapshot as Record<string, unknown>)[key] as T;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY}', 'شركة حدود البوابة', 'portal-bounds', true);

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ISSUER}', 'issuer@portalbounds.test', '{"company_id":"${COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ISSUER}', 'issuer@portalbounds.test', 'مصدِر الروابط', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY}', '${ISSUER}', 'ADMIN', true);

    insert into public.owners (id, name, display_name, full_name, company_id, is_active) values
      ('${OWNER}', 'مالك الحدود', 'مالك الحدود', 'مالك الحدود الكامل', '${COMPANY}', true);

    insert into public.properties (id, title, type, address, company_id) values
      ('${PROPERTY}', 'عمارة الحدود', 'residential', 'مسقط', '${COMPANY}');

    insert into public.property_owners (company_id, property_id, owner_id, ownership_percentage, is_primary, starts_on) values
      ('${COMPANY}', '${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01');

    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}');

    insert into public.owner_agreement_versions (id, owner_agreement_id, company_id, version_no, operating_model, collection_role, commission_type, commission_value, commission_recognition_basis, offset_allowed, reserve_amount, effective_from, created_by)
    values ('${AGREEMENT_VERSION}', '${AGREEMENT}', '${COMPANY}', 1, 'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0, date '2020-01-01', '${ISSUER}');

    update public.owner_agreements set current_version_id = '${AGREEMENT_VERSION}'::uuid where id = '${AGREEMENT}'::uuid;

    insert into public.people (id, full_name, type, company_id) values
      ('${TENANT}', 'مستأجر الحدود', 'tenant', '${COMPANY}');

    insert into public.units (id, property_id, unit_number, company_id, status, rent_amount) values
      ('${UNIT}', '${PROPERTY}', 'B-101', '${COMPANY}', 'occupied', 320);

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values
      ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
       date '2020-01-01', date '2030-12-31', 320, 'active', '${COMPANY}');

    -- 55 RENT invoices across 55 distinct monthly billing periods (the
    -- canonical one-RENT-per-contract-per-period invariant forces distinct
    -- periods). Due date = period start + 25 days, strictly increasing by i.
    insert into public.invoices
      (company_id, contract_id, issue_date, due_date, amount, status, document_status,
       charge_type, billing_period_start, billing_period_end)
    select '${COMPANY}', '${CONTRACT}',
           (date '2020-01-01' + ((i - 1) * interval '1 month'))::date,
           (date '2020-01-01' + ((i - 1) * interval '1 month') + interval '25 days')::date,
           100 + i, 'UNPAID', 'DRAFT', 'RENT',
           (date '2020-01-01' + ((i - 1) * interval '1 month'))::date,
           (date '2020-01-01' + (i * interval '1 month') - interval '1 day')::date
    from generate_series(1, ${OVER_CAP}) as i;

    -- 55 utility bills linked to the same contract (due dates spread over time).
    insert into public.utility_bills
      (company_id, property_id, contract_id, type, amount, paid_amount, due_date,
       billing_period_start, billing_period_end)
    select '${COMPANY}', '${PROPERTY}', '${CONTRACT}', 'ELECTRIC', 20 + i, 0,
           current_date - i, date '2026-08-01', date '2026-08-31'
    from generate_series(1, ${OVER_CAP}) as i;

    -- 55 receipts linked to tenant + contract; i=1 is the newest.
    insert into public.receipts
      (company_id, tenant_id, contract_id, amount, date_time, status)
    select '${COMPANY}', '${TENANT}', '${CONTRACT}', 10 + i,
           timestamp with time zone '2026-09-01 12:00:00+00' - (i || ' days')::interval,
           'POSTED'
    from generate_series(1, ${OVER_CAP}) as i;

    -- 110 vault documents: 55 contract-linked (tenant portal), 55 property-linked (owner portal).
    insert into public.vault_documents
      (company_id, title, category, related_entity_type, related_entity_id,
       file_name, file_url, storage_path)
    select '${COMPANY}', 'مستند عقد ' || i, 'contracts', 'contract', '${CONTRACT}',
           'contract-' || i || '.pdf', 'https://example.invalid/f.pdf', 'vault/f.pdf'
    from generate_series(1, ${OVER_CAP}) as i;

    insert into public.vault_documents
      (company_id, title, category, related_entity_type, related_entity_id,
       file_name, file_url, storage_path)
    select '${COMPANY}', 'مستند عقار ' || i, 'contracts', 'property', '${PROPERTY}',
           'property-' || i || '.pdf', 'https://example.invalid/f.pdf', 'vault/f.pdf'
    from generate_series(1, ${OVER_CAP}) as i;

    -- 55 tenant-charged maintenance records inside the contract window on this unit.
    insert into public.maintenance_records
      (company_id, property_id, unit_id, title, status, charged_to, request_date, created_at)
    select '${COMPANY}', '${PROPERTY}', '${UNIT}', 'طلب صيانة ' || i, 'open', 'TENANT',
           current_date - i, timestamp with time zone '2026-09-01 08:00:00+00' - (i || ' days')::interval
    from generate_series(1, ${OVER_CAP}) as i;

    -- 30 approved + 25 draft settlements for the owner (id is TEXT, unique).
    insert into public.owner_settlements
      (id, company_id, owner_id, date, status, gross_collected, office_fee,
       owner_expenses, tax_amount, net_payable, period_start, period_end,
       approved_at, approved_by)
    select 'os-bounds-' || lpad(i::text, 3, '0'),
           '${COMPANY}', '${OWNER}', (date '2026-01-01' + (i || ' days')::interval)::text,
           case when i <= 30 then 'APPROVED' else 'DRAFT' end,
           200 + i, 0, 0, 0, 200 + i,
           date '2026-01-01' + (i * 30),
           date '2026-01-01' + (i * 30) + 29,
           case when i <= 30 then timestamptz '2026-02-01T00:00:00Z' end,
           case when i <= 30 then '${ISSUER}'::uuid end
    from generate_series(1, ${OVER_CAP}) as i;

    insert into public.tenant_portal_links (company_id, tenant_id, token, issued_by, expires_at)
    values ('${COMPANY}', '${TENANT}', '${TENANT_TOKEN}', '${ISSUER}', now() + interval '30 days');

    insert into public.owner_portal_links (company_id, owner_id, token, issued_by, expires_at)
    values ('${COMPANY}', '${OWNER}', '${OWNER_TOKEN}', '${ISSUER}', now() + interval '30 days');
  `);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('tenant portal snapshot — bounded anon projection', () => {
  it('caps every list at 50 rows and discloses the full count via *Total', async () => {
    const snapshot = await loadSnapshot('get_tenant_portal_snapshot', TENANT_TOKEN);
    expect(snapshot.status).toBe('ready');

    const dueSchedule = await snapshotArray(snapshot, 'dueSchedule');
    expect(dueSchedule).toHaveLength(CAP);
    expect(snapshotField<number>(snapshot, 'dueScheduleTotal')).toBe(OVER_CAP);

    for (const key of ['services', 'receipts', 'documents', 'maintenance'] as const) {
      const list = await snapshotArray(snapshot, key);
      expect(list, `${key} window`).toHaveLength(CAP);
      expect(snapshotField<number>(snapshot, `${key}Total`)).toBe(OVER_CAP);
    }
  });

  it('keeps the window deterministic: earliest-due rows stay, the five newest fall out', async () => {
    const snapshot = await loadSnapshot('get_tenant_portal_snapshot', TENANT_TOKEN);
    const dueSchedule = await snapshotArray<{ dueDate: string; amount: number }>(snapshot, 'dueSchedule');
    // Order is (due_date, id) asc with the cap keeping the first 50: i=1..50
    // stay, i=51..55 fall outside the exposure window.
    const { rows } = await db.query<{ n: string; d: string }>(`
      select i::text as n,
             (date '2020-01-01' + ((i - 1) * interval '1 month') + interval '25 days')::date::text as d
      from generate_series(1, ${CAP}) as i
    `);
    expect(dueSchedule[0]?.dueDate).toBe(rows[0]?.d);
    expect(dueSchedule[CAP - 1]?.dueDate).toBe(rows[CAP - 1]?.d);
    // amount = 100 + i (i = invoice index at seed time).
    expect(dueSchedule[0]?.amount).toBeCloseTo(101);
  });

  it('computes paidPosition totals over the COMPLETE invoice set, not the window', async () => {
    const snapshot = await loadSnapshot('get_tenant_portal_snapshot', TENANT_TOKEN);
    const expected = await query<{ total: string }>(
      `select coalesce(sum(amount), 0)::text as total from public.invoices where contract_id = $1::uuid and deleted_at is null`,
      [CONTRACT],
    );
    const position = snapshotField<{ invoiced: number; paid: number; remaining: number; overdue: number }>(snapshot, 'paidPosition');
    expect(position.invoiced).toBeCloseTo(Number(expected[0]?.total));
    expect(position.remaining).toBeCloseTo(Number(expected[0]?.total));
    expect(position.paid).toBeCloseTo(0);
    // All seeded periods are in the past → the whole balance is overdue;
    // still computed across ALL 55 rows, not the 50-row window.
    expect(position.overdue).toBeCloseTo(Number(expected[0]?.total));
  });

  it('still short-circuits invalid tokens without projecting any data', async () => {
    const invalid = await loadSnapshot('get_tenant_portal_snapshot', 'b7000000-0000-4000-8000-000000000099');
    expect(invalid.status).toBe('invalid');
    expect(invalid.snapshot).toBeUndefined();
  });

  it('keeps link telemetry and the metadata-only document rule intact', async () => {
    await loadSnapshot('get_tenant_portal_snapshot', TENANT_TOKEN);
    const links = await query<{ used: boolean }>(
      `select last_used_at is not null as used from public.tenant_portal_links where token = $1::uuid`,
      [TENANT_TOKEN],
    );
    expect(links[0]?.used).toBe(true);

    const snapshot = await loadSnapshot('get_tenant_portal_snapshot', TENANT_TOKEN);
    const documents = await snapshotArray<Record<string, unknown>>(snapshot, 'documents');
    for (const doc of documents) {
      expect(doc).not.toHaveProperty('file_url');
      expect(doc).not.toHaveProperty('storage_path');
    }
  });
});

describe('owner portal snapshot — bounded, self-contained anon projection', () => {
  it('caps settlements, maintenance and documents at 50 with honest totals', async () => {
    const snapshot = await loadSnapshot('get_owner_portal_snapshot', OWNER_TOKEN);
    expect(snapshot.status).toBe('ready');

    const settlements = await snapshotArray(snapshot, 'settlements');
    expect(settlements).toHaveLength(CAP);
    expect(snapshotField<number>(snapshot, 'settlementsTotal')).toBe(OVER_CAP);

    const maintenance = await snapshotArray(snapshot, 'maintenance');
    expect(maintenance).toHaveLength(CAP);
    expect(snapshotField<number>(snapshot, 'maintenanceTotal')).toBe(OVER_CAP);

    const documents = await snapshotArray(snapshot, 'documents');
    expect(documents).toHaveLength(CAP);
    expect(snapshotField<number>(snapshot, 'documentsTotal')).toBe(OVER_CAP);
  });

  it('keeps summary aggregates complete and preserves DRAFT+APPROVED payable semantics', async () => {
    const snapshot = await loadSnapshot('get_owner_portal_snapshot', OWNER_TOKEN);
    const expected = await query<{ gross: string; net: string }>(`
      select
        coalesce(sum(gross_collected) filter (where status in ('APPROVED','PAID')), 0)::text as gross,
        coalesce(sum(net_payable) filter (where status in ('DRAFT','APPROVED')), 0)::text as net
      from public.owner_settlements
      where company_id = $1::uuid and owner_id = $2::text
    `, [COMPANY, OWNER]);
    const summary = snapshotField<{ grossCollected: number; ownerExpenses: number; netPayable: number; properties: number; units: number }>(snapshot, 'summary');
    expect(summary.grossCollected).toBeCloseTo(Number(expected[0]?.gross));
    expect(summary.netPayable).toBeCloseTo(Number(expected[0]?.net));
    expect(summary.ownerExpenses).toBeCloseTo(0);
    expect(summary.properties).toBe(1);
    expect(summary.units).toBe(1);
  });

  it('does not let the settlement window falsify portfolio counts', async () => {
    const snapshot = await loadSnapshot('get_owner_portal_snapshot', OWNER_TOKEN);
    const properties = await snapshotArray<{ units: number; occupiedUnits: number }>(snapshot, 'properties');
    expect(properties).toHaveLength(1); // below the cap: complete and honest
    expect(snapshotField<number>(snapshot, 'propertiesTotal')).toBe(1);
    expect(properties[0]?.units).toBe(1);
  });

  it('is self-contained: the superseded app_private seam is gone but the contract stays', async () => {
    const gone = await query<{ reg: string | null }>(
      `select to_regprocedure('app_private.get_owner_portal_snapshot_legacy(uuid)')::text as reg`,
    );
    expect(gone[0]?.reg).toBeNull();

    // Same public entry points, still SECURITY DEFINER, anon + authenticated execute only.
    const acls = await query<{
      owner_anon: boolean; owner_auth: boolean; owner_public: boolean; owner_definer: boolean;
      tenant_anon: boolean; tenant_definer: boolean;
    }>(`
      select
        has_function_privilege('anon', 'public.get_owner_portal_snapshot(uuid)', 'EXECUTE') as owner_anon,
        has_function_privilege('authenticated', 'public.get_owner_portal_snapshot(uuid)', 'EXECUTE') as owner_auth,
        has_function_privilege('public', 'public.get_owner_portal_snapshot(uuid)', 'EXECUTE') as owner_public,
        (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'get_owner_portal_snapshot') as owner_definer,
        has_function_privilege('anon', 'public.get_tenant_portal_snapshot(uuid)', 'EXECUTE') as tenant_anon,
        (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'get_tenant_portal_snapshot') as tenant_definer
    `);
    expect(acls[0]).toMatchObject({
      owner_anon: true,
      owner_auth: true,
      // The PUBLIC pseudo-role must never gain execute; anon stays gated on
      // the token, and the audited anon-definer allowlist (2 functions) holds.
      owner_public: false,
      owner_definer: true,
      tenant_anon: true,
      tenant_definer: true,
    });
    const anonDefiners = await query<{ name: string }>(`
      select p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    `);
    expect(anonDefiners.map((r) => r.name).sort()).toEqual([
      'get_owner_portal_snapshot',
      'get_tenant_portal_snapshot',
    ]);
  });

  it('rejects a revoked owner link after the rewrite', async () => {
    await db.exec(`
      insert into public.owner_portal_links (company_id, owner_id, token, issued_by, expires_at, revoked_at)
      values ('${COMPANY}', '${OWNER}', 'b7000000-0000-4000-8000-000000000091', '${ISSUER}',
              now() + interval '30 days', now());
    `);
    const revoked = await loadSnapshot('get_owner_portal_snapshot', 'b7000000-0000-4000-8000-000000000091');
    expect(revoked.status).toBe('invalid');
  });
});
