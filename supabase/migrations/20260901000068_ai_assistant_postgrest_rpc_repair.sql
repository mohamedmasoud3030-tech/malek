-- AI Assistant control-plane repair.
--
-- Production diagnostics showed PostgREST returning 404 for
-- public.authorize_ai_assistant_access() while the function exists, is executable
-- by authenticated users, and succeeds under the same authenticated/company JWT
-- context. Reassert the intended RPC ACLs, touch function metadata, and force a
-- PostgREST schema-cache refresh without changing authorization, quota, budget,
-- accounting, RLS, or company-membership semantics.

begin;

revoke all on function public.authorize_ai_assistant_access() from public, anon;
grant execute on function public.authorize_ai_assistant_access() to authenticated, service_role;

revoke all on function public.consume_ai_assistant_quota_atomic(integer, integer) from public, anon;
grant execute on function public.consume_ai_assistant_quota_atomic(integer, integer) to authenticated, service_role;

revoke all on function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint) from public, anon;
grant execute on function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint) to authenticated, service_role;

comment on function public.authorize_ai_assistant_access()
is 'Fail-closed active-company AI Assistant authorization. Exposed to authenticated/service_role through PostgREST; authorization remains enforced inside the SECURITY DEFINER function.';

comment on function public.consume_ai_assistant_quota_atomic(integer, integer)
is 'AI Assistant authoritative per-user/company rate-limit control RPC. ACL reasserted for PostgREST schema discovery.';

comment on function public.reserve_ai_assistant_budget_atomic(uuid, bigint, integer, bigint)
is 'AI Assistant atomic provider-budget reservation RPC. ACL reasserted for PostgREST schema discovery.';

commit;

-- Supabase/PostgREST troubleshooting guidance for stale function signatures:
-- touch the notification queue, then force a schema cache reload.
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
