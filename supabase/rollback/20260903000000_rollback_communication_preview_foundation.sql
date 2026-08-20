-- Manual emergency rollback; not auto-applied.
-- Rollback for 20260903000000_communication_preview_foundation.sql.
-- Does not restore previously sensitive notification copy; generic copy remains safe.

begin;
drop policy if exists automation_notifications_manager_read on public.automation_notifications;
drop policy if exists automation_notifications_manager_update on public.automation_notifications;
create policy app_read_automation_notifications on public.automation_notifications
  for select to authenticated using(public.is_app_user());
create policy manager_write_automation_notifications on public.automation_notifications
  for all to authenticated using(public.is_admin_or_manager()) with check(public.is_admin_or_manager());
grant select,insert,update on public.automation_notifications to authenticated;

drop trigger if exists trg_sanitize_automation_notification_content on public.automation_notifications;
drop function if exists public.sanitize_automation_notification_content();
drop trigger if exists trg_sanitize_app_notification_content on public.app_notifications;
drop function if exists public.sanitize_app_notification_content();
drop function if exists public.prepare_communication_preview_atomic(text,text,uuid,text,uuid,uuid,text,boolean,boolean);
drop function if exists public.set_my_communication_preference_atomic(text,text,boolean,text,integer,integer);
drop function if exists public.communication_template_key(text,text,text);
drop function if exists public.communication_event_requires_human_review(text,text);
drop function if exists public.communication_event_channel_allowed(text,text);
drop table if exists public.communication_delivery_outbox;
drop table if exists public.communication_preferences;
commit;
