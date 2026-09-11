begin;

create or replace function public.mark_app_notification_read(p_notification_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_company uuid;
  v_id text := btrim(coalesce(p_notification_id, ''));
  v_updated integer;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  v_company := public.require_company_id();
  if not coalesce(public.is_app_user(), false) then
    raise exception 'NOTIFICATION_READ_FORBIDDEN' using errcode = '42501';
  end if;

  if v_id = '' or length(v_id) > 200 then
    raise exception 'INVALID_NOTIFICATION_ID' using errcode = '22023';
  end if;

  update public.app_notifications
     set is_read = true
   where id = v_id
     and company_id = v_company
     and recipient_user_id = v_actor
     and deleted_at is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'NOTIFICATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return jsonb_build_object('status', 'updated', 'notification_id', v_id);
end;
$$;

alter function public.mark_app_notification_read(p_notification_id text) owner to postgres;
comment on function public.mark_app_notification_read(p_notification_id text) is
  'Marks the caller''s own app notification as read. Scoped to auth.uid() + JWT company; only is_read may change. Fail-closed for foreign/unknown ids.';
revoke all on function public.mark_app_notification_read(p_notification_id text) from public;
grant execute on function public.mark_app_notification_read(p_notification_id text) to authenticated;
grant execute on function public.mark_app_notification_read(p_notification_id text) to service_role;

commit;