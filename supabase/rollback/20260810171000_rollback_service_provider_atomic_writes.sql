-- Manual rollback for 20260810171000_service_provider_atomic_writes.sql —
-- not auto-applied; run by hand only during an approved incident response.
-- Direct table writes remain bounded by the RLS policies from the foundation
-- migration if these RPCs must be removed during rollback.
begin;
revoke execute on function public.save_service_provider_atomic(uuid,jsonb,uuid[]) from authenticated;
revoke execute on function public.archive_service_provider_atomic(uuid) from authenticated;
drop function if exists public.save_service_provider_atomic(uuid,jsonb,uuid[]);
drop function if exists public.archive_service_provider_atomic(uuid);
commit;
