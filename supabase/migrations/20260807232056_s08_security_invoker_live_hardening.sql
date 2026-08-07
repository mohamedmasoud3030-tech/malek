-- Live hardening parity: ensure every S08 read-only view that exists in the
-- target database executes with caller privileges so underlying RLS/company
-- isolation remains authoritative. Some historical Live-only S08 views are not
-- present in a fresh repository replay, so harden them conditionally rather
-- than inventing or recreating business objects here.
begin;

do $block$
declare
  v_view text;
begin
  foreach v_view in array array[
    's08_analysis_scope',
    's08_liability_balances_by_period',
    's08_master_lease_readiness',
    's08_subledger_gl_reconciliation',
    's08_legacy_gl_context'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_view
        and c.relkind = 'v'
    ) then
      execute format('alter view public.%I set (security_invoker = true)', v_view);
    end if;
  end loop;
end
$block$;

commit;
