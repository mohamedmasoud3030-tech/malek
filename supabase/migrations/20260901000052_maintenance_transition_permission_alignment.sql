-- Align maintenance lifecycle transitions with the granular Employee action
-- model introduced in 00050. Starting/progressing work is an edit; declaring
-- the work resolved or closing it is an approval action; cancellation remains
-- independently delegated.

begin;

create or replace function public.current_user_can_transition_maintenance(p_next_status text)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select case lower(btrim(coalesce(p_next_status,'')))
    when 'cancelled' then public.current_user_has_effective_app_permission('maintenance.cancel')
    when 'resolved' then public.current_user_has_effective_app_permission('maintenance.approve')
    when 'closed' then public.current_user_has_effective_app_permission('maintenance.approve')
    else public.current_user_has_effective_app_permission('maintenance.edit')
  end;
$function$;

revoke all on function public.current_user_can_transition_maintenance(text) from public, anon;
grant execute on function public.current_user_can_transition_maintenance(text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
