-- Preflight for granular Employee RPC authority rewriting.
--
-- Migration 00050 updates legacy RPC authorization anchors by reconstructing
-- function definitions. Its replacement is intentionally allowed only when a
-- target RPC has exactly one recognized legacy authority anchor; otherwise a
-- broad string replacement could rewrite an unrelated internal role check.
--
-- This migration runs immediately before 00050 on a clean replay and fails
-- closed before any function definition is changed. If an RPC is already on
-- the exact granular permission expected by 00050, it is accepted unchanged.

begin;

do $granular_authority_patch_preflight$
declare
  r record;
  p record;
  v_sql text;
  v_anchor text;
  v_anchor_count integer;
  v_count integer;
  v_anchors text[] := array[
    $$public.current_user_has_effective_app_permission('contracts.write')$$,
    $$public.current_user_has_effective_app_permission('maintenance.write')$$,
    'public.is_admin_or_manager()',
    'public.is_admin()',
    'public.is_app_user()'
  ];
begin
  for r in
    select * from (values
      ('create_contract_atomic','contracts.create'),
      ('create_contract_atomic_v2','contracts.create'),
      ('update_contract_atomic','contracts.edit'),
      ('update_contract_atomic_v2','contracts.edit'),
      ('update_contract_billing_policy_atomic','contracts.edit'),
      ('renew_contract_atomic','contracts.edit'),
      ('submit_contract_for_approval_atomic','contracts.edit'),
      ('approve_contract_atomic','contracts.approve'),
      ('reject_contract_atomic','contracts.approve'),
      ('activate_contract_with_agreement_snapshot_atomic','contracts.approve'),
      ('terminate_contract_atomic','contracts.cancel'),
      ('soft_delete_contract_atomic','contracts.cancel'),
      ('extend_short_stay_contract_atomic','contracts.edit'),
      ('create_maintenance_atomic','maintenance.create'),
      ('close_maintenance_with_expense','maintenance.approve'),
      ('resolve_maintenance_with_expense','maintenance.approve')
    ) as x(function_name,permission)
  loop
    for p in
      select proc.oid
      from pg_proc proc
      join pg_namespace n on n.oid = proc.pronamespace
      where n.nspname = 'public'
        and proc.proname = r.function_name
    loop
      v_sql := pg_get_functiondef(p.oid);

      -- 00050 already skips functions containing the exact target permission.
      if position(r.permission in v_sql) > 0 then
        continue;
      end if;

      v_anchor_count := 0;
      foreach v_anchor in array v_anchors loop
        if length(v_anchor) = 0 then
          continue;
        end if;
        v_count := (
          length(v_sql) - length(replace(v_sql, v_anchor, ''))
        ) / length(v_anchor);
        v_anchor_count := v_anchor_count + v_count;
      end loop;

      if v_anchor_count <> 1 then
        raise exception
          'GRANULAR_AUTHORITY_PREFLIGHT_AMBIGUOUS: % has % recognized authority anchors; expected exactly 1 before migration 00050',
          r.function_name,
          v_anchor_count
          using errcode = '23514';
      end if;
    end loop;
  end loop;
end
$granular_authority_patch_preflight$;

-- The status-aware maintenance transition patch in 00050 has its own legacy
-- anchor set. Apply the same one-anchor rule before it is rewritten.
do $maintenance_transition_patch_preflight$
declare
  p record;
  v_sql text;
  v_anchor text;
  v_anchor_count integer;
  v_count integer;
  v_anchors text[] := array[
    $$public.current_user_has_effective_app_permission('maintenance.write')$$,
    'public.is_app_user()'
  ];
begin
  for p in
    select proc.oid
    from pg_proc proc
    join pg_namespace n on n.oid = proc.pronamespace
    where n.nspname = 'public'
      and proc.proname = 'transition_maintenance_status_atomic'
  loop
    v_sql := pg_get_functiondef(p.oid);
    if position('current_user_can_transition_maintenance' in v_sql) > 0 then
      continue;
    end if;

    v_anchor_count := 0;
    foreach v_anchor in array v_anchors loop
      v_count := (
        length(v_sql) - length(replace(v_sql, v_anchor, ''))
      ) / length(v_anchor);
      v_anchor_count := v_anchor_count + v_count;
    end loop;

    if v_anchor_count <> 1 then
      raise exception
        'GRANULAR_MAINTENANCE_PREFLIGHT_AMBIGUOUS: transition_maintenance_status_atomic has % recognized authority anchors; expected exactly 1 before migration 00050',
        v_anchor_count
        using errcode = '23514';
    end if;
  end loop;
end
$maintenance_transition_patch_preflight$;

commit;
