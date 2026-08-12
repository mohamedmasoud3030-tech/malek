-- WP-01: Maker-Checker enforcement for designated sensitive actions.
-- Addresses the owner-settlement portion of GAP-002 (SEC-008, OPS-007).
--
-- Covered here:
--   1. Owner settlement draft creation records the authenticated maker.
--   2. DRAFT -> APPROVED rejects self-approval and records the checker.
--   3. APPROVED -> PAID rejects payment by the original maker.
--   4. Maker/checker identities are immutable after they are established.
--
-- Already enforced on main:
--   5. Contract approval/activation (20260808010000).
--   6. Permission request review (20260810113000).
--
-- Still open and explicitly NOT claimed complete here:
--   7. Receipt VOID requires the full request -> approve lifecycle with mandatory
--      reason, separate approver, reversal-event reference, immutable audit
--      history and an audited emergency override only if explicitly approved.
--
-- No direct journal writes and no accounting-policy changes.

begin;

-- ── 1. Owner-settlement identities ──────────────────────────────────────────
alter table public.owner_settlements
  add column if not exists maker_user_id uuid,
  add column if not exists checker_user_id uuid;

-- Historical rows are allowed to remain null until a governed lifecycle write.
-- New/updated approved or paid rows must have both identities and they must differ.
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

  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_approved_identity_required_chk'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint settlements_approved_identity_required_chk
      check (
        upper(coalesce(status::text, '')) not in ('APPROVED', 'PAID')
        or (
          maker_user_id is not null
          and checker_user_id is not null
          and maker_user_id <> checker_user_id
        )
      ) not valid;
  end if;
end $$;

create or replace function public.owner_settlement_maker_checker_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_maker uuid;
  v_checker uuid;
begin
  if tg_op = 'INSERT' then
    -- Official creation RPCs are authenticated and therefore always stamp the
    -- maker. Internal replay/maintenance fixtures may run without a JWT; they
    -- may create a DRAFT with null maker, but cannot later approve/pay it unless
    -- the authoritative creator can be recovered from audit history.
    if v_actor is null then
      return new;
    end if;

    if new.maker_user_id is not null and new.maker_user_id <> v_actor then
      raise exception 'Owner settlement maker identity cannot be supplied for another user.'
        using errcode = '42501';
    end if;

    new.maker_user_id := v_actor;
    return new;
  end if;

  -- Once established, maker identity is immutable. The only allowed null ->
  -- value transition is the controlled legacy recovery below.
  if old.maker_user_id is not null
     and new.maker_user_id is distinct from old.maker_user_id then
    raise exception 'Owner settlement maker identity is immutable.'
      using errcode = '42501';
  end if;

  if old.checker_user_id is not null
     and new.checker_user_id is distinct from old.checker_user_id then
    raise exception 'Owner settlement checker identity is immutable.'
      using errcode = '42501';
  end if;

  v_maker := old.maker_user_id;
  v_checker := old.checker_user_id;

  -- Legacy drafts created before this migration do not have maker_user_id.
  -- Recover the authoritative creator from the immutable audit event when
  -- possible. Never guess from the current actor.
  if v_maker is null then
    select a.user_id
      into v_maker
      from public.audit_log a
     where a.entity = 'owner_settlements'
       and a.entity_id = old.id::text
       and a.action = 'CREATE'
       and a.user_id is not null
     order by a.created_at asc nulls last, a.ts asc nulls last
     limit 1;
  end if;

  -- Legacy approved rows can recover the checker from approved_by, which the
  -- existing approval RPC writes from auth.uid().
  if v_checker is null and old.approved_by is not null then
    v_checker := old.approved_by;
  end if;

  -- DRAFT -> APPROVED is a designated final approval.
  if upper(coalesce(old.status::text, '')) = 'DRAFT'
     and upper(coalesce(new.status::text, '')) = 'APPROVED' then
    if v_actor is null then
      raise exception 'Authenticated checker identity is required to approve owner settlements.'
        using errcode = '42501';
    end if;
    if v_maker is null then
      raise exception 'Owner settlement maker identity cannot be proven; approval is blocked.'
        using errcode = '42501';
    end if;
    if v_actor = v_maker then
      raise exception 'MAKER_CHECKER_SELF_APPROVAL_DENIED: settlement maker cannot approve the same settlement.'
        using errcode = '42501';
    end if;

    new.maker_user_id := v_maker;
    new.checker_user_id := v_actor;

    -- The lifecycle RPC already sets approved_by = auth.uid(). Enforce parity
    -- at the table boundary so a future caller cannot spoof a different checker.
    if new.approved_by is null or new.approved_by <> v_actor then
      raise exception 'Settlement approved_by must match the authenticated checker.'
        using errcode = '42501';
    end if;
  end if;

  -- APPROVED -> PAID is also financially sensitive. The original maker may not
  -- execute the payout. Existing checker may pay; the required separation here
  -- is maker vs final financial actor, not an invented third-person policy.
  if upper(coalesce(old.status::text, '')) = 'APPROVED'
     and upper(coalesce(new.status::text, '')) = 'PAID' then
    if v_actor is null then
      raise exception 'Authenticated payout actor is required for owner settlements.'
        using errcode = '42501';
    end if;
    if v_maker is null then
      raise exception 'Owner settlement maker identity cannot be proven; payout is blocked.'
        using errcode = '42501';
    end if;
    if v_actor = v_maker then
      raise exception 'MAKER_CHECKER_SELF_PAYMENT_DENIED: settlement maker cannot pay the same settlement.'
        using errcode = '42501';
    end if;
    if v_checker is null then
      raise exception 'Owner settlement checker identity cannot be proven; payout is blocked.'
        using errcode = '42501';
    end if;

    new.maker_user_id := v_maker;
    new.checker_user_id := v_checker;
  end if;

  return new;
end;
$function$;

revoke all on function public.owner_settlement_maker_checker_guard() from public, anon, authenticated;
grant execute on function public.owner_settlement_maker_checker_guard() to service_role;

drop trigger if exists owner_settlement_maker_checker_guard on public.owner_settlements;
create trigger owner_settlement_maker_checker_guard
before insert or update on public.owner_settlements
for each row execute function public.owner_settlement_maker_checker_guard();

comment on function public.owner_settlement_maker_checker_guard() is
  'WP-01 SEC-008 authoritative table-boundary maker-checker guard for owner settlement create, approve and payout transitions.';

comment on column public.owner_settlements.maker_user_id is
  'SEC-008: authenticated creator of the owner settlement; immutable after establishment.';

comment on column public.owner_settlements.checker_user_id is
  'SEC-008: authenticated approver of the owner settlement; immutable after establishment.';

-- ── 2. Receipt VOID identity reservation only ───────────────────────────────
-- This does NOT claim receipt VOID Maker-Checker completion. The complete
-- request/approve/reversal/audit workflow remains a release-blocking GAP-002 item.
alter table public.receipts
  add column if not exists maker_user_id uuid;

comment on column public.receipts.maker_user_id is
  'SEC-008: reserved for the governed receipt VOID maker-checker lifecycle; schema presence alone is not enforcement.';

commit;
