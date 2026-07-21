-- ============================================================================
-- RLS rollback template — لو أي جدول فشل
-- ============================================================================
--
-- لو فعّلت RLS على جدول وظهرت مشاكل، نفّذ ده عشان ترجع:
--

do $$
declare
  target_table text := 'properties';  -- ⬅️ غيّر ده لاسم الجدول اللي فشلت عليه
begin
  -- Drop the company isolation policy
  execute format('drop policy if exists %I_company_isolation on public.%I', target_table, target_table);

  -- Restore original role-based policies
  execute format(
    'create policy app_read_%I on public.%I
      for select to authenticated
      using (public.is_app_user())',
    target_table, target_table
  );
  execute format(
    'create policy manager_write_%I on public.%I
      for all to authenticated
      using (public.is_admin_or_manager())
      with check (public.is_admin_or_manager())',
    target_table, target_table
  );

  raise notice 'ROLLBACK: Company isolation removed from %, original policies restored.', target_table;
end;
$$;
