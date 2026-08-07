-- Multi-company readiness: make the selected company authoritative in the JWT.
--
-- Browser intent is stored in auth.users.raw_user_meta_data.company_id via
-- supabase.auth.updateUser({ data: { company_id } }). That value is NOT trusted
-- by itself. The access-token hook validates it against public.company_members
-- before copying it into app_metadata.company_id. Invalid/stale preferences are
-- ignored and a real membership is selected instead.
--
-- This closes two failure modes:
-- 1) UI selected a company locally while financial RPC/RLS still saw no company.
-- 2) switchCompany updated user_metadata, but the hook ignored that selection.

begin;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  claims jsonb;
  user_role text;
  requested_company_id uuid;
  user_company uuid;
  user_metadata jsonb;
begin
  select u.role::text
    into user_role
    from public.users u
   where u.id = (event->>'user_id')::uuid
     and u.status = 'ACTIVE';

  select au.raw_user_meta_data
    into user_metadata
    from auth.users au
   where au.id = (event->>'user_id')::uuid;

  begin
    requested_company_id := nullif(user_metadata->>'company_id', '')::uuid;
  exception
    when invalid_text_representation then
      requested_company_id := null;
  end;

  -- A user-controlled preference becomes authoritative only after membership
  -- validation. This prevents selecting another tenant by editing metadata.
  if requested_company_id is not null then
    select cm.company_id
      into user_company
      from public.company_members cm
     where cm.user_id = (event->>'user_id')::uuid
       and cm.company_id = requested_company_id
     limit 1;
  end if;

  -- Deterministic fallback for first sign-in / removed preference.
  if user_company is null then
    select cm.company_id
      into user_company
      from public.company_members cm
     where cm.user_id = (event->>'user_id')::uuid
     order by cm.created_at, cm.id
     limit 1;
  end if;

  claims := event -> 'claims';
  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(
    claims,
    '{app_metadata,user_role}',
    to_jsonb(coalesce(user_role, 'USER'))
  );

  if user_company is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata,company_id}',
      to_jsonb(user_company)
    );
  else
    -- Never preserve a stale company claim when the user has no membership.
    claims := claims #- '{app_metadata,company_id}';
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$function$;

revoke all on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

commit;
