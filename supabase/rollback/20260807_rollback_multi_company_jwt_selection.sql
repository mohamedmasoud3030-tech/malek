-- Manual-only rollback for 20260807133000_multi_company_jwt_selection.sql.
-- Restores the previous hook behavior: inject the first membership company and
-- ignore auth.users.raw_user_meta_data.company_id.

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
  user_company uuid;
begin
  select role::text
    into user_role
    from public.users
   where id = (event->>'user_id')::uuid
     and status = 'ACTIVE';

  claims := event -> 'claims';

  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(
    claims,
    '{app_metadata,user_role}',
    to_jsonb(coalesce(user_role, 'USER'))
  );

  select cm.company_id
    into user_company
    from public.company_members cm
   where cm.user_id = (event->>'user_id')::uuid
   order by cm.created_at, cm.id
   limit 1;

  if user_company is not null then
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
$function$;

revoke all on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

commit;
