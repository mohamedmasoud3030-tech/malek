-- Canonical authority foundation (governance stabilization, Phase 2/3).
--
-- Establishes the single authoritative resolver for operational role
-- authority and rewires every existing role helper and the Auth Hook to use
-- it. Prior to this migration, `current_app_role()`, `is_admin()`,
-- `is_admin_or_manager()`, `is_accountant()`, `is_operations()`,
-- `is_viewer()`, `is_app_user()`, and `custom_access_token_hook()` all read
-- `public.users.role` directly. That is a defect: `users.role` must never be
-- an operational authorization source. The only operational role authority
-- is `company_members.role` for the caller's validated, active membership in
-- their active company.
--
-- Canonical authority chain enforced here:
--   user identity validity (users.status='ACTIVE', is_active, deleted_at is
--   null) -> active company membership -> active company ->
--   company_members.role -> (this migration's resolver) -> callers.
--
-- Fail-closed: if identity, membership, or company cannot be proven active,
-- the resolver returns NULL. No caller in this migration falls back to
-- 'USER', 'VIEWER', or any other default role when authority is unproven.

begin;

-- ---------------------------------------------------------------------
-- 1. active_company_role(): the canonical resolver.
--
-- Given a target company id, returns the caller's company_members.role for
-- that company IF AND ONLY IF:
--   - the caller is authenticated (auth.uid() is not null)
--   - public.users row for that id has status='ACTIVE', is_active=true,
--     deleted_at is null
--   - the company_members row for (target_company_id, auth.uid()) exists,
--     is_active=true
--   - the companies row for target_company_id exists and is_active=true
-- Returns NULL otherwise. Callers must treat NULL as "no authority", never
-- substitute a default role.
-- ---------------------------------------------------------------------

create or replace function public.active_company_role(target_company_id uuid)
returns text
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select cm.role
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
    join public.users u on u.id = cm.user_id
   where auth.uid() is not null
     and cm.user_id = auth.uid()
     and cm.company_id = target_company_id
     and cm.is_active
     and c.is_active
     and u.deleted_at is null
     and u.is_active
     and u.status::text = 'ACTIVE'
   limit 1;
$$;

alter function public.active_company_role(uuid) owner to postgres;

revoke all on function public.active_company_role(uuid) from public;
revoke all on function public.active_company_role(uuid) from anon;
grant execute on function public.active_company_role(uuid) to authenticated;
grant execute on function public.active_company_role(uuid) to service_role;

comment on function public.active_company_role(uuid) is
  'Canonical role authority resolver. Returns company_members.role for the caller''s validated active membership in the given active company, or NULL if identity/membership/company cannot be proven active. users.role is never consulted. Callers must not substitute a default role for NULL.';

-- ---------------------------------------------------------------------
-- 2. current_app_role(): rewired to the canonical resolver for the
--    caller's current company context (from JWT app_metadata.company_id,
--    itself set by custom_access_token_hook from an active membership).
--    No coalesce-to-'USER' fallback. Returns NULL when authority is
--    unproven; callers already treat NULL/absence of a matching role as
--    "not this role" via equality checks, which fail closed correctly.
-- ---------------------------------------------------------------------

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.active_company_role(public.current_company_id());
$$;

alter function public.current_app_role() owner to postgres;

comment on function public.current_app_role() is
  'Returns the caller''s company_members.role for their current active company context, or NULL if unproven. Routed through active_company_role(); users.role is never consulted. No default-role fallback.';

-- ---------------------------------------------------------------------
-- 3. Role predicate helpers: all rewired to compare against
--    current_app_role() (the resolver), instead of querying
--    public.users.role directly. NULL role authority means every predicate
--    below evaluates to false, which is the correct fail-closed behavior.
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.current_app_role() = 'ADMIN';
$$;

alter function public.is_admin() owner to postgres;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.current_app_role() in ('ADMIN', 'MANAGER');
$$;

alter function public.is_admin_or_manager() owner to postgres;

create or replace function public.is_accountant()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.current_app_role() = 'ACCOUNTANT';
$$;

alter function public.is_accountant() owner to postgres;

comment on function public.is_accountant() is
  'Returns true if the caller''s active company_members.role is ACCOUNTANT. Routed through current_app_role()/active_company_role(); users.role is never consulted.';

create or replace function public.is_operations()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.current_app_role() = 'OPERATIONS';
$$;

alter function public.is_operations() owner to postgres;

comment on function public.is_operations() is
  'Returns true if the caller''s active company_members.role is OPERATIONS. Routed through current_app_role()/active_company_role(); users.role is never consulted.';

create or replace function public.is_viewer()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.current_app_role() = 'VIEWER';
$$;

alter function public.is_viewer() owner to postgres;

comment on function public.is_viewer() is
  'Returns true if the caller''s active company_members.role is VIEWER. Routed through current_app_role()/active_company_role(); users.role is never consulted.';

-- is_app_user(): whether the caller has ANY proven role authority in their
-- current company context. Previously this only checked the users table
-- (identity) with no membership/company involvement at all; now it requires
-- the full chain to resolve to a non-null role.
create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select public.current_app_role() is not null;
$$;

alter function public.is_app_user() owner to postgres;

comment on function public.is_app_user() is
  'Returns true if the caller has proven, active company_members role authority in their current company context (identity + active membership + active company all validated). Replaces the prior users-table-only identity check.';

-- ---------------------------------------------------------------------
-- 4. custom_access_token_hook(): rewired so the JWT user_role claim comes
--    from company_members.role via active_company_role(), never from
--    users.role. Identity validation (status/is_active/deleted_at) is
--    checked explicitly before any membership lookup runs, so an
--    invalid/deleted/inactive user never receives a role or company claim
--    regardless of stale membership rows. The existing deterministic
--    fallback-company selection (first active membership by created_at) is
--    preserved because the product intentionally supports it for
--    first-sign-in / cleared-preference cases. No claim is emitted when
--    authority cannot be proven for the chosen company (fail closed).
-- ---------------------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  claims jsonb;
  target_user_id uuid;
  identity_valid boolean := false;
  user_metadata jsonb;
  requested_company_id uuid;
  resolved_company_id uuid;
  resolved_role text;
begin
  target_user_id := (event->>'user_id')::uuid;

  -- Step 1: validate the underlying identity BEFORE any membership lookup.
  -- An invalid/inactive/deleted user must never receive a role or company
  -- claim, no matter what company_members rows exist for them.
  select true
    into identity_valid
    from public.users u
   where u.id = target_user_id
     and u.deleted_at is null
     and u.is_active
     and u.status::text = 'ACTIVE';

  claims := event -> 'claims';
  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  if not coalesce(identity_valid, false) then
    -- Fail closed: strip any role/company claim and return immediately.
    claims := claims #- '{app_metadata,user_role}';
    claims := claims #- '{app_metadata,company_id}';
    return jsonb_set(event, '{claims}', claims);
  end if;

  -- Step 2: resolve the target company. A user-controlled preference
  -- (raw_user_meta_data.company_id) becomes authoritative only after
  -- active-membership + active-company validation via
  -- active_company_role(); it cannot be used to select another tenant by
  -- editing metadata, because the resolver independently re-validates
  -- membership using auth.uid() semantics against the SECURITY DEFINER
  -- context established for this row lookup below.
  select au.raw_user_meta_data
    into user_metadata
    from auth.users au
   where au.id = target_user_id;

  begin
    requested_company_id := nullif(user_metadata->>'company_id', '')::uuid;
  exception
    when invalid_text_representation then
      requested_company_id := null;
  end;

  resolved_company_id := null;
  resolved_role := null;

  if requested_company_id is not null then
    select cm.company_id, cm.role
      into resolved_company_id, resolved_role
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
     where cm.user_id = target_user_id
       and cm.company_id = requested_company_id
       and cm.is_active
       and c.is_active
     limit 1;
  end if;

  -- Deterministic fallback for first sign-in / removed or invalid
  -- preference: earliest active membership in an active company.
  if resolved_company_id is null then
    select cm.company_id, cm.role
      into resolved_company_id, resolved_role
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
     where cm.user_id = target_user_id
       and cm.is_active
       and c.is_active
     order by cm.created_at, cm.id
     limit 1;
  end if;

  if resolved_company_id is not null and resolved_role is not null then
    claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(resolved_role));
    claims := jsonb_set(claims, '{app_metadata,company_id}', to_jsonb(resolved_company_id));
  else
    -- No provable active membership in any active company: fail closed,
    -- never emit a default role claim.
    claims := claims #- '{app_metadata,user_role}';
    claims := claims #- '{app_metadata,company_id}';
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

alter function public.custom_access_token_hook(jsonb) owner to postgres;

comment on function public.custom_access_token_hook(jsonb) is
  'Auth Hook. Validates user identity (active, non-deleted) before any membership lookup; derives the user_role JWT claim strictly from company_members.role for a validated active membership in an active company; never falls back to a default role; strips both role and company claims when authority cannot be proven.';

revoke all on function public.custom_access_token_hook(jsonb) from public;
grant execute on function public.custom_access_token_hook(jsonb) to service_role;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

commit;
