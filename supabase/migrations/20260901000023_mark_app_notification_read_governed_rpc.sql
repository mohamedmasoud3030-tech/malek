-- 20260901000023_mark_app_notification_read_governed_rpc.sql
--
-- Notification read-state: the ACL lockdown (migration 00001) intentionally
-- revoked direct UPDATE on all tables from authenticated, so the frontend's
-- historical `supabase.from('app_notifications').update({ is_read: true })`
-- can no longer persist read state. This migration adds the narrow governed
-- mutation path:
--
--   browser -> mark_app_notification_read(text) -> ONLY the caller's row
--
-- Properties:
--   * caller identity comes from auth.uid() — never from the payload
--   * company context from the JWT claim via require_company_id()
--   * canonical active app identity gate (is_app_user) — inactive/deleted
--     users are denied
--   * the UPDATE is scoped to (id, company_id, recipient_user_id = actor)
--     and only ever touches is_read
--   * zero affected rows raises NOTIFICATION_NOT_FOUND_OR_FORBIDDEN (fail
--     closed — no probing of other users' notifications)
--   * narrow EXECUTE grants: authenticated + service_role only

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

  -- Canonical active identity gate: deleted / inactive / non-ACTIVE users are
  -- denied before any write.
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

  return jsonb_build_object(
    'status', 'updated',
    'notification_id', v_id
  );
end;
$$;

alter function public.mark_app_notification_read(p_notification_id text) owner to postgres;

comment on function public.mark_app_notification_read(p_notification_id text) is
  'Marks the caller''s own app notification as read. Scoped to auth.uid() + JWT company; only is_read may change. Fail-closed for foreign/unknown ids.';

revoke all on function public.mark_app_notification_read(p_notification_id text) from public;
grant execute on function public.mark_app_notification_read(p_notification_id text) to authenticated;
grant execute on function public.mark_app_notification_read(p_notification_id text) to service_role;

commit;
