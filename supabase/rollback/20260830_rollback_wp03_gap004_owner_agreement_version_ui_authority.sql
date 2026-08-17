-- Roll back the GAP-004 atomic owner-agreement creation boundary.
begin;
revoke all on function public.create_future_owner_agreement_version_atomic(uuid,jsonb) from public, anon, authenticated, service_role;
drop function if exists public.create_future_owner_agreement_version_atomic(uuid,jsonb);
grant execute on function public.create_owner_agreement_version_atomic(uuid,jsonb) to authenticated;
revoke all on function public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text) from public, anon, authenticated, service_role;
drop function if exists public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text);
revoke all on function public.create_owner_agreement_with_version_atomic(jsonb) from public, anon, authenticated, service_role;
drop function if exists public.create_owner_agreement_with_version_atomic(jsonb);
commit;
