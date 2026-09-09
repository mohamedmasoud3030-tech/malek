-- FIN-008/013/016/018/019; SEC-001/002/003.
--
-- The owner statement is a legal account rendered to the owner. Four defects
-- were proven against real SQL before this repair (see
-- rentrix-app/src/features/financials/reports/owner-statement-settlement-authority.test.ts
-- and owner-statement-company-isolation.test.ts):
--
--   1. ISOLATION. `public._owner_statement_expenses` carried NO company
--      predicate while every other CTE in `rpt_owner_statement` filtered on
--      `v_company_id`. Because the caller is SECURITY DEFINER, the invoker's
--      RLS on `public.expenses` never applied, so an expense belonging to a
--      DIFFERENT company — on a property the same owner id holds there — was
--      rendered inside this company's statement. Reproduced: a foreign 777
--      expense appeared as a real deduction.
--
--   2. MONETARY. Settlement movements used the legacy `s.amount`, frozen at
--      DRAFT creation as the derived net. When a lawful offset later reduced
--      the actual disbursement, the statement still showed the entitlement
--      (1000) instead of the cash that truly left the bank (975).
--
--   3. TEMPORAL. Settlement movements used the legacy `s.date`, written once
--      as `period_end`. A statement window containing the true payment date
--      returned no settlement at all, and a window that had merely closed
--      showed an outflow that had not yet happened.
--
--   4. LIFECYCLE. `settlement_rows` filtered on no status, so a CANCELLED
--      settlement — money that was never disbursed — was still presented to
--      the owner as a deduction.
--
-- The repair keeps the legacy columns untouched: this is posted history and is
-- not rewritten or backfilled. Authority is moved to the columns the lifecycle
-- actually maintains (`status`, `paid_at`, `net_payable`) and to the SAME
-- original-cash proof used by the bank reconciliation and the owner position,
-- `app_private.owner_settlement_paid_cash`. Cash is never inferred from
-- `net_payable - offset_applied`: the offset header is mutable and a reversal
-- can leave it at zero long after the original payment.
--
-- Unproven history stays unproven. When a PAID settlement has no readable
-- original cash evidence the movement is NOT dropped and NOT silently shown as
-- zero — it is rendered at its entitlement and tagged
-- `evidence = 'MISSING_CASH_EVIDENCE'` so the reader can see that the figure is
-- unconfirmed. Only DRAFT/APPROVED settlements are excluded, because no money
-- has moved for them; they remain visible in the owner position as
-- `remaining_payable`.
begin;

-- 1. Company isolation for the statement expense source. The signature gains
-- an explicit company argument rather than relying on the invoker's RLS, which
-- a SECURITY DEFINER caller suppresses. Callers must pass the company they
-- already resolved via `public.require_company_id()`.
--
-- The body is derived from the live definition with `pg_get_functiondef` so the
-- governed owner-allocation source filter installed by
-- 20260909000012_owner_expense_allocation_source.sql is preserved exactly as
-- deployed, instead of being re-typed here and silently reverted.
do $expenses$
declare d text; needle text; replacement text;
begin
  d := pg_get_functiondef('public._owner_statement_expenses(uuid,date,date)'::regprocedure);

  -- Guard the two anchors this rewrite depends on. If either has drifted the
  -- migration fails closed rather than producing a half-filtered statement.
  if position('(select * from public.expenses where owner_allocation_version is null) e' in d) = 0 then
    raise exception 'OWNER_STATEMENT_EXPENSE_SOURCE_PRECONDITION: governed allocation source filter not found';
  end if;
  if position('$owner_expenses$ USING p_owner_id, p_from, p_to;' in d) = 0 then
    raise exception 'OWNER_STATEMENT_EXPENSE_USING_PRECONDITION';
  end if;

  d := replace(d,
    'public._owner_statement_expenses(p_owner_id uuid, p_from date, p_to date)',
    'public._owner_statement_expenses(p_owner_id uuid, p_from date, p_to date, p_company_id uuid)');

  -- Company scoping on BOTH the expense and its ownership link: an ownership
  -- row from another company must not qualify an expense either.
  needle := '      WHERE e.deleted_at IS NULL';
  replacement := '      WHERE e.deleted_at IS NULL'
    || E'\n        AND e.company_id = $4';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_STATEMENT_EXPENSE_WHERE_PRECONDITION';
  end if;
  d := replace(d, needle, replacement);

  needle := '          WHERE po.property_id = e.property_id AND po.owner_id = $1';
  replacement := '          WHERE po.property_id = e.property_id AND po.owner_id = $1'
    || E'\n            AND po.company_id = $4';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_STATEMENT_EXPENSE_OWNERSHIP_PRECONDITION';
  end if;
  d := replace(d, needle, replacement);

  d := replace(d,
    '$owner_expenses$ USING p_owner_id, p_from, p_to;',
    '$owner_expenses$ USING p_owner_id, p_from, p_to, p_company_id;');

  execute d;
end; $expenses$;

revoke all on function public._owner_statement_expenses(uuid, date, date, uuid) from public, anon, authenticated;
grant all on function public._owner_statement_expenses(uuid, date, date, uuid) to service_role;

comment on function public._owner_statement_expenses(uuid, date, date, uuid) is
  'Owner-charged POSTED expenses for a statement period, scoped to an explicitly supplied company. The company argument is mandatory because the only caller is SECURITY DEFINER, which suppresses the invoker RLS on public.expenses. Sources adopted into the owner receivable subledger (owner_allocation_version not null) are excluded so an adopted expense is not also an automatic statement deduction.';

-- The three-argument form is unsafe by construction: it cannot scope to a
-- company. Remove it so no caller can reach the leaking version. Verified to
-- have exactly one caller in the repository (rpt_owner_statement, rewritten
-- below); dropping it makes the leak unreachable rather than merely unused.
drop function if exists public._owner_statement_expenses(uuid, date, date);

-- 2. Settlement movements: proven cash, actual payment date, real lifecycle.
do $statement$
declare d text; needle text; replacement text;
begin
  d := pg_get_functiondef('public.rpt_owner_statement(uuid,date,date)'::regprocedure);

  needle := '    SELECT * FROM public._owner_statement_expenses(p_owner_id, p_from, p_to)';
  replacement := '    SELECT * FROM public._owner_statement_expenses(p_owner_id, p_from, p_to, v_company_id)';
  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_STATEMENT_EXPENSE_CALL_PRECONDITION';
  end if;
  d := replace(d, needle, replacement);

  needle := '  ), settlement_rows AS (
    SELECT s.date tx_date, ''تسوية مالية رقم '' || s.no details,
      ''settlement'' tx_type, '''' property_name, -s.amount gross,
      0::numeric deduction, COALESCE(s.no, s.id) sort_no
    FROM public.owner_settlements s
    WHERE s.owner_id::text = p_owner_id::text AND s.company_id = v_company_id AND public._safe_date(s.date) BETWEEN p_from AND p_to';

  -- Legacy s.date/s.amount are frozen at DRAFT creation and are never revised
  -- by the APPROVED/PAID/CANCELLED/offset paths. They stay in the table as
  -- history; the statement stops treating them as the truth.
  replacement := '  ), settlement_rows AS (
    SELECT s.paid_at::date::text tx_date,
      ''تسوية مالية رقم '' || COALESCE(s.no, s.id) ||
        CASE WHEN app_private.owner_settlement_paid_cash(v_company_id, s.id) IS NULL
          THEN '' — صرف غير مثبت بالمستندات''
          WHEN app_private.owner_settlement_paid_cash(v_company_id, s.id)
               < public._r3(s.net_payable)
          THEN '' — بعد مقاصة مستحقات على المالك''
          ELSE '''' END details,
      ''settlement'' tx_type, '''' property_name,
      -COALESCE(app_private.owner_settlement_paid_cash(v_company_id, s.id), public._r3(s.net_payable)) gross,
      0::numeric deduction, COALESCE(s.no, s.id) sort_no
    FROM public.owner_settlements s
    WHERE s.owner_id::text = p_owner_id::text AND s.company_id = v_company_id
      AND s.status = ''PAID'' AND s.paid_at IS NOT NULL
      AND s.paid_at::date BETWEEN p_from AND p_to';

  if (length(d) - length(replace(d, needle, ''))) / length(needle) <> 1 then
    raise exception 'OWNER_STATEMENT_SETTLEMENT_PRECONDITION';
  end if;
  d := replace(d, needle, replacement);

  execute d;
end; $statement$;

comment on function public.rpt_owner_statement(uuid, date, date) is
  'Owner account statement. Settlement movements present the ORIGINAL proven cash from app_private.owner_settlement_paid_cash on the date the payment actually occurred (paid_at), restricted to PAID settlements. The legacy owner_settlements.date/amount pair is frozen at draft creation and is never revised by the approval, payment, cancellation or offset paths, so it is retained as history but is no longer the statement authority. Cash is never derived from net_payable minus the mutable offset_applied header. A PAID settlement whose original cash cannot be proven is shown at its entitlement and labelled as unconfirmed rather than dropped or zeroed.';

notify pgrst, 'reload schema';
commit;
