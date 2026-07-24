-- ============================================================================
-- P1 — Owner settlement amount integrity (server-side derivation)
-- ============================================================================
-- Evidence: docs/audits/P1_OWNER_SETTLEMENT_INTEGRITY_20260723.md
-- Regression suite: rentrix-app/src/p1/p1-owner-settlement-integrity.test.ts
--
-- Vulnerability closed (proven on main@8cd87a1):
--   create_owner_settlement_draft_atomic trusted client-sent gross_collected /
--   office_fee / owner_expenses / tax_amount; net_payable — later paid out by
--   pay_owner_settlement_atomic with a balanced journal batch — was forgeable
--   (a 999999/1/1/1 payload persisted net 999996 pre-fix; now it persists the
--   derived tuple 1500/150/120/0/1230 on the same fixture).
--
-- Derivation policy (each rule anchored to an authoritative source):
--   gross       Non-VOID, non-deleted payments of the owner's contracts in the
--               period — parity with public.rpt_owner_statement (collected-cash
--               basis per ADR 0001, docs/decisions/0001). Master-lease contract
--               collections belong to the office and never enter owner gross.
--   office fee  RATE: Σ per-payment public._r3(amount × rate/100) — per-payment
--               rounding parity with rpt_owner_statement.
--               FIXED_MONTHLY: commission_value × calendar months covered by
--               the period, clipped to agreement validity. This ESTABLISHES the
--               accrual rule that 20260718113405/20260718113414 explicitly
--               deferred to the settlement layer ("FIXED_MONTHLY accrual is
--               settlement-controlled"); change it only via a superseding ADR.
--   master      Obligation basis per ADR 0001 + domain/financial-settlements.ts:
--               gross = commission_value × months, fee = 0 (vacancy-independent).
--   expenses    POSTED + charged_to=OWNER + property_owners-covered + in period
--               — mirrors public._owner_statement_expenses, with explicit
--               company and (optional) property scoping.
--   tax         public.company_settings.vat_enabled/vat_rate ON THE OFFICE FEE
--               when the settings row belongs to the caller's company, else 0
--               (ADR 0001: "configurable, disabled by default"; column comment:
--               "Optional separately presented tax/VAT on the office fee; zero
--               when tax treatment is disabled").
--   net         greatest(gross − fee − expenses − tax, 0) — identical to the
--               owner_settlements_net_payable_check constraint.
--
-- Invariants kept from P0: additive-only (no DROP TABLE/COLUMN, no data
-- deletion), SECURITY DEFINER with pinned search_path, REVOKE/GRANT baseline.
-- Rollback: supabase/rollback/20260725_rollback_p1_owner_settlement_derivation.sql
-- ============================================================================

begin;

-- ── 1) canonical derivation RPC ──────────────────────────────────────────────
create or replace function public.calculate_owner_net_payout(
  p_owner_id uuid,
  p_period_start date,
  p_period_end date,
  p_property_id uuid default null
)
returns table (
  gross_collected numeric,
  office_fee numeric,
  owner_expenses numeric,
  tax_amount numeric,
  net_payable numeric,
  breakdown jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_collected numeric := 0;
  v_rate_fees numeric := 0;
  v_fixed_fees numeric := 0;
  v_obligations numeric := 0;
  v_payments_count integer := 0;
  v_gross numeric;
  v_fee numeric;
  v_expenses numeric := 0;
  v_tax numeric := 0;
  v_net numeric;
  v_vat_enabled boolean := false;
  v_vat_rate numeric := 0;
  v_props jsonb;
begin
  -- Preview is open to any authenticated app user; the write path keeps its
  -- own stricter ADMIN/MANAGER guard (unchanged from P0).
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  -- Company derivation is self-contained (same semantics as
  -- public.require_company_id()) so this migration replays in harness phases
  -- where the P0 helper is intentionally absent.
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode = '42501';
  end if;

  if p_period_start is null or p_period_end is null or p_period_start > p_period_end then
    raise exception 'A valid settlement period is required.' using errcode = '22023';
  end if;

  -- Same F-SET scoping as the write path (defense in depth for direct callers).
  if not exists (
    select 1 from public.owners o
    where o.id = p_owner_id and o.company_id = v_company_id and o.deleted_at is null
  ) then
    raise exception 'Settlement target owner is not in your company.' using errcode = '42501';
  end if;
  if p_property_id is not null and not exists (
    select 1 from public.properties p
    where p.id = p_property_id and p.company_id = v_company_id and p.deleted_at is null
  ) then
    raise exception 'Settlement target property is not in your company.' using errcode = '42501';
  end if;

  -- Collected-cash basis: payments reach the owner through their contract's
  -- OWN agreement (per-contract rate), exactly like public.rpt_owner_statement.
  with owner_contracts as (
    select c.id as contract_id, oa.agreement_type, oa.commission_type
      , oa.commission_value
    from public.contracts c
    join public.owner_agreements oa
      on oa.id = c.agreement_id
     and oa.owner_id = p_owner_id
     and oa.company_id = v_company_id
    where c.deleted_at is null
      and c.company_id = v_company_id
      and (p_property_id is null or c.property_id::text = p_property_id::text)
  ), payment_math as (
    select
      case when oc.agreement_type = 'master_lease' then 0::numeric else p.amount end as gross,
      case
        when oc.agreement_type = 'master_lease' then 0::numeric
        when oc.commission_type = 'RATE' then public._r3(p.amount * oc.commission_value / 100)
        else 0::numeric
      end as fee
    from public.payments p
    join owner_contracts oc on oc.contract_id = p.contract_id
    where p.deleted_at is null
      and p.company_id = v_company_id
      and upper(coalesce(p.status, '')) <> 'VOID'
      and coalesce(p.payment_date, public._safe_date(p.date_time::text)) between p_period_start and p_period_end
  )
  select
    coalesce(sum(pm.gross), 0),
    coalesce(sum(pm.fee), 0),
    count(*) filter (where pm.gross <> 0)
  into v_collected, v_rate_fees, v_payments_count
  from payment_math pm;

  -- Period-based parts (FIXED_MONTHLY fees, master-lease obligations), from the
  -- governing agreement per property: latest agreement overlapping the period,
  -- same selection rule as public.rpt_owner_statement's commission pick.
  with scoped_properties as (
    select oa.property_id
    from public.owner_agreements oa
    where oa.owner_id = p_owner_id
      and oa.company_id = v_company_id
      and (p_property_id is null or oa.property_id::text = p_property_id::text)
    group by oa.property_id
  ), governing as (
    select distinct on (oa.property_id)
      oa.property_id, oa.agreement_type, oa.commission_type, oa.commission_value,
      greatest(
        (extract(year from least(coalesce(oa.ends_on, p_period_end), p_period_end))
           - extract(year from greatest(oa.starts_on, p_period_start))) * 12
        + extract(month from least(coalesce(oa.ends_on, p_period_end), p_period_end))
           - extract(month from greatest(oa.starts_on, p_period_start))
        + 1,
        0
      )::int as months
    from public.owner_agreements oa
    join scoped_properties sp on sp.property_id = oa.property_id
    where oa.company_id = v_company_id
      and oa.starts_on <= p_period_end
      and (oa.ends_on is null or oa.ends_on >= p_period_start)
    order by oa.property_id, oa.starts_on desc
  ), fixed_math as (
    select
      coalesce(sum(case when g.agreement_type = 'master_lease'
        then public._r3(g.commission_value * g.months) else 0 end), 0) as obligations,
      coalesce(sum(case when g.agreement_type <> 'master_lease' and g.commission_type = 'FIXED_MONTHLY'
        then public._r3(g.commission_value * g.months) else 0 end), 0) as fixed_fees,
      jsonb_agg(jsonb_build_object(
        'property_id', g.property_id,
        'agreement_type', g.agreement_type,
        'commission_type', g.commission_type,
        'commission_value', g.commission_value,
        'months_covered', g.months
      ) order by g.property_id) as props
    from governing g
  )
  select fm.obligations, fm.fixed_fees, fm.props
  into v_obligations, v_fixed_fees, v_props
  from fixed_math fm;

  -- Owner expenses: mirrors public._owner_statement_expenses with explicit
  -- company/property scoping (the canonical table layout — status/charged_to/
  -- date_time exist on every replayed chain since 20260720180530, so no
  -- information_schema variance guard is needed here).
  select coalesce(sum(e.amount), 0)
  into v_expenses
  from public.expenses e
  where e.deleted_at is null
    and e.company_id = v_company_id
    and upper(coalesce(e.status, '')) = 'POSTED'
    and upper(coalesce(e.charged_to, '')) = 'OWNER'
    and (p_property_id is null or e.property_id::text = p_property_id::text)
    and public._safe_date(e.date_time) between p_period_start and p_period_end
    and exists (
      select 1 from public.property_owners po
      where po.property_id = e.property_id
        and po.owner_id = p_owner_id
        and (po.starts_on is null or po.starts_on <= public._safe_date(e.date_time))
        and (po.ends_on is null or po.ends_on >= public._safe_date(e.date_time))
    );

  -- VAT on the office fee, strictly company-scoped; disabled by default.
  -- company_settings is a singleton: it is inherited only when the row belongs
  -- to the caller's company (isolation-first rule).
  select coalesce(cs.vat_enabled, false), coalesce(cs.vat_rate, 0)
    into v_vat_enabled, v_vat_rate
  from public.company_settings cs
  where cs.company_id = v_company_id
  limit 1;
  v_vat_enabled := coalesce(v_vat_enabled, false);
  v_vat_rate := coalesce(v_vat_rate, 0);

  v_gross := public._r3(v_collected + v_obligations);
  v_fee := public._r3(v_rate_fees + v_fixed_fees);
  v_expenses := public._r3(v_expenses);
  if v_vat_enabled and v_vat_rate > 0 and v_fee > 0 then
    v_tax := public._r3(v_fee * v_vat_rate / 100);
  end if;
  v_net := greatest(v_gross - v_fee - v_expenses - v_tax, 0);

  return query
  select
    v_gross,
    v_fee,
    v_expenses,
    v_tax,
    v_net,
    jsonb_build_object(
      'source', 'server_derived',
      'payments_count', v_payments_count,
      'collected_gross', public._r3(v_collected),
      'rate_fees', v_rate_fees,
      'fixed_fees', v_fixed_fees,
      'master_obligations', v_obligations,
      'agreements', coalesce(v_props, '[]'::jsonb),
      'vat', jsonb_build_object('enabled', v_vat_enabled, 'rate', v_vat_rate),
      'policy', jsonb_build_object(
        'basis', 'collected_cash (ADR 0001)',
        'fixed_monthly_accrual', 'commission_value × calendar months covered by the period, clipped to agreement validity',
        'master_lease_basis', 'obligation basis: gross = value × months, fee = 0',
        'rounding', 'public._r3 with per-payment rate-fee rounding (rpt_owner_statement parity)'
      )
    );
end;
$function$;

revoke all on function public.calculate_owner_net_payout(uuid, date, date, uuid) from public, anon;
grant execute on function public.calculate_owner_net_payout(uuid, date, date, uuid) to authenticated, service_role;

comment on function public.calculate_owner_net_payout(uuid, date, date, uuid) is
  'P1 canonical owner-settlement derivation (ADR 0001, collected-cash basis). Client inputs are never financial sources. Establishes the FIXED_MONTHLY months accrual previously deferred by 20260718113414; supersede only via a new written decision record.';

-- ── 2) write path: ignore client amounts, persist the derived tuple ─────────
-- Same body as the P0 (F-SET) version, except the four amount variables are
-- populated by public.calculate_owner_net_payout instead of the request
-- payload. Role guard, required-field checks, period check, F-SET owner /
-- property guards, idempotency cache, advisory lock, and the duplicate-period
-- guard are byte-identical in order and message.
CREATE OR REPLACE FUNCTION public.create_owner_settlement_draft_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_owner_id text := nullif(p_payload->>'owner_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_period_start date := nullif(p_payload->>'period_start', '')::date;
  v_period_end date := nullif(p_payload->>'period_end', '')::date;
  -- P1: amounts are NEVER read from the payload. Any gross_collected /
  -- office_fee / owner_expenses / tax_amount keys the client sends are ignored.
  v_gross numeric;
  v_fee numeric;
  v_expenses numeric;
  v_tax numeric;
  v_net numeric;
  v_id text;
  v_no text;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create owner settlements.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_owner_id is null or v_period_start is null or v_period_end is null or v_request_id is null then
    raise exception 'owner_id, period_start, period_end, and request_id are required.';
  end if;
  if v_period_start > v_period_end then raise exception 'period_start must be on or before period_end.'; end if;

  -- P0 (F-SET): the settlement target must belong to the caller's company.
  if not exists (
    select 1 from public.owners o
    where o.id::text = v_owner_id and o.company_id = v_company_id and o.deleted_at is null
  ) then
    raise exception 'Settlement target owner is not in your company.' using errcode = '42501';
  end if;
  if v_property_id is not null and not exists (
    select 1 from public.properties p
    where p.id::text = v_property_id and p.company_id = v_company_id and p.deleted_at is null
  ) then
    raise exception 'Settlement target property is not in your company.' using errcode = '42501';
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_owner_settlement_draft_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'owner_settlement:' || v_owner_id || ':' || coalesce(v_property_id, '*') || ':' || v_period_start || ':' || v_period_end,
    0
  ));

  if exists (
    select 1 from public.owner_settlements
    where owner_id = v_owner_id
      and coalesce(property_id, '') = coalesce(v_property_id, '')
      and period_start = v_period_start
      and period_end = v_period_end
      and status <> 'CANCELLED'
  ) then
    raise exception 'An active settlement already exists for this owner, property, and period.' using errcode = '23505';
  end if;

  -- P1 (amount integrity): derive every amount from canonical sources.
  select c.gross_collected, c.office_fee, c.owner_expenses, c.tax_amount, c.net_payable
    into v_gross, v_fee, v_expenses, v_tax, v_net
  from public.calculate_owner_net_payout(
    v_owner_id::uuid,
    v_period_start,
    v_period_end,
    v_property_id::uuid
  ) as c;

  v_id := gen_random_uuid()::text;
  v_no := 'OST-' || to_char(v_period_end, 'YYYYMM') || '-' || upper(substr(replace(v_id, '-', ''), 1, 8));

  insert into public.owner_settlements (
    id, no, owner_id, property_id, date, period_start, period_end,
    gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
    amount, status, request_id, notes, created_at, updated_at
  , company_id) values (
    v_id, v_no, v_owner_id, v_property_id, v_period_end::text, v_period_start, v_period_end,
    v_gross, v_fee, v_expenses, v_tax, v_net,
    v_net, 'DRAFT', v_request_id::uuid, p_payload->>'notes', now(), now()
  , v_company_id);

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'owner_settlements', v_id, 'Owner settlement draft created (server-derived amounts)',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'settlement_id', v_id,
    'settlement_no', v_no, 'status', 'DRAFT', 'net_payable', v_net,
    'amounts_source', 'server_derived',
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_owner_settlement_draft_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$function$
;

-- F-SET-2 Trigger: derived amounts are immutable after insert.
-- RLS on owner_settlements is permissive for any app user within their company
-- (app_user_owner_settlements FOR ALL + p0_tenant_isolation RESTRICTIVE), so a
-- company member could otherwise UPDATE the amount columns directly via table
-- access — the same client-as-source-of-truth hole through a side door. No
-- legitimate UPDATE ever changes amounts: create writes the derived tuple at
-- INSERT; approve/pay/cancel (SECURITY DEFINER, RLS-bypassing) touch status,
-- method and timestamps only. The trigger is deliberately RLS-independent so it
-- also guards definer-context writes. Regression proof:
-- src/p1/p1-owner-settlement-integrity.test.ts ("derived amounts are immutable").
create or replace function public.enforce_owner_settlement_amount_immutability()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.gross_collected is distinct from old.gross_collected
     or new.office_fee is distinct from old.office_fee
     or new.owner_expenses is distinct from old.owner_expenses
     or new.tax_amount is distinct from old.tax_amount
     or new.net_payable is distinct from old.net_payable then
    raise exception 'Owner settlement amounts are server-derived and immutable; create a corrected settlement instead.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$
;

comment on function public.enforce_owner_settlement_amount_immutability() is
  'P1: settlement amounts come only from calculate_owner_net_payout at insert time; no UPDATE may change them.';

drop trigger if exists p1_owner_settlements_amounts_immutable on public.owner_settlements;
create trigger p1_owner_settlements_amounts_immutable
  before update on public.owner_settlements
  for each row execute function public.enforce_owner_settlement_amount_immutability();

-- ACL parity with the pre-P1 posture: deliberately NO grant statements here.
-- CREATE OR REPLACE preserves existing ACLs, and 20260723000000 hardened this
-- function to authenticated-only (service_role explicitly removed). Touching
-- grants here would silently widen that posture; the forward→rollback
-- fingerprint gate asserts byte-exact acl equality (src/p1/p1-forward-rollback).

commit;
