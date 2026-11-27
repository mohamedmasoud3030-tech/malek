-- Employee invites (first-trial readiness).
--
-- An office ADMIN (effective users.manage authority in the active company)
-- creates a single-use, expiring invite link for one of the five non-ADMIN
-- canonical roles. The raw token is returned to the creator exactly once;
-- only its SHA-256 hash is stored. The invitee either
--   a) already has an account: signs in and calls accept_employee_invite, or
--   b) is new: the employee-invite-accept Edge Function creates the Auth
--      account with the service role and applies the same governed
--      acceptance through app_private.apply_employee_invite_acceptance.
--
-- No invitation e-mail is sent: Supabase Auth e-mail on the free plan is
-- rate-limited, so the product surfaces a copyable link the office owner
-- passes to the employee through any channel they choose.
--
-- Authority notes (SEC-004/SEC-005): creation and revocation resolve through
-- app_private.can_manage_company_members, which requires active-company
-- context plus effective users.manage permission. Role labels on
-- public.users are never read for authorization. Acceptance binds the
-- invite's e-mail to the accepting account, is idempotent on replay by the
-- same account, and reactivates an existing membership without demoting it.

begin;

create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  email text not null,
  role text not null default 'USER',
  note text check (note is null or char_length(btrim(note)) between 1 and 200),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  constraint employee_invites_company_idempotency_key unique (company_id, idempotency_key),
  constraint employee_invites_role_check check (role = any (array['MANAGER'::text, 'ACCOUNTANT'::text, 'OPERATIONS'::text, 'USER'::text, 'VIEWER'::text])),
  constraint employee_invites_email_format check (position('@' in email) > 1),
  constraint employee_invites_expiry check (expires_at > created_at),
  constraint employee_invites_acceptance check (accepted_at is null or accepted_by is not null)
);

comment on table public.employee_invites is
  'Single-use, expiring employee invite links. Only the SHA-256 hash of the token is stored.';

alter table public.employee_invites enable row level security;

-- Members may read their own company's invites (status list in Settings).
-- All writes stay behind the SECURITY DEFINER commands below; no direct
-- insert/update/delete policy exists.
create policy employee_invites_member_read on public.employee_invites
  for select to authenticated
  using (public.is_app_user() and company_id = public.current_company_id());

-- Read projection without the token hash or the command idempotency key.
create or replace view public.employee_invites_read with (security_invoker=on) as
select
  id,
  company_id,
  email,
  role,
  note,
  invited_by,
  created_at,
  expires_at,
  accepted_by,
  accepted_at,
  revoked_at,
  case
    when revoked_at is not null then 'REVOKED'
    when accepted_at is not null then 'ACCEPTED'
    when expires_at <= now() then 'EXPIRED'
    else 'PENDING'
  end as status
from public.employee_invites;

-- Shared acceptance machinery. Private: no client grant. Both the public
-- accept RPC (existing account) and the employee-invite-accept Edge Function
-- (new account, service role) funnel through it so the invariants live once:
--   * the invite closes exactly once (single-use under concurrency);
--   * the invitee never ends up member of two companies;
--   * an existing same-company membership is reactivated, never demoted;
--   * a public.users identity row is created when missing.
create or replace function app_private.apply_employee_invite_acceptance(
  p_invite_id uuid,
  p_user_id uuid,
  p_full_name text default null
) returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_inv record;
  v_email text;
  v_name text;
  v_existing_role text;
begin
  select * into v_inv
  from public.employee_invites
  where id = p_invite_id
  for update;
  if not found then
    raise exception 'EMPLOYEE_INVITE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'EMPLOYEE_INVITE_REVOKED' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'EMPLOYEE_INVITE_EXPIRED' using errcode = 'P0001';
  end if;
  if v_inv.accepted_at is not null then
    -- A retry by the same invitee is an idempotent replay, not reuse.
    if v_inv.accepted_by = p_user_id then
      return v_inv.company_id;
    end if;
    raise exception 'EMPLOYEE_INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'EMPLOYEE_INVITE_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- One user, one company (same boundary as create_company_for_existing_user).
  if exists (
    select 1 from public.company_members cm
    where cm.user_id = p_user_id and cm.company_id <> v_inv.company_id and cm.is_active
  ) then
    raise exception 'EMPLOYEE_INVITE_USER_ASSIGNED_ELSEWHERE' using errcode = 'P0001';
  end if;

  -- Identity row: create only when missing. An existing row is never
  -- rewritten; users.role stays identity metadata, not authorization.
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    if exists (select 1 from public.users u where lower(u.email) = lower(v_email)) then
      raise exception 'EMPLOYEE_INVITE_EMAIL_CONFLICT' using errcode = 'P0001';
    end if;
    v_name := nullif(btrim(coalesce(p_full_name, '')), '');
    if v_name is null then
      v_name := split_part(v_email, '@', 1);
    end if;
    insert into public.users (id, email, name, role, status, is_active)
    values (p_user_id, lower(v_email), v_name, v_inv.role::public.user_role, 'ACTIVE', true);
  end if;

  -- Membership: reactivate but never demote an existing one.
  select cm.role into v_existing_role
  from public.company_members cm
  where cm.company_id = v_inv.company_id and cm.user_id = p_user_id;
  if not found then
    insert into public.company_members (company_id, user_id, role, is_active)
    values (v_inv.company_id, p_user_id, v_inv.role, true);
  else
    update public.company_members
    set is_active = true, updated_at = now()
    where company_id = v_inv.company_id and user_id = p_user_id and not is_active;
  end if;

  update public.employee_invites
  set accepted_by = p_user_id, accepted_at = now()
  where id = v_inv.id and accepted_at is null;
  if not found then
    raise exception 'EMPLOYEE_INVITE_ALREADY_USED' using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, p_user_id,
    v_email,
    'ACCEPT', 'employee_invites', v_inv.id::text,
    'Employee invite accepted; membership activated',
    'employee_invites', jsonb_build_object('company_id', v_inv.company_id, 'role', v_inv.role)::text, now()
  );

  return v_inv.company_id;
end;
$$;

create or replace function public.create_employee_invite(
  p_email text,
  p_role text,
  p_note text,
  p_idempotency_key text
) returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_company uuid;
  v_email text;
  v_existing record;
  v_invite_id uuid := gen_random_uuid();
  v_token text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  v_company := public.require_company_id();
  if not app_private.can_manage_company_members(v_company) then
    raise exception 'EMPLOYEE_INVITE_FORBIDDEN' using errcode = '42501';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if position('@' in v_email) <= 1 then
    raise exception 'EMPLOYEE_INVITE_EMAIL_INVALID' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER') then
    raise exception 'EMPLOYEE_INVITE_ROLE_INVALID' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) not between 1 and 200 then
    raise exception 'EMPLOYEE_INVITE_NOTE_INVALID' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) not between 8 and 120 then
    raise exception 'EMPLOYEE_INVITE_IDEMPOTENCY_KEY_INVALID' using errcode = '22023';
  end if;

  -- Already an active member of this company? An invite would be meaningless.
  if exists (
    select 1
    from public.company_members cm
    join public.users u on u.id = cm.user_id
    where cm.company_id = v_company and cm.is_active and lower(u.email) = v_email
  ) then
    raise exception 'EMPLOYEE_INVITE_ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_company::text || ':employee-invite:' || btrim(p_idempotency_key), 0));

  select * into v_existing
  from public.employee_invites
  where company_id = v_company and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.email = v_email
       and v_existing.role = p_role
       and v_existing.note is not distinct from nullif(btrim(coalesce(p_note, '')), '') then
      -- Exact replay of a confirmed command. The raw token was returned once
      -- and is deliberately not recoverable; an empty return tells the caller
      -- the invite already exists without minting a second one.
      return '';
    end if;
    raise exception 'EMPLOYEE_INVITE_IDEMPOTENCY_MISMATCH' using errcode = 'P0001';
  end if;

  -- 244 bits of entropy from two v4 UUIDs, hex without dashes (64 chars).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.employee_invites (
    id, company_id, email, role, note, token_hash, invited_by, expires_at, idempotency_key
  ) values (
    v_invite_id, v_company, v_email, p_role,
    nullif(btrim(coalesce(p_note, '')), ''),
    encode(digest(v_token, 'sha256'), 'hex'),
    v_actor, now() + interval '7 days', btrim(p_idempotency_key)
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, v_actor,
    (select email from auth.users where id = v_actor),
    'INVITE', 'employee_invites', v_invite_id::text,
    'Employee invite created',
    'employee_invites', jsonb_build_object('company_id', v_company, 'email', v_email, 'role', p_role)::text, now()
  );

  return v_token;
end;
$$;

-- Token-holder preview. Possession of the 244-bit token is the capability;
-- returns only what the accept screen shows (no hash, no command key).
-- Callable by anon because a brand-new employee has no session yet.
create or replace function public.preview_employee_invite(
  p_token text
) returns table(company_name text, email text, role text, invite_status text)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_inv record;
begin
  if p_token is null or char_length(btrim(p_token)) <> 64 then
    return;
  end if;
  select i.id, i.email, i.role, i.revoked_at, i.accepted_at, i.expires_at, c.name as company_name
  into v_inv
  from public.employee_invites i
  join public.companies c on c.id = i.company_id
  where i.token_hash = encode(digest(btrim(p_token), 'sha256'), 'hex');
  if not found then
    return;
  end if;
  return query
  select v_inv.company_name, v_inv.email, v_inv.role,
    case
      when v_inv.revoked_at is not null then 'REVOKED'
      when v_inv.accepted_at is not null then 'ACCEPTED'
      when v_inv.expires_at <= now() then 'EXPIRED'
      else 'PENDING'
    end;
end;
$$;

create or replace function public.accept_employee_invite(
  p_token text
) returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_inv record;
  v_actor_email text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_token is null or char_length(btrim(p_token)) <> 64 then
    raise exception 'EMPLOYEE_INVITE_TOKEN_INVALID' using errcode = '22023';
  end if;
  select id, company_id, email into v_inv
  from public.employee_invites
  where token_hash = encode(digest(btrim(p_token), 'sha256'), 'hex');
  if not found then
    raise exception 'EMPLOYEE_INVITE_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- The invite is personal: only the account holding the invited e-mail may
  -- accept it.
  select email into v_actor_email from auth.users where id = v_actor;
  if v_actor_email is null or lower(v_actor_email) <> v_inv.email then
    raise exception 'EMPLOYEE_INVITE_EMAIL_MISMATCH' using errcode = '42501';
  end if;
  return app_private.apply_employee_invite_acceptance(v_inv.id, v_actor, null);
end;
$$;

create or replace function public.revoke_employee_invite(
  p_invite_id uuid
) returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_company uuid;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  v_company := public.require_company_id();
  if not app_private.can_manage_company_members(v_company) then
    raise exception 'EMPLOYEE_INVITE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.employee_invites
  set revoked_at = now()
  where id = p_invite_id
    and company_id = v_company
    and accepted_at is null
    and revoked_at is null;
  if not found then
    raise exception 'EMPLOYEE_INVITE_NOT_FOUND_OR_CLOSED' using errcode = 'P0002';
  end if;
  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, v_actor,
    (select email from auth.users where id = v_actor),
    'REVOKE', 'employee_invites', p_invite_id::text,
    'Employee invite revoked',
    'employee_invites', jsonb_build_object('company_id', v_company)::text, now()
  );
end;
$$;

-- Service-only surface for the employee-invite-accept Edge Function: a new
-- employee has no session, so account creation runs with the service role.
-- Both functions stay closed to anon/authenticated clients.
create or replace function public.lookup_employee_invite_for_signup(
  p_token text
) returns table(invite_id uuid, company_id uuid, email text, role text, invite_status text)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if p_token is null or char_length(btrim(p_token)) <> 64 then
    return;
  end if;
  return query
  select i.id, i.company_id, i.email, i.role,
    case
      when i.revoked_at is not null then 'REVOKED'
      when i.accepted_at is not null then 'ACCEPTED'
      when i.expires_at <= now() then 'EXPIRED'
      else 'PENDING'
    end
  from public.employee_invites i
  where i.token_hash = encode(digest(btrim(p_token), 'sha256'), 'hex');
end;
$$;

create or replace function public.finalize_employee_invite_signup(
  p_token text,
  p_user_id uuid,
  p_full_name text default null
) returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_inv record;
  v_email text;
begin
  if p_token is null or char_length(btrim(p_token)) <> 64 then
    raise exception 'EMPLOYEE_INVITE_TOKEN_INVALID' using errcode = '22023';
  end if;
  if p_user_id is null then
    raise exception 'EMPLOYEE_INVITE_USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  select i.id, i.email into v_inv
  from public.employee_invites i
  where i.token_hash = encode(digest(btrim(p_token), 'sha256'), 'hex');
  if not found then
    raise exception 'EMPLOYEE_INVITE_NOT_FOUND' using errcode = 'P0002';
  end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'EMPLOYEE_INVITE_USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if lower(v_email) <> v_inv.email then
    raise exception 'EMPLOYEE_INVITE_EMAIL_MISMATCH' using errcode = '42501';
  end if;
  return app_private.apply_employee_invite_acceptance(v_inv.id, p_user_id, p_full_name);
end;
$$;

-- Table and view privileges: reads only, writes exclusively via the RPCs.
revoke all on public.employee_invites from anon, authenticated;
grant select on public.employee_invites to authenticated;
grant select on public.employee_invites_read to authenticated;

revoke all on function app_private.apply_employee_invite_acceptance(uuid, uuid, text) from public, anon, authenticated;
grant execute on function app_private.apply_employee_invite_acceptance(uuid, uuid, text) to service_role;

revoke all on function public.create_employee_invite(text, text, text, text) from public, anon;
revoke all on function public.preview_employee_invite(text) from public;
revoke all on function public.accept_employee_invite(text) from public, anon;
revoke all on function public.revoke_employee_invite(uuid) from public, anon;
grant execute on function public.create_employee_invite(text, text, text, text) to authenticated;
grant execute on function public.preview_employee_invite(text) to anon, authenticated;
grant execute on function public.accept_employee_invite(text) to authenticated;
grant execute on function public.revoke_employee_invite(uuid) to authenticated;
revoke all on function public.lookup_employee_invite_for_signup(text) from public, anon, authenticated;
revoke all on function public.finalize_employee_invite_signup(text, uuid, text) from public, anon, authenticated;
grant execute on function public.lookup_employee_invite_for_signup(text) to service_role;
grant execute on function public.finalize_employee_invite_signup(text, uuid, text) to service_role;

-- Hosted Supabase installs pgcrypto in the `extensions` schema while a plain
-- PostgreSQL replay may install it in `public`. Qualify the digest calls in
-- the functions created above so the locked search_path stays portable
-- across both layouts.
do $employee_invites_pgcrypto_compat$
declare
  v_pgcrypto_schema text;
  v_definition text;
  v_rewritten text;
  r record;
begin
  select n.nspname into v_pgcrypto_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if v_pgcrypto_schema is null then
    raise exception 'pgcrypto extension is required';
  end if;
  for r in
    select p.oid, p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.proname in ('create_employee_invite', 'preview_employee_invite', 'accept_employee_invite',
                        'lookup_employee_invite_for_signup', 'finalize_employee_invite_signup')
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '(^|[^[:alnum:]_.])digest[[:space:]]*\('
    order by p.oid::regprocedure::text
  loop
    v_definition := pg_get_functiondef(r.oid);
    v_rewritten := regexp_replace(
      v_definition,
      '(^|[^[:alnum:]_.])digest[[:space:]]*\(',
      E'\\1' || quote_ident(v_pgcrypto_schema) || '.digest(',
      'g'
    );
    if v_rewritten = v_definition then
      raise exception 'failed to qualify pgcrypto digest in %', r.signature;
    end if;
    execute v_rewritten;
  end loop;
end
$employee_invites_pgcrypto_compat$;

commit;
