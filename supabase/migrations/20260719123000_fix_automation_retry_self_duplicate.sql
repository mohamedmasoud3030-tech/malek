-- Fix retry_automation_run so the failed source row does not block its own retry.
--
-- The previous implementation changed the source run to `running` before calling
-- execute_automation_rule(). The duplicate-execution guard then found that same
-- row and returned `skipped`, leaving the source run stuck in `running` without
-- executing the rule.

begin;

create or replace function public.retry_automation_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_run record;
  v_result jsonb;
  v_retry_count integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required' using errcode='42501';
  end if;

  select *
    into v_run
  from public.automation_runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'Run not found';
  end if;

  if v_run.status <> 'failed' then
    raise exception 'Only failed runs can be retried';
  end if;

  if v_run.rule_id is null then
    raise exception 'Failed run is not linked to an automation rule';
  end if;

  if v_run.retry_count >= 3 then
    raise exception 'Max retries (3) exceeded';
  end if;

  -- Serialize admission with manual execution. The same transaction may acquire
  -- this advisory lock again inside execute_automation_rule().
  perform pg_advisory_xact_lock(
    hashtextextended('automation_rule:' || v_run.rule_id, 0)
  );

  -- A genuine active execution should prevent a retry without consuming one of
  -- the three attempts. The failed source row remains historical and therefore
  -- can never satisfy this predicate.
  if exists (
    select 1
    from public.automation_runs
    where rule_id = v_run.rule_id
      and status = 'running'
      and started_at > extract(epoch from (now() - interval '5 minutes')) * 1000
  ) then
    return jsonb_build_object(
      'success', false,
      'skipped', true,
      'reason', 'duplicate running execution prevented',
      'retried_from_run_id', p_run_id,
      'retry_count', v_run.retry_count
    );
  end if;

  -- Preserve the failed source row as immutable execution history. The retry is
  -- represented by the new automation_runs row created by execute_automation_rule().
  update public.automation_runs
  set retry_count = retry_count + 1,
      updated_at = now()
  where id = p_run_id
  returning retry_count into v_retry_count;

  v_result := public.execute_automation_rule(v_run.rule_id);

  return v_result || jsonb_build_object(
    'retried_from_run_id', p_run_id,
    'retry_count', v_retry_count
  );
end;
$$;

revoke all on function public.retry_automation_run(uuid) from public, anon;
grant execute on function public.retry_automation_run(uuid) to authenticated, service_role;

comment on function public.retry_automation_run(uuid) is
  'Retries a failed automation run by creating a new execution while preserving the failed source row and incrementing its retry_count.';

commit;
