-- WP-01: Narrow Maker-Checker enforcement for designated sensitive actions.
-- Addresses GAP-002 (SEC-008, OPS-007).
--
-- Designated sensitive approvals covered in this migration:
--   1. Owner settlement approval/pay — trigger-based identity separation
--
-- Designated sensitive approvals already enforced on main:
--   2. Contract approval/activation (20260808010000)
--   3. Permission request review (20260810113000)
--
-- Explicitly deferred to WP-02:
--   4. Receipt VOID — requires full request→approve lifecycle with mandatory
--      reason, separate approver, reversal-event reference, immutable audit
--      history and audited ADMIN emergency override per OD-02/ADR-0015.
--      A status-change trigger alone is not equivalent to governed VOID.
--      See GAP-002 / WP-02 for the required outcome.
--
-- Design: trigger-based enforcement. No financial RPC replacement.
-- No direct journal_entries writes. No accounting-policy changes.
-- Existing RPC signatures, grants, company isolation, idempotency,
-- accounting calls, audit behavior and response contracts are preserved
-- because the RPCs themselves are not modified.

begin;

-- ── 1. Owner settlements: add maker/checker columns ────────────────────────
alter table public.owner_settlements
  add column if not exists maker_user_id uuid,
  add column if not exists checker_user_id uuid;

-- Backfill maker_user_id from audit log for existing rows (best-effort).
update public.owner_settlements s
set maker_user_id = (
  select al.user_id
  from public.audit_log al
  where al.entity = 'owner_settlements'
    and al.entity_id = s.id::text
    and al.action = 'CREATE'
  order by al.created_at asc
  limit 1
)
where s.maker_user_id is null;

-- Distinct maker/checker constraint (allows nulls for historical rows).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_maker_checker_distinct_chk'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint settlements_maker_checker_distinct_chk
      check (
        maker_user_id is null
        or checker_user_id is null
        or maker_user_id <> checker_user_id
      ) not valid;
  end if;
end $$;

-- ── 2. Settlement maker-checker trigger ────────────────────────────────────
-- Captures maker on INSERT, enforces identity separation on approval/pay.
-- Does NOT modify the settlement RPC functions; triggers fire after the RPC.
create or replace function public.enforce_settlement_maker_checker()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- On INSERT: capture the maker identity.
  if tg_op = 'INSERT' then
    if new.maker_user_id is null and v_actor is not null then
      new.maker_user_id := v_actor;
    end if;
    return new;
  end if;

  -- On UPDATE: when status transitions to APPROVED or PAID, enforce maker-checker.
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('APPROVED', 'PAID')
     and old.maker_user_id is not null
     and v_actor is not null
     and v_actor = old.maker_user_id
  then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT: the settlement creator cannot approve or pay it.'
      using errcode = '42501';
  end if;

  -- On UPDATE: when status transitions to APPROVED, record checker.
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status = 'APPROVED'
     and v_actor is not null
  then
    new.checker_user_id := v_actor;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_settlement_maker_checker() from public, anon, authenticated;

drop trigger if exists settlement_maker_checker_guard on public.owner_settlements;
create trigger settlement_maker_checker_guard
  before insert or update of status on public.owner_settlements
  for each row
  execute function public.enforce_settlement_maker_checker();

-- ── 3. Receipt void maker-checker (PARTIAL — WP-02 dependency) ─────────────
-- OD-02/ADR-0015 requires a full VOID lifecycle: request→approve with mandatory
-- reason, separate approver, reversal-batch reference, immutable audit history,
-- and audited ADMIN emergency override.
-- A trigger on status change alone does not satisfy this contract.
-- The existing void_receipt_atomic already enforces auth.uid() is not null and
-- company_id validation. The full VOID request/approve lifecycle is WP-02 work.
-- This column prepares the schema; the enforcement lifecycle is documented as
-- PARTIAL until WP-02 implements the complete VOID workflow.
alter table public.receipts
  add column if not exists maker_user_id uuid;

-- ── 4. Comments ─────────────────────────────────────────────────────────────
comment on column public.owner_settlements.maker_user_id
  is 'SEC-008: the user who created the settlement (maker in maker-checker). Captured by trigger on INSERT.';

comment on column public.owner_settlements.checker_user_id
  is 'SEC-008: the user who approved the settlement (checker in maker-checker). Set by trigger on APPROVED transition.';

comment on column public.receipts.maker_user_id
  is 'SEC-008: reserved for VOID maker-checker lifecycle. Full request→approve enforcement is deferred to WP-02 per OD-02.';

comment on trigger settlement_maker_checker_guard on public.owner_settlements
  is 'SEC-008: prevents the settlement creator from approving or paying their own settlement.';

commit;
