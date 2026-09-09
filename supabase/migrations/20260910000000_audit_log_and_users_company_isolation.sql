-- SEC-003/SEC-004 — close two proven cross-company read leaks on the two
-- tenant tables that carry no company_id column.
--
-- Both were reproduced with real SQL under the `authenticated` role with real
-- JWT claims (see rentrix-app/src/features/auth/company-unscoped-tables-isolation.pglite.test.ts).
-- Neither was caught by any existing gate, because the WP-DB0 isolation gate
-- derives its table list as `tables.filter(t => columns(t).has('company_id'))`.
-- A table with no company_id column is therefore never checked for
-- cross-company reachability at all, which is exactly the blind spot these two
-- tables occupied.
--
-- SEC-003 public.users
--   Policy users_read_self_or_admin = `id = auth.uid() OR is_admin()`.
--   is_admin() proves the caller is an ADMIN *of their own current company*;
--   it says nothing about the row being read. An ADMIN of company A could
--   therefore enumerate every user row in the database, including users who
--   are only members of company B (email, name, role, status, last_login).
--   Fix: the admin branch is fenced to users who are actually members of the
--   caller's active company. Reading your own row is untouched.
--
-- SEC-004 public.audit_log
--   Policy admin_read_audit_log = `is_admin()` with no row fence and no
--   company_id column, so an ADMIN of company A could read the entire audit
--   history of every company: actions, entity ids, notes, old_value/new_value.
--   Fix: add the missing company_id, attribute future writes by default, and
--   fence the read.
--
-- Historical attribution is recovered ONLY from evidence already recorded in
-- the row (details->>'company_id', which the permission-revocation writer has
-- always emitted). Rows carrying no such evidence keep company_id NULL and
-- become invisible to company admins rather than being assigned to a guessed
-- company. Withholding unproven history is the fail-closed choice; inventing
-- an owner for it would be a fabricated audit trail. Nothing is deleted or
-- rewritten -- this is additive attribution over an append-only log.
--
-- Forward-only. No posted financial history is touched. Deployment still
-- requires authorized hosted schema/ACL verification; local replay proves
-- repository behaviour only.

begin;

-- ---------------------------------------------------------------------
-- 1. Co-membership predicate for the caller's ACTIVE company context.
--    Mirrors the existing app_private.can_manage_company_members shape:
--    SECURITY DEFINER, pinned search_path, owner postgres. It reads
--    company_members only -- never public.users -- so it cannot recurse
--    through the policy it is used by.
--    Fails closed: NULL company context or inactive company/membership
--    yields false, never NULL.
-- ---------------------------------------------------------------------

create or replace function public.user_is_member_of_active_company(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    exists (
      select 1
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
      where cm.company_id = public.current_company_id()
        and cm.user_id = target_user_id
        and cm.is_active
        and c.is_active
    ),
    false
  );
$$;

alter function public.user_is_member_of_active_company(uuid) owner to postgres;

revoke all on function public.user_is_member_of_active_company(uuid) from public, anon;
grant execute on function public.user_is_member_of_active_company(uuid) to authenticated, service_role;

comment on function public.user_is_member_of_active_company(uuid) is
  'True when the target user holds an active membership in the caller''s active company. Row-scoping predicate for public.users; fails closed without a proven company context.';

-- ---------------------------------------------------------------------
-- 2. SEC-003 — fence the admin read branch on public.users.
--    Self-read is preserved verbatim, including the (select auth.uid())
--    initplan form introduced by 20260901000063.
-- ---------------------------------------------------------------------

alter policy users_read_self_or_admin on public.users
  using (
    id = (select auth.uid())
    or (public.is_admin() and public.user_is_member_of_active_company(id))
  );

-- ---------------------------------------------------------------------
-- 3. SEC-004 — give audit_log the company_id it never had.
-- ---------------------------------------------------------------------

alter table public.audit_log
  add column if not exists company_id uuid;

do $anchor$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_log_company_id_fkey'
  ) then
    alter table public.audit_log
      add constraint audit_log_company_id_fkey
      foreign key (company_id) references public.companies(id);
  end if;
end
$anchor$;

-- Future writes are attributed from the caller's proven company context.
-- Existing INSERTs all use explicit column lists, so none of the 48 audit
-- writers needs to change.
alter table public.audit_log
  alter column company_id set default public.current_company_id();

create index if not exists audit_log_company_id_created_at_idx
  on public.audit_log (company_id, created_at desc);

comment on column public.audit_log.company_id is
  'Owning company. Defaulted from current_company_id() on write. NULL means attribution was never recorded for that historical row; such rows are deliberately not readable by company admins rather than being attributed by guess.';

-- Recover attribution only where the row already carries the evidence.
do $backfill$
declare
  r record;
  v_company uuid;
begin
  for r in
    select id, details
    from public.audit_log
    where company_id is null
      and details is not null
      and left(btrim(details), 1) = '{'
  loop
    begin
      v_company := nullif(btrim((r.details::jsonb) ->> 'company_id'), '')::uuid;
    exception
      when others then
        v_company := null;
    end;

    if v_company is not null
       and exists (select 1 from public.companies c where c.id = v_company) then
      update public.audit_log set company_id = v_company where id = r.id;
    end if;
  end loop;
end
$backfill$;

-- Fence the read. A NULL company_id yields NULL, not true, so unattributed
-- history stays withheld from every company admin.
alter policy admin_read_audit_log on public.audit_log
  using (public.is_admin() and company_id = public.current_company_id());

-- ---------------------------------------------------------------------
-- 4. Make the audit log physically append-only for browser roles.
--    20260901000001 grants insert/update/delete on audit_log to
--    authenticated. Today no permissive INSERT/UPDATE/DELETE policy exists,
--    so RLS already denies those verbs -- but that safety is implicit and a
--    single future permissive policy would silently unlock history rewriting.
--    RESTRICTIVE deny policies make it explicit and gate-visible. Audit
--    writers run SECURITY DEFINER as postgres and are unaffected.
-- ---------------------------------------------------------------------

drop policy if exists audit_log_no_client_update on public.audit_log;
create policy audit_log_no_client_update on public.audit_log
  as restrictive for update to authenticated, anon
  using (false) with check (false);

drop policy if exists audit_log_no_client_delete on public.audit_log;
create policy audit_log_no_client_delete on public.audit_log
  as restrictive for delete to authenticated, anon
  using (false);

commit;
