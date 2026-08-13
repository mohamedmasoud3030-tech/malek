-- ============================================================================
-- WP-DB0 — Database Stabilization & Contract Freeze
-- Consolidated corrective migration (forward-safe, idempotent, re-runnable)
-- ============================================================================
--
-- WP-DB0 replaces the "one migration per error" pattern. Every correction here
-- was derived from a full replay of the migration chain into a clean
-- PostgreSQL, introspection of the resulting schema, and a four-layer contract
-- diff (migrations <-> schema <-> generated types <-> frontend usage) produced
-- by `pnpm db0:audit`.
--
-- This migration fixes ROOT CAUSES only. It does not add features, does not
-- reset the database, and does not delete demo data. Every statement is
-- guarded so that a replay, a re-run, and an apply against the existing live
-- project all converge on the same end state.
--
-- Corrections, each traced to an audit finding:
--
--   C1  DB0-06E  `user_role` enum cannot represent the six canonical WP-01
--                roles. OPERATIONS and VIEWER were unstorable, so six-role
--                authorization was physically impossible.
--   C2  DB0-08   `cost_centers` is company-scoped but its RLS policies never
--                reference company_id — a cross-company read/write leak.
--   C3  DB0-08   `document_reference_sequences` has RLS enabled and zero
--                policies, and no FK to companies.
--   C4  DB0-09C  `maintenance_records.service_provider_category_id` is only
--                reachable through a composite FK, which PostgREST cannot use
--                as an embed hint; the frontend masked this with `as any`.
--   C5  DB0-XX   `vw_active_owner_agreements` is missing `security_invoker`,
--                so it reads with the definer's privileges and bypasses RLS.
--
-- Deliberately NOT changed here (documented in
-- docs/database/WP_DB0_CONTRACT_FREEZE.md):
--   * Financial precision (47 numeric(_,2) columns vs the 3dp canonical rule).
--     That is GAP-009 and is owned by WP-02: it needs an accounting-approved
--     data conversion plan, not a silent type widening inside a freeze.
--   * `contracts.status` dual casing ('active' + 'ACTIVE', 'expired' +
--     'ENDED'). Narrowing the CHECK would reject existing live rows; the
--     normalisation is a data migration that must run with owner approval.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- C1. Make the six canonical WP-01 roles physically representable.
--
-- `20260811120000_wp01_six_role_authorization_foundation.sql` added a CHECK
-- constraint listing six roles, but `users.role` is the `user_role` ENUM, which
-- only ever had four labels. A CHECK constraint cannot widen an enum, so
-- OPERATIONS and VIEWER could never be stored:
--
--     insert ... role = 'OPERATIONS'
--     ERROR: invalid input value for enum user_role: "OPERATIONS"
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- PostgreSQL, and IF NOT EXISTS makes it idempotent, so each label is added
-- individually and defensively.
-- ---------------------------------------------------------------------------
do $$
declare
  v_label text;
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role' and n.nspname = 'public' and t.typtype = 'e'
  ) then
    foreach v_label in array array['ACCOUNTANT', 'OPERATIONS', 'VIEWER'] loop
      if not exists (
        select 1
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'user_role'
          and n.nspname = 'public'
          and e.enumlabel = v_label
      ) then
        execute format('alter type public.user_role add value %L', v_label);
      end if;
    end loop;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- C2. Company-scope the cost_centers RLS policies.
--
-- `cost_centers.company_id` exists and has an FK to companies, but both
-- policies authorised on role alone (`is_admin_or_manager()` / `is_app_user()`)
-- without any company predicate. Any authenticated user of company A could
-- read and, as a manager, mutate company B's cost centres.
--
-- The replacement policies keep the existing role model and add the company
-- predicate that every other tenant table already uses.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.cost_centers') is null then
    return;
  end if;

  -- Backfill/lock the tenant column so the policy predicate is meaningful.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cost_centers'
      and column_name = 'company_id' and is_nullable = 'YES'
  ) and not exists (select 1 from public.cost_centers where company_id is null) then
    alter table public.cost_centers alter column company_id set not null;
  end if;

  drop policy if exists "Admins and managers can manage cost centers" on public.cost_centers;
  drop policy if exists "Users can view cost centers" on public.cost_centers;
  drop policy if exists cost_centers_company_select on public.cost_centers;
  drop policy if exists cost_centers_company_manage on public.cost_centers;

  create policy cost_centers_company_select
    on public.cost_centers
    for select
    using (
      public.is_app_user()
      and company_id = public.current_company_id()
    );

  create policy cost_centers_company_manage
    on public.cost_centers
    for all
    using (
      public.is_admin_or_manager()
      and company_id = public.current_company_id()
    )
    with check (
      public.is_admin_or_manager()
      and company_id = public.current_company_id()
    );
end
$$;

-- ---------------------------------------------------------------------------
-- C3. document_reference_sequences: add the missing tenant FK and make the
--     fail-closed intent explicit.
--
-- The table has RLS enabled and zero policies. That was intentional (only the
-- SECURITY DEFINER `next_document_reference` writes to it), but "no policy"
-- and "deliberately deny-all" are indistinguishable to an auditor and to the
-- drift gate. An explicit deny-all policy encodes the intent, and the FK stops
-- counters being created for a company that does not exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.document_reference_sequences') is null then
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.document_reference_sequences'::regclass
      and conname = 'document_reference_sequences_company_id_fkey'
  ) and not exists (
    select 1 from public.document_reference_sequences s
    left join public.companies c on c.id = s.company_id
    where c.id is null
  ) then
    alter table public.document_reference_sequences
      add constraint document_reference_sequences_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete restrict;
  end if;

  -- Explicit deny-all for every client role. SECURITY DEFINER functions owned
  -- by the table owner continue to bypass RLS and remain the only writer.
  drop policy if exists document_reference_sequences_no_client_access
    on public.document_reference_sequences;

  create policy document_reference_sequences_no_client_access
    on public.document_reference_sequences
    for all
    to authenticated, anon
    using (false)
    with check (false);

  -- Guarded with the rest of the block: a partial replay that never created
  -- this table must not fail on the REVOKE.
  execute 'revoke all on table public.document_reference_sequences from anon, authenticated';
end
$$;

-- ---------------------------------------------------------------------------
-- C4. Give maintenance_records.service_provider_category_id a single-column
--     FK so PostgREST can resolve the embed.
--
-- The only FK carrying this column is composite
-- `(service_provider_category_id, company_id) -> service_provider_categories`.
-- PostgREST cannot use a column name as an embed hint for a composite
-- relationship, so `category:service_provider_category_id(id,name)` was not
-- resolvable and the call site suppressed the error with `as any`.
--
-- The composite FK is KEPT: it is the constraint that makes a cross-company
-- category assignment unrepresentable. The added single-column FK is purely
-- the relationship PostgREST can name, and is strictly weaker, so it cannot
-- loosen the existing isolation guarantee.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.maintenance_records') is null
     or to_regclass('public.service_provider_categories') is null then
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.maintenance_records'::regclass
      and conname = 'maintenance_records_service_provider_category_id_fkey'
  ) and not exists (
    select 1
    from public.maintenance_records m
    left join public.service_provider_categories c
      on c.id = m.service_provider_category_id
    where m.service_provider_category_id is not null and c.id is null
  ) then
    alter table public.maintenance_records
      add constraint maintenance_records_service_provider_category_id_fkey
      foreign key (service_provider_category_id)
      references public.service_provider_categories(id)
      on delete restrict;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- C5. vw_active_owner_agreements must run with invoker privileges.
--
-- Every other view in `public` sets security_invoker = true. This one does
-- not, so it evaluates with the view owner's rights and returns rows the
-- caller's RLS policies would otherwise filter out.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.vw_active_owner_agreements') is not null then
    execute 'alter view public.vw_active_owner_agreements set (security_invoker = true)';
  end if;
end
$$;

commit;
