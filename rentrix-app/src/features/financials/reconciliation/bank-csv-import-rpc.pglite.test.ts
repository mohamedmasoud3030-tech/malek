import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../../supabase/migrations/20260805010001_bank_csv_import_integrity_followup.sql',
);

const COMPANY_A = '00000000-0000-4000-8000-000000000001';
const USER_A = '00000000-0000-4000-8000-000000000011';
const ACCOUNT_A = '00000000-0000-4000-8000-000000000101';
const ACCOUNT_B = '00000000-0000-4000-8000-000000000102';
const FILE_HASH = 'a'.repeat(64);

describe('import_bank_statement_batch_atomic runtime contract', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(bootstrapSql);
    await db.exec(await readFile(migrationPath, 'utf8'));
    await db.exec(`
      select set_config(
        'request.jwt.claims',
        '${JSON.stringify({ sub: USER_A, app_metadata: { company_id: COMPANY_A } })}',
        false
      );
      insert into public.bank_accounts (
        id, company_id, account_name, currency, opening_balance, is_active
      ) values
        ('${ACCOUNT_A}', '${COMPANY_A}', 'Main', 'OMR', 0, true),
        ('${ACCOUNT_B}', '${COMPANY_A}', 'Second', 'OMR', 0, true);
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  it('persists OMR mills and reconciles batch counts to actual rows', async () => {
    const result = await callImport(db, {
      bank_account_id: ACCOUNT_A,
      file_name: 'valid.csv',
      file_fingerprint: FILE_HASH,
      file_size: 120,
      source_total_rows: 2,
      rejected_rows: 0,
      rows: [
        {
          transaction_date: '2026-08-01',
          amount: 1.234,
          balance: 5.678,
          description: '',
          currency: 'OMR',
        },
        {
          transaction_date: '2026-08-02',
          amount: -0.111,
          balance: 5.567,
          description: 'Fee',
          reference: 'R-2',
          currency: 'OMR',
        },
      ],
    });

    expect(result.total_rows).toBe(2);
    expect(result.accepted_rows).toBe(2);
    expect(result.rejected_rows).toBe(0);
    expect(result.duplicate_rows).toBe(0);

    const persisted = await db.query<{
      amount: string;
      balance: string;
      description: string;
    }>(`
      select amount::text as amount, balance::text as balance, description
        from public.bank_statement_lines
       order by transaction_date
    `);

    expect(persisted.rows).toEqual([
      { amount: '1.234', balance: '5.678', description: 'حركة مستوردة' },
      { amount: '-0.111', balance: '5.567', description: 'Fee' },
    ]);
  });

  it('rejects partial source counts before writing a batch', async () => {
    await expect(callImport(db, {
      bank_account_id: ACCOUNT_A,
      file_name: 'partial.csv',
      file_fingerprint: 'b'.repeat(64),
      file_size: 120,
      source_total_rows: 2,
      rejected_rows: 1,
      rows: [{ transaction_date: '2026-08-01', amount: 1, description: 'Only valid row' }],
    })).rejects.toThrow('BANK_IMPORT_PARTIAL_SOURCE_REJECTED');

    const counts = await db.query<{ imports: number; lines: number }>(`
      select
        (select count(*)::int from public.bank_statement_imports) as imports,
        (select count(*)::int from public.bank_statement_lines) as lines
    `);
    expect(counts.rows[0]).toEqual({ imports: 0, lines: 0 });
  });

  it('fails closed on an invalid currency and leaves no partial data', async () => {
    await expect(callImport(db, {
      bank_account_id: ACCOUNT_A,
      file_name: 'currency.csv',
      file_fingerprint: 'c'.repeat(64),
      file_size: 120,
      source_total_rows: 1,
      rejected_rows: 0,
      rows: [{ transaction_date: '2026-08-01', amount: 1, description: 'Bad', currency: 'R.O.' }],
    })).rejects.toThrow('Invalid currency');

    const imports = await db.query<{ count: number }>('select count(*)::int as count from public.bank_statement_imports');
    expect(imports.rows[0].count).toBe(0);
  });

  it('returns the same batch on a safe retry but rejects another bank account', async () => {
    const payload = {
      bank_account_id: ACCOUNT_A,
      file_name: 'retry.csv',
      file_fingerprint: 'd'.repeat(64),
      file_size: 120,
      source_total_rows: 1,
      rejected_rows: 0,
      rows: [{ transaction_date: '2026-08-01', amount: 1, description: 'Retry' }],
    };

    const first = await callImport(db, payload);
    const retry = await callImport(db, payload);
    expect(retry.id).toBe(first.id);
    expect(retry.is_duplicate_file).toBe(true);

    await expect(callImport(db, { ...payload, bank_account_id: ACCOUNT_B }))
      .rejects.toThrow('FILE_ALREADY_IMPORTED_TO_DIFFERENT_BANK_ACCOUNT');
  });
});

async function callImport(db: PGlite, payload: Record<string, unknown>) {
  const result = await db.query<{ value: Record<string, unknown> }>(
    'select public.import_bank_statement_batch_atomic($1::jsonb) as value',
    [JSON.stringify(payload)],
  );
  return result.rows[0].value as {
    id: string;
    total_rows: number;
    accepted_rows: number;
    rejected_rows: number;
    duplicate_rows: number;
    is_duplicate_file: boolean;
  };
}

const bootstrapSql = `
  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
  create schema if not exists auth;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role; exception when duplicate_object then null; end $$;

  create or replace function auth.uid()
  returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub'
  $$;

  create or replace function public.current_company_id()
  returns uuid language sql stable as $$
    select (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'company_id'
    )::uuid
  $$;

  create or replace function public.is_app_user()
  returns boolean language sql stable as $$ select auth.uid() is not null $$;

  create or replace function public.is_admin_or_manager()
  returns boolean language sql stable as $$ select auth.uid() is not null $$;

  create table public.bank_accounts (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null,
    account_name text not null,
    account_code text,
    currency text not null default 'OMR',
    opening_balance numeric(14,2) not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  );

  create table public.bank_statement_imports (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null,
    bank_account_id uuid not null references public.bank_accounts(id),
    reference text,
    statement_name text not null,
    statement_from date,
    statement_to date,
    imported_at timestamptz not null default now(),
    created_by uuid,
    deleted_at timestamptz,
    file_name text,
    file_fingerprint text,
    file_size integer,
    total_rows integer not null default 0,
    accepted_rows integer not null default 0,
    rejected_rows integer not null default 0,
    duplicate_rows integer not null default 0,
    possible_duplicate_rows integer not null default 0,
    status text not null default 'completed',
    error_summary jsonb not null default '{}'::jsonb,
    processed_at timestamptz
  );

  create unique index ux_bank_imports_company_fingerprint
    on public.bank_statement_imports(company_id, file_fingerprint)
    where file_fingerprint is not null and deleted_at is null;

  create table public.bank_statement_lines (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null,
    import_id uuid references public.bank_statement_imports(id) on delete cascade,
    bank_account_id uuid not null references public.bank_accounts(id),
    transaction_date date not null,
    description text not null default '',
    reference text,
    amount numeric(14,2) not null,
    balance numeric(14,2),
    currency text not null default 'OMR',
    external_reference text,
    fingerprint text,
    status text not null default 'unmatched',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  );

  create unique index ux_bank_lines_company_fingerprint
    on public.bank_statement_lines(company_id, fingerprint)
    where fingerprint is not null and deleted_at is null;

  create table public.bank_reconciliation_matches (
    id uuid primary key default gen_random_uuid(),
    statement_line_id uuid not null unique references public.bank_statement_lines(id) on delete cascade,
    matched_entity_type text not null,
    matched_entity_id text not null,
    matched_amount numeric(14,2) not null,
    notes text,
    matched_at timestamptz not null default now(),
    matched_by uuid
  );
`;
