-- =============================================================================
-- FA-003 — Atomic owner-settlement input reservation (foundation)
-- =============================================================================
-- Closes: a single collection (payment) or owner expense could be captured by
-- more than one owner settlement, especially under overlapping periods or
-- concurrent requests.
--
-- Design (full rationale: docs/accounting/SETTLEMENT_ITEM_RESERVATION_DESIGN_AR.md)
--   Reservation unit — COLLECTIONS: payment_id
--     The P1 derivation (public.calculate_owner_net_payout) sums per-payment
--     gross/fee from public.payments joined through the contract to its OWN
--     agreement. Each payment row belongs to exactly one contract → one owner →
--     one property, and the derivation never splits a payment (receipt_allocations
--     are not a settlement source). So the smallest economic record that appears
--     inside a settlement is the payment row itself.
--   Reservation unit — EXPENSES: expense_id
--     Each qualifying expense row is summed whole into owner_expenses.
--   Reserved links are immutable while active and are only released by the
--   official cancellation RPC. Paid settlements keep released_at = NULL forever
--   so the partial unique index below keeps their items permanently reserved.
--
-- Forward-only. No table/row/account/amount of any existing table is changed.
-- Rollback: supabase/rollback/20260804_rollback_fa003_owner_settlement_input_reservation.sql
-- =============================================================================

begin;

-- ── 0) composite unique targets so the link tables can enforce that a link's
-- settlement/item and company_id always describe the SAME company, at the
-- schema (FK) level rather than relying on RLS alone. id is already unique
-- (PK), so these add the (id, company_id) key without widening PK semantics.
create unique index if not exists owner_settlements_id_company_uidx
  on public.owner_settlements (id, company_id);

create unique index if not exists payments_id_company_uidx
  on public.payments (id, company_id);

create unique index if not exists expenses_id_company_uidx
  on public.expenses (id, company_id);

-- ── 1) collection link table ─────────────────────────────────────────────────
create table public.owner_settlement_payment_links (
  id uuid not null primary key default gen_random_uuid(),
  company_id uuid not null,
  settlement_id text not null,
  payment_id uuid not null,
  reserved_at timestamptz not null default now(),
  reserved_by uuid,
  released_at timestamptz,
  released_by uuid,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_settlement_payment_links_settlement_fkey
    foreign key (settlement_id, company_id)
    references public.owner_settlements (id, company_id),
  constraint owner_settlement_payment_links_payment_fkey
    foreign key (payment_id, company_id)
    references public.payments (id, company_id),
  constraint owner_settlement_payment_links_same_settlement_unique
    unique (settlement_id, payment_id)
);

comment on table public.owner_settlement_payment_links is
  'FA-003: atomic reservation of a collected payment inside exactly one owner settlement. While released_at IS NULL the payment may not enter any other non-cancelled settlement.';

comment on column public.owner_settlement_payment_links.company_id is
  'Company that owns the settlement AND the payment; enforced by composite FK and a constraint trigger so a cross-company link is impossible even from direct SQL.';
comment on column public.owner_settlement_payment_links.released_at is
  'Set only by the official cancellation RPC (release_reason = SETTLEMENT_CANCELLED). A PAID settlement keeps this NULL forever so the item stays reserved.';
comment on column public.owner_settlement_payment_links.release_reason is
  'Auditable reason for releasing the reservation; never set when the settlement is paid.';

-- An item may be actively reserved by at most one settlement per company.
-- This is the authoritative, atomic concurrency guard: the write RPC also
-- pre-checks for a friendly error, but any race is settled here at insert time.
create unique index owner_settlement_payment_links_active_uidx
  on public.owner_settlement_payment_links (company_id, payment_id)
  where released_at is null;

-- ── 2) expense link table ────────────────────────────────────────────────────
create table public.owner_settlement_expense_links (
  id uuid not null primary key default gen_random_uuid(),
  company_id uuid not null,
  settlement_id text not null,
  expense_id uuid not null,
  reserved_at timestamptz not null default now(),
  reserved_by uuid,
  released_at timestamptz,
  released_by uuid,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_settlement_expense_links_settlement_fkey
    foreign key (settlement_id, company_id)
    references public.owner_settlements (id, company_id),
  constraint owner_settlement_expense_links_expense_fkey
    foreign key (expense_id, company_id)
    references public.expenses (id, company_id),
  constraint owner_settlement_expense_links_same_settlement_unique
    unique (settlement_id, expense_id)
);

comment on table public.owner_settlement_expense_links is
  'FA-003: atomic reservation of an owner expense inside exactly one owner settlement. While released_at IS NULL the expense may not enter any other non-cancelled settlement.';

comment on column public.owner_settlement_expense_links.company_id is
  'Company that owns the settlement AND the expense; enforced by composite FK and a constraint trigger so a cross-company link is impossible even from direct SQL.';
comment on column public.owner_settlement_expense_links.released_at is
  'Set only by the official cancellation RPC (release_reason = SETTLEMENT_CANCELLED). A PAID settlement keeps this NULL forever so the item stays reserved.';

create unique index owner_settlement_expense_links_active_uidx
  on public.owner_settlement_expense_links (company_id, expense_id)
  where released_at is null;

-- ── 3) company-consistency constraint trigger (defense in depth, not RLS) ────
-- Even a direct, non-RPC INSERT (which RLS blocks for the browser but not for
-- a privileged role) cannot create a link whose settlement or item belongs to a
-- different company than the link's own company_id.
create or replace function public.enforce_owner_settlement_link_company_consistency()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_settlement_company uuid;
  v_item_company uuid;
begin
  select s.company_id into v_settlement_company
    from public.owner_settlements s
   where s.id = NEW.settlement_id;
  if v_settlement_company is null or v_settlement_company is distinct from NEW.company_id then
    raise exception 'OWNER_SETTLEMENT_LINK_COMPANY_MISMATCH'
      using errcode = 'P0001';
  end if;

  if TG_TABLE_NAME = 'owner_settlement_payment_links' then
    select p.company_id into v_item_company
      from public.payments p
     where p.id = NEW.payment_id;
  else
    select e.company_id into v_item_company
      from public.expenses e
     where e.id = NEW.expense_id;
  end if;
  if v_item_company is null or v_item_company is distinct from NEW.company_id then
    raise exception 'OWNER_SETTLEMENT_LINK_COMPANY_MISMATCH'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$function$;

comment on function public.enforce_owner_settlement_link_company_consistency() is
  'FA-003: prevents any owner-settlement link whose settlement or item belongs to a company different from the link company_id, independent of RLS.';

create trigger fa003_payment_links_company_consistency
  before insert or update of company_id, settlement_id, payment_id
  on public.owner_settlement_payment_links
  for each row execute function public.enforce_owner_settlement_link_company_consistency();

create trigger fa003_expense_links_company_consistency
  before insert or update of company_id, settlement_id, expense_id
  on public.owner_settlement_expense_links
  for each row execute function public.enforce_owner_settlement_link_company_consistency();

-- ── 4) RLS: company-scoped SELECT only; no direct browser writes ─────────────
-- The SECURITY DEFINER lifecycle RPCs are owned by the postgres role, which is
-- the table owner and bypasses RLS, so they can insert/release links. Any other
-- role (authenticated browser) can only SELECT within its own company; there is
-- deliberately NO INSERT/UPDATE/DELETE policy, so the browser cannot create,
-- mutate, or delete a reservation directly.
alter table public.owner_settlement_payment_links enable row level security;
alter table public.owner_settlement_expense_links enable row level security;

create policy fa003_payment_links_select
  on public.owner_settlement_payment_links
  for select to authenticated
  using (company_id = public.current_company_id());

create policy fa003_expense_links_select
  on public.owner_settlement_expense_links
  for select to authenticated
  using (company_id = public.current_company_id());

revoke all on public.owner_settlement_payment_links from public, anon;
revoke all on public.owner_settlement_expense_links from public, anon;

-- authenticated may read its own company's reservations (RLS-filtered) but has
-- NO INSERT/UPDATE/DELETE grant — the browser can never create, mutate, or
-- delete a reservation directly; only the SECURITY DEFINER lifecycle RPCs
-- (running as the table-owning postgres role) write.
grant select on public.owner_settlement_payment_links to authenticated;
grant select on public.owner_settlement_expense_links to authenticated;

-- ── 5) helper functions: the exact item sets the derivation would include ────
-- These are the ONLY source of "which payments/expenses belong to this
-- settlement". The create path, the approve/pay guards, the diagnostic and the
-- backfill all share these, so membership is always derived, never re-queried
-- loosely, and never taken from the client.
--
-- Payments: non-master-lease payments of the owner's contracts in the period
-- (master-lease collections belong to the office and never enter owner gross,
-- ADR 0001, so they are NOT reserved against an owner settlement). This is the
-- payment_math of calculate_owner_net_payout restricted to agreements whose
-- gross actually accrues to the owner.
create or replace function public.owner_settlement_reservable_payments(
  p_company_id uuid,
  p_owner_id uuid,
  p_period_start date,
  p_period_end date,
  p_property_id text default null
)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  return query
    select p.id
      from public.payments p
      join public.contracts c
        on c.id = p.contract_id
       and c.deleted_at is null
       and c.company_id = p_company_id
      join public.owner_agreements oa
        on oa.id = c.agreement_id
       and oa.owner_id = p_owner_id
       and oa.company_id = p_company_id
     where p.deleted_at is null
       and p.company_id = p_company_id
       and upper(coalesce(p.status, '')) <> 'VOID'
       and coalesce(p.payment_date, public._safe_date(p.date_time::text))
             between p_period_start and p_period_end
       and (p_property_id is null or c.property_id::text = p_property_id::text)
       and oa.agreement_type <> 'master_lease';
end;
$function$;

-- Expenses: mirrors the owner-expense clause of calculate_owner_net_payout.
create or replace function public.owner_settlement_reservable_expenses(
  p_company_id uuid,
  p_owner_id uuid,
  p_period_start date,
  p_period_end date,
  p_property_id text default null
)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  return query
    select e.id
      from public.expenses e
     where e.deleted_at is null
       and e.company_id = p_company_id
       and upper(coalesce(e.status, '')) = 'POSTED'
       and upper(coalesce(e.charged_to, '')) = 'OWNER'
       and (p_property_id is null or e.property_id::text = p_property_id::text)
       and public._safe_date(e.date_time) between p_period_start and p_period_end
       and exists (
         select 1
           from public.property_owners po
          where po.property_id = e.property_id
            and po.owner_id = p_owner_id
            and (po.starts_on is null or po.starts_on <= public._safe_date(e.date_time))
            and (po.ends_on is null or po.ends_on >= public._safe_date(e.date_time))
       );
end;
$function$;

comment on function public.owner_settlement_reservable_payments(uuid, uuid, date, date, text) is
  'FA-003: the deterministic set of payment ids that belong to a settlement for a given company/owner/property/period. Shared by create, approve, pay, diagnostic and backfill so item membership is always derived from one source.';
comment on function public.owner_settlement_reservable_expenses(uuid, uuid, date, date, text) is
  'FA-003: the deterministic set of owner-expense ids that belong to a settlement for a given company/owner/property/period.';

-- These are internal financial-identity helpers. They are deliberately NOT
-- executable by the browser: exposing them would turn them into a
-- cross-company existence oracle. Only the SECURITY DEFINER RPCs (running as
-- the owning postgres role) and the system backfill/diagnostic call them.
revoke all on function public.owner_settlement_reservable_payments(uuid, uuid, date, date, text) from public, anon;
revoke all on function public.owner_settlement_reservable_expenses(uuid, uuid, date, date, text) from public, anon;
grant execute on function public.owner_settlement_reservable_payments(uuid, uuid, date, date, text) to service_role;
grant execute on function public.owner_settlement_reservable_expenses(uuid, uuid, date, date, text) to service_role;

-- ── 6) read-only historical diagnostic (company-scoped, never mutates) ───────
-- Reveals, for the CALLER'S company only:
--   * a payment/expense inside more than one non-cancelled settlement
--   * overlapping settlements for the same owner/property
--   * paid settlements that share an item
--   * a settlement whose stored amounts do not match the derivable items
--   * settlements that cannot be attributed deterministically
create or replace function public.diagnose_owner_settlement_duplication()
returns table (
  company_id uuid,
  finding_type text,
  subject text,
  detail jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
begin
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).'
      using errcode = '42501';
  end if;

  -- payment present in >1 non-cancelled settlement
  return query
  with ps as (
    select s.id::text as settlement_id, p.id::text as payment_id
      from public.owner_settlements s
      cross join lateral public.owner_settlement_reservable_payments(
        v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
      ) as p(id)
     where s.company_id = v_company_id and s.status <> 'CANCELLED'
  )
  select v_company_id, 'payment_in_multiple_settlements'::text,
         payment_id,
         jsonb_build_object('settlements', jsonb_agg(settlement_id))
    from ps
   group by payment_id
  having count(*) > 1;

  return query
  with es as (
    select s.id::text as settlement_id, e.id::text as expense_id
      from public.owner_settlements s
      cross join lateral public.owner_settlement_reservable_expenses(
        v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
      ) as e(id)
     where s.company_id = v_company_id and s.status <> 'CANCELLED'
  )
  select v_company_id, 'expense_in_multiple_settlements'::text,
         expense_id,
         jsonb_build_object('settlements', jsonb_agg(settlement_id))
    from es
   group by expense_id
  having count(*) > 1;

  -- overlapping active settlements for same owner/property
  return query
  select v_company_id, 'overlapping_settlements'::text,
         s1.id::text,
         jsonb_build_object(
           'owner_id', s1.owner_id,
           'property_id', s1.property_id,
           'settlement_a', s1.id, 'period_a', jsonb_build_array(s1.period_start, s1.period_end),
           'settlement_b', s2.id, 'period_b', jsonb_build_array(s2.period_start, s2.period_end),
           'status_a', s1.status, 'status_b', s2.status
         )
    from public.owner_settlements s1
    join public.owner_settlements s2
      on s2.company_id = s1.company_id
     and s2.id <> s1.id
     and s2.owner_id = s1.owner_id
     and coalesce(s2.property_id::text, '') = coalesce(s1.property_id::text, '')
     and s2.status <> 'CANCELLED'
     and s1.period_start <= s2.period_end
     and s2.period_start <= s1.period_end
   where s1.company_id = v_company_id
     and s1.status <> 'CANCELLED';

  -- amount mismatch: stored expenses vs derived; stored gross vs derived
  -- payment gross (only when the settlement actually has reservable payments,
  -- so master-lease obligation-only settlements are not false-flagged).
  return query
  select v_company_id, 'amount_mismatch'::text,
         s.id::text,
         jsonb_build_object(
           'stored_gross', s.gross_collected,
           'derived_payment_gross', coalesce((
             select sum(p.amount)
               from public.owner_settlement_reservable_payments(
                 v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
               ) as pid
               join public.payments p on p.id = pid
           ), 0),
           'stored_expenses', s.owner_expenses,
           'derived_expenses', coalesce((
             select sum(e.amount)
               from public.owner_settlement_reservable_expenses(
                 v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
               ) as eid
               join public.expenses e on e.id = eid
           ), 0)
         )
    from public.owner_settlements s
   where s.company_id = v_company_id
     and s.status <> 'CANCELLED'
     and (
       abs(s.owner_expenses - coalesce((
         select sum(e.amount)
           from public.owner_settlement_reservable_expenses(
             v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
           ) as eid
           join public.expenses e on e.id = eid
       ), 0)) > 0.001
       or (
         exists (select 1 from public.owner_settlement_reservable_payments(
           v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text))
         and abs(s.gross_collected - coalesce((
           select sum(p.amount)
             from public.owner_settlement_reservable_payments(
               v_company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
             ) as pid
             join public.payments p on p.id = pid
         ), 0)) > 0.001
       )
     );

  -- settlements that cannot be attributed deterministically (missing period)
  return query
  select v_company_id, 'indeterminate_items'::text,
         s.id::text,
         jsonb_build_object('period_start', s.period_start, 'period_end', s.period_end)
    from public.owner_settlements s
   where s.company_id = v_company_id
     and s.status <> 'CANCELLED'
     and (s.period_start is null or s.period_end is null);
end;
$function$;

comment on function public.diagnose_owner_settlement_duplication() is
  'FA-003: read-only, company-scoped diagnostic over historical settlements. Returns only the caller company rows; never mutates data.';

revoke all on function public.diagnose_owner_settlement_duplication() from public, anon;
grant execute on function public.diagnose_owner_settlement_duplication() to authenticated, service_role;

-- ── 7) backfill gate + backfill (link-only, guarded) ─────────────────────────
-- assert_owner_settlement_links_backfillable(): raises (never partially runs)
-- if any historical conflict exists — a payment/expense in >1 active
-- settlement, or a deterministic amount mismatch. It is the FA-003 historical
-- stop-gate: we never pick a winner, never delete a link, never change amounts.
create or replace function public.assert_owner_settlement_links_backfillable()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_dupe_payments int;
  v_dupe_expenses int;
  v_mismatch int;
begin
  with ps as (
    select s.id as settlement_id, p.id as payment_id
      from public.owner_settlements s
      cross join lateral public.owner_settlement_reservable_payments(
        s.company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
      ) as p(id)
     where s.status <> 'CANCELLED'
  )
  select coalesce(count(*), 0) into v_dupe_payments
    from (select payment_id from ps group by payment_id having count(*) > 1) t;

  with es as (
    select s.id as settlement_id, e.id as expense_id
      from public.owner_settlements s
      cross join lateral public.owner_settlement_reservable_expenses(
        s.company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
      ) as e(id)
     where s.status <> 'CANCELLED'
  )
  select coalesce(count(*), 0) into v_dupe_expenses
    from (select expense_id from es group by expense_id having count(*) > 1) t;

  select coalesce(count(*), 0) into v_mismatch
    from public.owner_settlements s
   where s.status <> 'CANCELLED'
     and (
       abs(s.owner_expenses - coalesce((
         select sum(e.amount)
           from public.owner_settlement_reservable_expenses(
             s.company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
           ) as eid
           join public.expenses e on e.id = eid
       ), 0)) > 0.001
       or (
         exists (select 1 from public.owner_settlement_reservable_payments(
           s.company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text))
         and abs(s.gross_collected - coalesce((
           select sum(p.amount)
             from public.owner_settlement_reservable_payments(
               s.company_id, s.owner_id::uuid, s.period_start, s.period_end, s.property_id::text
             ) as pid
             join public.payments p on p.id = pid
         ), 0)) > 0.001
       )
     );

  if v_dupe_payments > 0 or v_dupe_expenses > 0 or v_mismatch > 0 then
    raise exception 'OWNER_SETTLEMENT_BACKFILL_BLOCKED: historical conflicts detected (duplicate_payments=%, duplicate_expenses=%, amount_mismatches=%). No partial backfill performed and no winner chosen; resolve the historical duplicates before enabling reservation backfill.',
      v_dupe_payments, v_dupe_expenses, v_mismatch
      using errcode = 'P0001';
  end if;
end;
$function$;

-- backfill_owner_settlement_links(): creates link rows ONLY (never amounts,
-- status, dates, or accounting). For active settlements links are created
-- unreleased (permanent); for CANCELLED settlements links are created released
-- for auditability. Skips settlements that already have links (idempotent).
create or replace function public.backfill_owner_settlement_links()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  r record;
  v_created_p int := 0;
  v_created_e int := 0;
  v_released_p int := 0;
  v_released_e int := 0;
  v_skipped int := 0;
  v_pmt bigint;
  v_exp bigint;
begin
  perform public.assert_owner_settlement_links_backfillable();

  for r in
    select s.*
      from public.owner_settlements s
     order by s.created_at nulls last, s.id
  loop
    if exists (
      select 1 from public.owner_settlement_payment_links
      where settlement_id = r.id
    ) or exists (
      select 1 from public.owner_settlement_expense_links
      where settlement_id = r.id
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if r.status = 'CANCELLED' then
      insert into public.owner_settlement_payment_links (
        id, company_id, settlement_id, payment_id,
        reserved_at, reserved_by, released_at, released_by, release_reason,
        created_at, updated_at
      )
      select gen_random_uuid(), r.company_id, r.id, p.id,
             coalesce(r.created_at, now()), r.cancelled_by,
             now(), r.cancelled_by, 'SETTLEMENT_CANCELLED_BACKFILL',
             now(), now()
        from public.owner_settlement_reservable_payments(
          r.company_id, r.owner_id::uuid, r.period_start, r.period_end, r.property_id::text
        ) as p(id);
      get diagnostics v_pmt = row_count;
      v_released_p := v_released_p + v_pmt;

      insert into public.owner_settlement_expense_links (
        id, company_id, settlement_id, expense_id,
        reserved_at, reserved_by, released_at, released_by, release_reason,
        created_at, updated_at
      )
      select gen_random_uuid(), r.company_id, r.id, e.id,
             coalesce(r.created_at, now()), r.cancelled_by,
             now(), r.cancelled_by, 'SETTLEMENT_CANCELLED_BACKFILL',
             now(), now()
        from public.owner_settlement_reservable_expenses(
          r.company_id, r.owner_id::uuid, r.period_start, r.period_end, r.property_id::text
        ) as e(id);
      get diagnostics v_exp = row_count;
      v_released_e := v_released_e + v_exp;
    else
      insert into public.owner_settlement_payment_links (
        id, company_id, settlement_id, payment_id,
        reserved_at, reserved_by, created_at, updated_at
      )
      select gen_random_uuid(), r.company_id, r.id, p.id,
             coalesce(r.created_at, now()), null, now(), now()
        from public.owner_settlement_reservable_payments(
          r.company_id, r.owner_id::uuid, r.period_start, r.period_end, r.property_id::text
        ) as p(id);
      get diagnostics v_pmt = row_count;
      v_created_p := v_created_p + v_pmt;

      insert into public.owner_settlement_expense_links (
        id, company_id, settlement_id, expense_id,
        reserved_at, reserved_by, created_at, updated_at
      )
      select gen_random_uuid(), r.company_id, r.id, e.id,
             coalesce(r.created_at, now()), null, now(), now()
        from public.owner_settlement_reservable_expenses(
          r.company_id, r.owner_id::uuid, r.period_start, r.period_end, r.property_id::text
        ) as e(id);
      get diagnostics v_exp = row_count;
      v_created_e := v_created_e + v_exp;
    end if;
  end loop;

  return jsonb_build_object(
    'active_payment_links_created', v_created_p,
    'active_expense_links_created', v_created_e,
    'released_payment_links_created', v_released_p,
    'released_expense_links_created', v_released_e,
    'settlements_skipped', v_skipped
  );
end;
$function$;

comment on function public.assert_owner_settlement_links_backfillable() is
  'FA-003: historical stop-gate. Raises if any payment/expense belongs to more than one non-cancelled settlement or any stored amount does not match the deterministic derivation. Never chooses a winner, never mutates data.';
comment on function public.backfill_owner_settlement_links() is
  'FA-003: creates reservation link rows only (no amounts/status/accounting changes). Active settlements get permanent unreleased links; CANCELLED settlements get released links for audit. Idempotent and guarded by assert_owner_settlement_links_backfillable().';

revoke all on function public.assert_owner_settlement_links_backfillable() from public, anon;
grant execute on function public.assert_owner_settlement_links_backfillable() to service_role;
revoke all on function public.backfill_owner_settlement_links() from public, anon;
grant execute on function public.backfill_owner_settlement_links() to service_role;

commit;
