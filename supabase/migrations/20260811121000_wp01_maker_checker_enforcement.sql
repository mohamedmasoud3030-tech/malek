-- WP-01: Narrow Maker-Checker enforcement for designated sensitive actions.
-- Addresses GAP-002 (SEC-008, OPS-007).
--
-- Designated sensitive approvals covered in this migration:
--   1. Owner settlement approval/pay — column additions + CHECK constraint
--
-- Designated sensitive approvals already enforced on main:
--   2. Contract approval/activation (20260808010000)
--   3. Permission request review (20260810113000)
--
-- Explicitly deferred to WP-02:
--   4. Receipt VOID — requires full request→approve lifecycle with mandatory
--      reason, separate approver, reversal-event reference, immutable audit
--      history and audited ADMIN emergency override per OD-02/ADR-0015.
--
-- Design: column additions + CHECK constraint. No function replacement.
-- No trigger-based enforcement (deferred to avoid migration replay issues).
-- No direct journal_entries writes. No accounting-policy changes.
-- Existing RPC signatures, grants, company isolation, idempotency,
-- accounting calls, audit behavior and response contracts are preserved
-- because the RPCs themselves are not modified.

begin;

-- ── 1. Owner settlements: add maker/checker columns ────────────────────────
alter table public.owner_settlements
  add column if not exists maker_user_id uuid,
  add column if not exists checker_user_id uuid;

-- Distinct maker/checker constraint (allows nulls for historical rows).
-- NOT VALID so it does not fail on existing data.
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

-- ── 2. Receipt void: add maker column (PARTIAL — WP-02 dependency) ─────────
-- OD-02/ADR-0015 requires a full VOID lifecycle: request→approve with mandatory
-- reason, separate approver, reversal-batch reference, immutable audit history,
-- and audited ADMIN emergency override.
-- This column prepares the schema; the enforcement lifecycle is documented as
-- PARTIAL until WP-02 implements the complete VOID workflow.
alter table public.receipts
  add column if not exists maker_user_id uuid;

-- ── 3. Comments ─────────────────────────────────────────────────────────────
comment on column public.owner_settlements.maker_user_id
  is 'SEC-008: the user who created the settlement (maker in maker-checker). Set by application layer or future trigger.';

comment on column public.owner_settlements.checker_user_id
  is 'SEC-008: the user who approved the settlement (checker in maker-checker). Set by application layer or future trigger.';

comment on column public.receipts.maker_user_id
  is 'SEC-008: reserved for VOID maker-checker lifecycle. Full request→approve enforcement is deferred to WP-02 per OD-02.';

commit;
