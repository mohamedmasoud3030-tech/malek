import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260716000003_restore_payment_void_report_parity.sql`,
  'utf8',
);

const adminId = '11111111-1111-4111-8111-111111111111';
const managerId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const paymentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receiptId = 'receipt-distinct-from-payment';
const invoiceId = 'invoice-1';

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    CREATE TABLE public.users (
      id uuid PRIMARY KEY,
      role text NOT NULL,
      status text NOT NULL
    );

    CREATE OR REPLACE FUNCTION public.is_app_user()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.status = 'ACTIVE'
      )
    $$;

    CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.status = 'ACTIVE'
          AND u.role IN ('ADMIN', 'MANAGER')
      )
    $$;

    CREATE OR REPLACE FUNCTION public._safe_date(value text)
    RETURNS date
    LANGUAGE sql
    IMMUTABLE
    AS $$ SELECT nullif(value, '')::date $$;

    CREATE OR REPLACE FUNCTION public._r3(value numeric)
    RETURNS numeric
    LANGUAGE sql
    IMMUTABLE
    AS $$ SELECT round(coalesce(value, 0), 3) $$;

    CREATE TABLE public.payments (
      id uuid PRIMARY KEY,
      amount numeric,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      contract_id text,
      payment_date date,
      payment_method text,
      reference_no text,
      date_time text,
      channel text,
      status text,
      notes text,
      invoice_id text,
      receipt_id text,
      created_by uuid,
      deleted_at timestamptz,
      reference_number text
    );

    CREATE TABLE public.receipts (
      id text PRIMARY KEY,
      contract_id text,
      date_time text,
      amount numeric,
      channel text,
      status text,
      notes text,
      voided_at bigint,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE public.invoices (
      id text PRIMARY KEY,
      amount numeric,
      tax_amount numeric,
      paid_amount numeric,
      status text,
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.receipt_allocations (
      id text PRIMARY KEY,
      receipt_id text NOT NULL REFERENCES public.receipts(id),
      invoice_id text NOT NULL REFERENCES public.invoices(id),
      amount numeric NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.journal_entries (
      id text PRIMARY KEY,
      no text,
      date text,
      account_id text,
      amount numeric,
      type text,
      source_id text,
      entity_type text,
      entity_id text,
      created_at timestamptz DEFAULT now(),
      request_id text,
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz,
      status text NOT NULL DEFAULT 'posted',
      batch_id uuid
    );

    CREATE TABLE public.financial_operation_idempotency (
      operation_name text NOT NULL,
      request_id text NOT NULL,
      response_payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (operation_name, request_id)
    );

    CREATE TABLE public.audit_log (
      id text PRIMARY KEY,
      ts bigint,
      user_id text,
      action text,
      entity text,
      entity_id text,
      note text,
      "table" text,
      details text,
      old_value jsonb,
      new_value jsonb,
      action_timestamp timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION public.close_journal_batch(p_batch_id uuid)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_debits numeric;
      v_credits numeric;
      v_count integer;
    BEGIN
      SELECT
        coalesce(sum(amount) FILTER (WHERE upper(type) = 'DEBIT'), 0),
        coalesce(sum(amount) FILTER (WHERE upper(type) = 'CREDIT'), 0),
        count(*)::integer
      INTO v_debits, v_credits, v_count
      FROM public.journal_entries
      WHERE batch_id = p_batch_id;

      IF v_count = 0 OR abs(v_debits - v_credits) > 0.001 THEN
        RAISE EXCEPTION 'journal batch is not balanced';
      END IF;

      RETURN jsonb_build_object(
        'balanced', true,
        'debit_total', v_debits,
        'credit_total', v_credits,
        'entry_count', v_count
      );
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.rpt_daily_collection(p_from date, p_to date)
    RETURNS TABLE(collection_date date, total_amount numeric)
    LANGUAGE sql
    AS $$ SELECT p_from, 0::numeric $$;

    CREATE OR REPLACE FUNCTION public.void_receipt_atomic(
      p_receipt_id text,
      p_voided_at bigint,
      p_invoice_updates jsonb DEFAULT '[]'::jsonb,
      p_reverse_entries jsonb DEFAULT '[]'::jsonb
    )
    RETURNS jsonb
    LANGUAGE sql
    SECURITY DEFINER
    AS $$ SELECT jsonb_build_object('legacy', true) $$;

    INSERT INTO public.users (id, role, status) VALUES
      ('${adminId}', 'ADMIN', 'ACTIVE'),
      ('${managerId}', 'MANAGER', 'ACTIVE'),
      ('${userId}', 'USER', 'ACTIVE');
  `);
  await db.exec(migration);
  return db;
}

async function setActor(db: PGlite, actorId: string, role = 'authenticated') {
  await db.exec(`
    RESET ROLE;
    SET ROLE ${role};
    SELECT set_config('request.jwt.claim.sub', '${actorId}', false);
  `);
}

async function resetActor(db: PGlite) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
}

async function seedPostedPayment(db: PGlite, options: { balanced?: boolean } = {}) {
  const balanced = options.balanced ?? true;
  await resetActor(db);
  await db.exec(`
    INSERT INTO public.invoices (id, amount, tax_amount, paid_amount, status)
    VALUES ('${invoiceId}', 100, 0, 100, 'PAID');

    INSERT INTO public.receipts (id, contract_id, date_time, amount, channel, status)
    VALUES ('${receiptId}', 'contract-1', '2026-07-14', 100, 'CASH', 'POSTED');

    INSERT INTO public.payments (
      id, amount, contract_id, payment_date, payment_method, date_time,
      channel, status, invoice_id, receipt_id, created_by
    ) VALUES (
      '${paymentId}', 100, 'contract-1', '2026-07-14', 'cash', '2026-07-14',
      'CASH', 'POSTED', '${invoiceId}', '${receiptId}', '${managerId}'
    );

    INSERT INTO public.receipt_allocations (id, receipt_id, invoice_id, amount)
    VALUES ('allocation-1', '${receiptId}', '${invoiceId}', 100);

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, status
    ) VALUES
      ('journal-debit', 'PAY-D', '2026-07-14', 'cash', 100, 'DEBIT', '${receiptId}', 'contract', 'contract-1', 'posted'),
      ('journal-credit', 'PAY-C', '2026-07-14', 'receivable', ${balanced ? 100 : 90}, 'CREDIT', '${receiptId}', 'contract', 'contract-1', 'posted');
  `);
}

async function callVoid(db: PGlite, requestId: string, reason = 'duplicate payment') {
  const result = await db.query<{ payload: string }>(`
    SELECT public.void_receipt_atomic(
      jsonb_build_object(
        'receipt_id', '${paymentId}',
        'reason', '${reason}',
        'request_id', '${requestId}'
      )
    )::text AS payload
  `);
  return JSON.parse(result.rows[0]?.payload ?? '{}') as Record<string, unknown>;
}

describe('payment/receipt void and report parity migration execution', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  it('reports only non-deleted, non-void payments and preserves the JSONB API', async () => {
    await resetActor(db);
    await db.exec(`
      INSERT INTO public.payments (id, amount, payment_date, payment_method, status, deleted_at) VALUES
        ('00000000-0000-4000-8000-000000000001', 100, '2026-07-01', 'cash', 'POSTED', NULL),
        ('00000000-0000-4000-8000-000000000002', 50, '2026-07-01', 'bank_transfer', 'posted', NULL),
        ('00000000-0000-4000-8000-000000000003', 999, '2026-07-01', 'cash', 'VOID', NULL),
        ('00000000-0000-4000-8000-000000000004', 888, '2026-07-01', 'card', 'POSTED', now()),
        ('00000000-0000-4000-8000-000000000005', 25, '2026-07-02', 'card', NULL, NULL);
    `);

    await setActor(db, userId);
    const result = await db.query<{ payload: string }>(`
      SELECT public.rpt_daily_collection('2026-07-01', '2026-07-31')::text AS payload
    `);
    const payload = JSON.parse(result.rows[0]?.payload ?? '{}') as {
      source: string;
      total: number;
      rows: Array<Record<string, number | string>>;
    };

    expect(payload.source).toBe('payments');
    expect(Number(payload.total)).toBe(175);
    expect(payload.rows).toEqual([
      expect.objectContaining({ date: '2026-07-01', total: 150, cash: 100, bank: 50, pos: 0, count: 2 }),
      expect.objectContaining({ date: '2026-07-02', total: 25, cash: 0, bank: 0, pos: 25, count: 1 }),
    ]);
  });

  it('enforces runtime execute grants and the operation-level role matrix', async () => {
    await resetActor(db);
    const privileges = await db.query<{
      anon_report: boolean;
      anon_void: boolean;
      authenticated_void: boolean;
      authenticated_legacy_void: boolean;
    }>(`
      SELECT
        has_function_privilege('anon', 'public.rpt_daily_collection(date,date)', 'EXECUTE') AS anon_report,
        has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'EXECUTE') AS anon_void,
        has_function_privilege('authenticated', 'public.void_receipt_atomic(jsonb)', 'EXECUTE') AS authenticated_void,
        has_function_privilege('authenticated', 'public.void_receipt_atomic(text,bigint,jsonb,jsonb)', 'EXECUTE') AS authenticated_legacy_void
    `);

    expect(privileges.rows[0]).toEqual({
      anon_report: false,
      anon_void: false,
      authenticated_void: true,
      authenticated_legacy_void: false,
    });

    await seedPostedPayment(db);
    await setActor(db, userId);
    await expect(callVoid(db, 'void-user-denied')).rejects.toThrow(/ADMIN or MANAGER role is required/);

    await resetActor(db);
    const state = await db.query<{ payment_status: string; receipt_status: string; paid_amount: string }>(`
      SELECT p.status AS payment_status, r.status AS receipt_status, i.paid_amount::text
      FROM public.payments p
      JOIN public.receipts r ON r.id = p.receipt_id
      JOIN public.invoices i ON i.id = p.invoice_id
      WHERE p.id = '${paymentId}'
    `);
    expect(state.rows[0]).toEqual({ payment_status: 'POSTED', receipt_status: 'POSTED', paid_amount: '100' });
  });

  it('voids through a payment id, preserves allocation history, and creates one balanced reversal', async () => {
    await seedPostedPayment(db);
    await setActor(db, managerId);

    const first = await callVoid(db, 'void-request-1', 'duplicate payment');
    const duplicate = await callVoid(db, 'void-request-1', 'duplicate payment');
    const secondRequest = await callVoid(db, 'void-request-2', 'already void');

    expect(first).toEqual(expect.objectContaining({
      success: true,
      idempotent: false,
      payment_id: paymentId,
      receipt_id: receiptId,
      status: 'VOID',
      journal_reversal_entries: 2,
    }));
    expect(duplicate).toEqual(expect.objectContaining({ success: true, idempotent: true }));
    expect(secondRequest).toEqual(expect.objectContaining({ success: true, idempotent: true, journal_reversal_entries: 0 }));

    await resetActor(db);
    const state = await db.query<{
      payment_status: string;
      receipt_status: string;
      paid_amount: string;
      invoice_status: string;
      allocations: string;
      reversal_entries: string;
      reversal_debits: string;
      reversal_credits: string;
      audit_events: string;
      idempotency_rows: string;
    }>(`
      SELECT
        (SELECT status FROM public.payments WHERE id = '${paymentId}') AS payment_status,
        (SELECT status FROM public.receipts WHERE id = '${receiptId}') AS receipt_status,
        (SELECT paid_amount::text FROM public.invoices WHERE id = '${invoiceId}') AS paid_amount,
        (SELECT status FROM public.invoices WHERE id = '${invoiceId}') AS invoice_status,
        (SELECT count(*)::text FROM public.receipt_allocations WHERE receipt_id = '${receiptId}') AS allocations,
        (SELECT count(*)::text FROM public.journal_entries WHERE request_id = 'void:${receiptId}') AS reversal_entries,
        (SELECT coalesce(sum(amount), 0)::text FROM public.journal_entries WHERE request_id = 'void:${receiptId}' AND type = 'DEBIT') AS reversal_debits,
        (SELECT coalesce(sum(amount), 0)::text FROM public.journal_entries WHERE request_id = 'void:${receiptId}' AND type = 'CREDIT') AS reversal_credits,
        (SELECT count(*)::text FROM public.audit_log WHERE action = 'VOID_RECEIPT_ATOMIC') AS audit_events,
        (SELECT count(*)::text FROM public.financial_operation_idempotency WHERE operation_name = 'void_receipt_atomic') AS idempotency_rows
    `);

    expect(state.rows[0]).toEqual({
      payment_status: 'VOID',
      receipt_status: 'VOID',
      paid_amount: '0',
      invoice_status: 'UNPAID',
      allocations: '1',
      reversal_entries: '2',
      reversal_debits: '100',
      reversal_credits: '100',
      audit_events: '1',
      idempotency_rows: '2',
    });

    await setActor(db, userId);
    const report = await db.query<{ payload: string }>(`
      SELECT public.rpt_daily_collection('2026-07-01', '2026-07-31')::text AS payload
    `);
    expect(JSON.parse(report.rows[0]?.payload ?? '{}')).toEqual(expect.objectContaining({ total: 0, rows: [] }));
  });

  it('requires reason and request id before any mutation', async () => {
    await seedPostedPayment(db);
    await setActor(db, managerId);

    await expect(db.query(`
      SELECT public.void_receipt_atomic(jsonb_build_object('receipt_id', '${paymentId}'))
    `)).rejects.toThrow(/receipt_id, reason, and request_id are required/);

    await resetActor(db);
    const counts = await db.query<{ void_payments: string; void_receipts: string; reversal_entries: string }>(`
      SELECT
        (SELECT count(*)::text FROM public.payments WHERE status = 'VOID') AS void_payments,
        (SELECT count(*)::text FROM public.receipts WHERE status = 'VOID') AS void_receipts,
        (SELECT count(*)::text FROM public.journal_entries WHERE entity_type = 'receipt_void') AS reversal_entries
    `);
    expect(counts.rows[0]).toEqual({ void_payments: '0', void_receipts: '0', reversal_entries: '0' });
  });

  it('rolls back the whole void when the original journal is unbalanced', async () => {
    await seedPostedPayment(db, { balanced: false });
    await setActor(db, adminId);

    await expect(callVoid(db, 'void-unbalanced')).rejects.toThrow(/Original receipt journal is unbalanced/);

    await resetActor(db);
    const state = await db.query<{
      payment_status: string;
      receipt_status: string;
      paid_amount: string;
      invoice_status: string;
      reversal_entries: string;
      audit_events: string;
      idempotency_rows: string;
    }>(`
      SELECT
        (SELECT status FROM public.payments WHERE id = '${paymentId}') AS payment_status,
        (SELECT status FROM public.receipts WHERE id = '${receiptId}') AS receipt_status,
        (SELECT paid_amount::text FROM public.invoices WHERE id = '${invoiceId}') AS paid_amount,
        (SELECT status FROM public.invoices WHERE id = '${invoiceId}') AS invoice_status,
        (SELECT count(*)::text FROM public.journal_entries WHERE entity_type = 'receipt_void') AS reversal_entries,
        (SELECT count(*)::text FROM public.audit_log WHERE action = 'VOID_RECEIPT_ATOMIC') AS audit_events,
        (SELECT count(*)::text FROM public.financial_operation_idempotency WHERE operation_name = 'void_receipt_atomic') AS idempotency_rows
    `);

    expect(state.rows[0]).toEqual({
      payment_status: 'POSTED',
      receipt_status: 'POSTED',
      paid_amount: '100',
      invoice_status: 'PAID',
      reversal_entries: '0',
      audit_events: '0',
      idempotency_rows: '0',
    });
  });
});
