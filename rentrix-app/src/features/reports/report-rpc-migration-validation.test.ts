import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = resolve(__dirname, '../../../../supabase/migrations/20260706101000_align_payment_receipt_reporting_source.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

async function createDisposableReportDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    CREATE OR REPLACE FUNCTION public.is_app_user()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT auth.uid() IS NOT NULL
    $$;

    CREATE TABLE public.payments (
      id uuid PRIMARY KEY,
      amount numeric NOT NULL,
      payment_method text,
      payment_date date NOT NULL,
      status text,
      deleted_at timestamptz
    );

    CREATE OR REPLACE FUNCTION public.rpt_daily_collection(p_from date, p_to date)
    RETURNS TABLE(
      collection_date date,
      payment_method text,
      total_amount numeric,
      payments_count bigint
    )
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT p.payment_date::date, COALESCE(NULLIF(p.payment_method, ''), 'other')::text, COALESCE(SUM(p.amount), 0)::numeric, COUNT(*)::bigint
      FROM public.payments p
      WHERE p.deleted_at IS NULL
        AND p.payment_date::date BETWEEN p_from AND p_to
      GROUP BY p.payment_date::date, COALESCE(NULLIF(p.payment_method, ''), 'other')
      ORDER BY 1, 2
    $$;
  `);
  return db;
}

describe('rpt_daily_collection migration validation', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createDisposableReportDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it('applies over the existing compatible signature and enforces payment inclusion/exclusion rules', async () => {
    await db.exec(migrationSql);

    const signature = await db.query<{ routine_name: string; data_type: string }>(`
      SELECT routine_name, data_type
      FROM information_schema.routines
      WHERE specific_schema = 'public'
        AND routine_name = 'rpt_daily_collection'
    `);
    expect(signature.rows).toEqual([{ routine_name: 'rpt_daily_collection', data_type: 'record' }]);

    await db.exec(`
      INSERT INTO public.payments (id, amount, payment_method, payment_date, status, deleted_at) VALUES
        ('00000000-0000-0000-0000-000000000001', 100, 'cash', '2026-05-01', 'POSTED', NULL),
        ('00000000-0000-0000-0000-000000000002', 50, 'cash', '2026-05-01', 'posted', NULL),
        ('00000000-0000-0000-0000-000000000003', 999, 'cash', '2026-05-01', 'VOID', NULL),
        ('00000000-0000-0000-0000-000000000004', 888, 'cash', '2026-05-01', 'POSTED', '2026-05-02T00:00:00Z'),
        ('00000000-0000-0000-0000-000000000005', 25, '', '2026-05-02', NULL, NULL);
    `);

    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);`);
    const result = await db.query<{ collection_date: string; payment_method: string; total_amount: string; payments_count: string }>(
      `SELECT collection_date::text, payment_method, total_amount::text, payments_count::text
       FROM public.rpt_daily_collection('2026-05-01', '2026-05-31')`,
    );

    expect(result.rows).toEqual([
      { collection_date: '2026-05-01', payment_method: 'cash', total_amount: '150', payments_count: '2' },
      { collection_date: '2026-05-02', payment_method: 'other', total_amount: '25', payments_count: '1' },
    ]);
  });

  it('rejects callers without an authenticated app user identity', async () => {
    await db.exec(migrationSql);
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '', false);`);

    await expect(db.query(`SELECT * FROM public.rpt_daily_collection('2026-05-01', '2026-05-31')`))
      .rejects.toThrow(/Authenticated app user is required/);
  });
});
