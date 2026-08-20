-- Manual emergency rollback; not auto-applied.
-- Rollback for 20260902000000_self_service_support_requests.sql.
-- This deletes support workflow records; export authorized evidence before use.

begin;
drop function if exists public.update_support_request_status_atomic(uuid,text,text);
drop function if exists public.list_my_support_requests();
drop function if exists public.create_support_request_atomic(text,text,text,text,text,text,text);
drop function if exists public.support_text_is_safe(text);
drop table if exists public.support_request_events;
drop table if exists public.support_requests;
commit;
