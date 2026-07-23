-- ============================================================================
-- PHASE 5 of 5a — current_company_id() + JWT Hook update
-- ============================================================================
--
-- ⚠️ يتطلب: Phase 4 مكتمل بنجاح
--
-- هذا الـmigration:
--   1. ينشئ دالة current_company_id()
--   2. يحدث custom_access_token_hook لحقن company_id في JWT
--
-- لا يلمس RLS policies بعد — ده في ملفات منفصلة.
--
-- ============================================================================

begin;

-- ── 5a. دالة current_company_id() ───────────────────────────────────────

create or replace function public.current_company_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
$$;

revoke all on function public.current_company_id() from public, anon, authenticated;
grant execute on function public.current_company_id() to authenticated;

-- ── 5b. تحديث custom_access_token_hook ──────────────────────────────────

create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable security definer
  set search_path to 'public'
as $function$
declare
  claims    jsonb;
  user_role text;
  user_company uuid;
begin
  -- الدور من public.users (كما كان)
  select role::text
    into user_role
    from public.users
   where id = (event->>'user_id')::uuid
     and status = 'ACTIVE';

  claims := event -> 'claims';

  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  -- حقن user_role
  claims := jsonb_set(
    claims, '{app_metadata, user_role}',
    to_jsonb(coalesce(user_role, 'USER'))
  );

  -- حقن company_id: أول شركة نشطة للمستخدم
  select cm.company_id
    into user_company
    from public.company_members cm
   where cm.user_id = (event->>'user_id')::uuid
   order by cm.created_at, cm.id
   limit 1;

  if user_company is not null then
    claims := jsonb_set(
      claims, '{app_metadata, company_id}',
      to_jsonb(user_company)
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$function$;

<<<<<<<< HEAD:supabase/migrations/20260722050000_phase5_function_and_hook.sql
-- SECURITY DEFINER functions must never inherit PostgreSQL's default PUBLIC
-- execute grant. Explicit grants created by earlier migrations (for example to
-- authenticated) are preserved; browser-anonymous execution is removed.
do $revoke$
declare
  target_function regprocedure;
begin
  for target_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      target_function
    );
  end loop;
end;
$revoke$;

-- Auth invokes this hook only through its dedicated database role.
revoke all on function public.custom_access_token_hook(jsonb)
  from authenticated;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
========
-- CREATE OR REPLACE does not preserve prior GRANT/REVOKE state, so the
-- original least-privilege contract (only the Auth service may invoke this
-- hook) must be reasserted here, same as in 20250101000003_functions_triggers_and_rpcs.sql.
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
>>>>>>>> origin/fix/phase2-backfill-foreach-syntax:supabase/migrations/20260722000007_phase5_function_and_hook.sql

commit;
