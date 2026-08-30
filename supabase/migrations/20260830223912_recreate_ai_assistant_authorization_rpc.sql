begin;

drop function if exists public.authorize_ai_assistant_access();

create function public.authorize_ai_assistant_access()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_company uuid := public.require_company_id();
begin
  if v_user is null
     or not coalesce(public.is_app_user(), false)
     or not coalesce(public.is_company_member(v_company, v_user), false)
     or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'AI_ASSISTANT_ACCESS_DENIED' using errcode = '42501';
  end if;

  return jsonb_build_object('allowed', true);
end;
$function$;

alter function public.authorize_ai_assistant_access() owner to postgres;
revoke all on function public.authorize_ai_assistant_access() from public, anon;
grant execute on function public.authorize_ai_assistant_access() to authenticated, service_role;
comment on function public.authorize_ai_assistant_access()
is 'Fail-closed active-company AI Assistant authorization. Recreated to restore PostgREST RPC discovery; authorization semantics unchanged.';

commit;
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
