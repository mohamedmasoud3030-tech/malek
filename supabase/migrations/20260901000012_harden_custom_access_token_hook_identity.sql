-- Harden the Custom Access Token Hook against disabled or soft-deleted app users.
-- A user-controlled company preference is considered only after the hook verifies
-- a live application identity and an active company membership. This is a
-- forward-safe replacement of the existing hook; no production settings change
-- is performed by this migration.

begin;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  claims jsonb;
  user_role text;
  requested_company_id uuid;
  user_company uuid;
  user_metadata jsonb;
  actor_is_active boolean := false;
begin
  select true, u.role::text
    into actor_is_active, user_role
    from public.users u
   where u.id = (event->>'user_id')::uuid
     and u.status = 'ACTIVE'
     and u.is_active
     and u.deleted_at is null;

  claims := event -> 'claims';
  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- A disabled/deleted application user receives no company claim. The
  -- fallback USER role carries no membership authority and keeps failures
  -- closed until the user is reactivated through an authorized workflow.
  if actor_is_active then
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

    if requested_company_id is not null then
      select cm.company_id
        into user_company
        from public.company_members cm
        join public.companies c on c.id = cm.company_id
       where cm.user_id = (event->>'user_id')::uuid
         and cm.company_id = requested_company_id
         and cm.is_active
         and c.is_active
       limit 1;
    end if;

    if user_company is null then
      select cm.company_id
        into user_company
        from public.company_members cm
        join public.companies c on c.id = cm.company_id
       where cm.user_id = (event->>'user_id')::uuid
         and cm.is_active
         and c.is_active
       order by cm.created_at, cm.id
       limit 1;
    end if;
  end if;

  claims := jsonb_set(
    claims,
    '{app_metadata,user_role}',
    to_jsonb(coalesce(user_role, 'USER'))
  );

  if actor_is_active and user_company is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata,company_id}',
      to_jsonb(user_company)
    );
  else
    claims := claims #- '{app_metadata,company_id}';
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public;
revoke all on function public.custom_access_token_hook(jsonb) from anon;
revoke all on function public.custom_access_token_hook(jsonb) from authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to service_role;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

commit;
