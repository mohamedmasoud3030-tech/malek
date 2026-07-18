-- Phase: Harden RLS for secondary tables
-- Ensures lands, leads, commissions, communication_records, utility_meters, utility_bills,
-- vault_documents, tenant_deposits, deposit_transactions, automation_rules etc are ADMIN/MANAGER write only

begin;

-- Helper to harden a table if exists
do $$
declare
  t text;
  tables_to_harden text[] := array[
    'lands',
    'leads',
    'commissions',
    'communication_records',
    'utility_meters',
    'utility_bills',
    'vault_documents',
    'contract_documents',
    'tenant_deposits',
    'deposit_transactions',
    'automation_rules',
    'automation_jobs',
    'automation_runs',
    'automation_run_logs',
    'automation_notifications',
    'deposit_txs'
  ];
begin
  foreach t in array tables_to_harden loop
    if to_regclass('public.'||t) is null then
      raise notice 'Skipping RLS hardening for missing table %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Drop old app_user policy if exists (the permissive one)
    execute format('drop policy if exists %I on public.%I', 'app_user_'||t, t);
    execute format('drop policy if exists %I on public.%I', t||'_auth', t);
    execute format('drop policy if exists %I on public.%I', 'automation_runs_auth', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_automation_jobs', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_automation_run_logs', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_lands', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_leads', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_commissions', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_communication_records', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_utility_bills', t);
    execute format('drop policy if exists %I on public.%I', 'app_user_deposit_txs', t);

    -- Drop our new policies if re-running
    execute format('drop policy if exists %I on public.%I', 'app_read_'||t, t);
    execute format('drop policy if exists %I on public.%I', 'manager_write_'||t, t);

    -- Create read policy for all app users
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_app_user())',
      'app_read_'||t, t
    );

    -- Create write policy for ADMIN/MANAGER only (use FOR ALL)
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager())',
      'manager_write_'||t, t
    );

    -- Grants: select for authenticated, insert/update for authenticated (RLS will block USER), no delete
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant insert, update on public.%I to authenticated', t);
    execute format('revoke delete on public.%I from authenticated', t);

    raise notice 'Hardened RLS for %', t;
  end loop;
end $$;

-- Additional explicit policies for lands/leads/commissions/communication_records that had delete revoked previously
-- Ensure delete is still revoked
revoke delete on public.lands from authenticated;
revoke delete on public.leads from authenticated;
revoke delete on public.commissions from authenticated;
revoke delete on public.communication_records from authenticated;

commit;
