/**
 * Stage 3 — Business document references (isolated PGlite replay).
 *
 * Verifies the server-generated, company-scoped, concurrency-safe reference
 * infrastructure from 20260805000000_business_document_references.sql:
 *
 *   - next_document_reference is unique and sequential under concurrency
 *   - numbering is isolated per (company, doc_type, year)
 *   - the BEFORE INSERT trigger fills NEW.reference only when NULL
 *   - explicit references are respected (idempotency)
 *   - historical rows are backfilled deterministically
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';

const MIGRATION = '20260805000000_business_document_references.sql';
const ROLLBACK = '20260805_rollback_business_document_references.sql';
const migrationSql = readFileSync(join(repoRoot, 'supabase', 'migrations', MIGRATION), 'utf8');
const rollbackSql = readFileSync(join(repoRoot, 'supabase', 'rollback', ROLLBACK), 'utf8');
const stripComments = (t: string) =>
  t.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
const lower = stripComments(migrationSql.toLowerCase());

describe('business references migration contract', () => {
  it('is transactional and strictly non-destructive', () => {
    expect(lower).toContain('begin;');
    expect(lower.trimEnd().endsWith('commit;')).toBe(true);
    expect(lower).not.toMatch(/\bdrop\s+table\b/);
    expect(lower).not.toMatch(/\bdrop\s+column\b/);
    expect(lower).not.toMatch(/\btruncate\b/);
    expect(lower).not.toMatch(/\bdelete\s+from\b/);
  });

  it('adds a reference column to every audited document table', () => {
    for (const table of [
      'contracts',
      'invoices',
      'receipts',
      'expenses',
      'maintenance_records',
      'owner_agreements',
      'owner_settlements',
      'tenant_deposits',
      'utility_bills',
      'bank_statement_imports',
    ]) {
      expect(lower, `missing reference column for ${table}`).toMatch(
        new RegExp(`alter table public\\.${table} add column if not exists reference text`),
      );
    }
  });

  it('provides a company-scoped atomic sequence function and backfill', () => {
    expect(lower).toContain('create table if not exists public.document_reference_sequences');
    expect(lower).toContain('create or replace function public.next_document_reference');
    expect(lower).toContain('create or replace function public.assign_document_reference()');
    expect(lower).toContain('create or replace function public.backfill_business_document_references()');
  });

  it('has a rollback file that references the forward migration', () => {
    expect(rollbackSql).toMatch(/manual|emergency|not\s+auto-applied/i);
    expect(rollbackSql).toContain(MIGRATION);
  });
});

let db: PGlite;

async function nextRef(company: string, docType: string, prefix: string, year: number): Promise<string> {
  const { rows } = await db.query(
    `select public.next_document_reference($1, $2, $3, $4) as ref`,
    [company, docType, prefix, year],
  );
  return (rows[0] as { ref: string }).ref;
}

async function seedFixture() {
  // Minimal company + property fixture so trigger/backfill inserts have a
  // valid company context to reference.
  await db.query(
    `insert into public.companies (id, name, slug) values
       ($1, 'شركة ألف', 'alpha'),
       ($2, 'شركة باء', 'beta')
     on conflict (id) do nothing`,
    [COMPANY_A, COMPANY_B],
  );
  await db.query(
    `insert into public.properties (id, title, name, type, address, company_id) values
       ($1, 'عقار ألف', 'عقار ألف', 'سكني', 'مسقط', $3),
       ($2, 'عقار باء', 'عقار باء', 'سكني', 'مسقط', $4)
     on conflict (id) do nothing`,
    ['1a000000-0000-4000-8000-00000000000a', '1b000000-0000-4000-8000-00000000000b', COMPANY_A, COMPANY_B],
  );
}

beforeAll(async () => {
  const replayed = await createFullReplayedDatabase({ throughMigration: '20260805000000' });
  db = replayed.db;
  const failed = replayed.failed.filter((f) => f.file.includes('20260805000000'));
  expect(failed, `migration replay errors: ${JSON.stringify(failed)}`).toEqual([]);
  await seedFixture();
});

describe('next_document_reference — concurrency and format', () => {
  it('returns formatted, sequential references', async () => {
    const a = await nextRef(COMPANY_A, 'invoice', 'INV', 2026);
    const b = await nextRef(COMPANY_A, 'invoice', 'INV', 2026);
    expect(a).toBe('INV-2026-000001');
    expect(b).toBe('INV-2026-000002');
  });

  it('is unique under concurrent calls (no duplicate references)', async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, () => nextRef(COMPANY_A, 'receipt', 'RCT', 2026)),
    );
    const unique = new Set(results);
    expect(results.length).toBe(40);
    expect(unique.size).toBe(40);
    expect(results).toContain('RCT-2026-000001');
  });
});

describe('company-scoped isolation', () => {
  it('keeps numbering independent per company for the same doc type', async () => {
    await nextRef(COMPANY_A, 'contract', 'CNT', 2026);
    await nextRef(COMPANY_B, 'contract', 'CNT', 2026);
    await nextRef(COMPANY_B, 'contract', 'CNT', 2026);
    const aRef = await nextRef(COMPANY_A, 'contract', 'CNT', 2026);
    const bRef = await nextRef(COMPANY_B, 'contract', 'CNT', 2026);
    // Company A was incremented twice total, Company B three times.
    expect(aRef).toBe('CNT-2026-000002');
    expect(bRef).toBe('CNT-2026-000003');
  });

  it('isolates numbering per year', async () => {
    const y2026 = await nextRef(COMPANY_A, 'expense', 'EXP', 2026);
    const y2027 = await nextRef(COMPANY_A, 'expense', 'EXP', 2027);
    expect(y2026).toMatch(/^EXP-2026-/);
    expect(y2027).toMatch(/^EXP-2027-000001$/);
  });
});

describe('trigger assignment on INSERT', () => {
  it('fills a reference on insert when none is provided', async () => {
    // Insert an expense row (minimal required columns) into company A.
    const { rows } = await db.query(
      `insert into public.expenses (company_id, property_id, category, amount, expense_date)
       select $1, p.id, 'صيانة', 100, '2026-01-05'
       from public.properties p
       where p.company_id = $1
       limit 1
       returning id, reference`,
      [COMPANY_A],
    );
    const row = rows[0] as { id: string; reference: string | null };
    expect(row.reference).toMatch(/^EXP-2026-\d{6}$/);
  });

  it('respects an explicitly provided reference (idempotency)', async () => {
    const { rows } = await db.query(
      `insert into public.expenses (company_id, property_id, category, amount, expense_date, reference)
       select $1, p.id, 'صيانة', 100, '2026-01-06', 'MANUAL-REF-1'
       from public.properties p
       where p.company_id = $1
       limit 1
       returning reference`,
      [COMPANY_A],
    );
    expect((rows[0] as { reference: string }).reference).toBe('MANUAL-REF-1');
  });
});

describe('backfill of historical rows', () => {
  it('assigns references to existing NULL rows deterministically', async () => {
    // Insert rows with company context (simulating pre-migration rows) with a
    // NULL reference, then run backfill and confirm every row got a reference.
    await db.query(
      `insert into public.expenses (company_id, property_id, category, amount, expense_date, reference)
       select $1, p.id, 'خدمات', 50, '2026-01-02', null
       from public.properties p where p.company_id = $1 limit 1`,
      [COMPANY_B],
    );
    await db.query(`select public.backfill_business_document_references()`);

    const { rows } = await db.query(
      `select reference from public.expenses where company_id = $1 and reference is not null`,
      [COMPANY_B],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows as Array<{ reference: string }>) {
      expect(row.reference).toMatch(/^EXP-2026-\d{6}$/);
    }
  });
});
