-- A live-only hotfix published the commission mutation RPCs with a composite
-- `commissions` return type. PostgreSQL cannot change a function return type
-- through CREATE OR REPLACE, while the canonical RPC contract is jsonb.
-- Drop only the legacy signatures; the canonical migration recreates them in
-- the same deployment sequence. Canonical databases are a no-op.

do $reconcile$
declare
  v_has_legacy boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_commission_atomic',
        'update_commission_atomic',
        'cancel_commission_atomic'
      )
      and pg_get_function_identity_arguments(p.oid) = 'p_payload jsonb'
      and pg_get_function_result(p.oid) <> 'jsonb'
  ) into v_has_legacy;

  if not v_has_legacy then
    return;
  end if;

  drop function if exists public.create_commission_atomic(jsonb);
  drop function if exists public.update_commission_atomic(jsonb);
  drop function if exists public.cancel_commission_atomic(jsonb);
end;
$reconcile$;
