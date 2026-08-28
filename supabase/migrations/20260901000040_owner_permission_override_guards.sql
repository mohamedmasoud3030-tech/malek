-- Owner permission overrides must be authoritative, not UI-only. The additive
-- capability policies in 00038 let a USER with an owner-approved capability
-- through legacy role-gated tables. These RESTRICTIVE companions also ensure
-- a legacy MANAGER/OPERATIONS role cannot bypass an explicit owner DENY.

begin;

do $guards$
declare
  r record;
  v_name text;
begin
  for r in
    select * from (values
      ('properties', 'properties.write'),
      ('units', 'properties.write'),
      ('contracts', 'contracts.write'),
      ('maintenance_records', 'maintenance.write'),
      ('expenses', 'expenses.write')
    ) as x(table_name, permission)
  loop
    if to_regclass('public.' || r.table_name) is null then
      continue;
    end if;

    v_name := 'p6_' || r.table_name || '_cap_insert_guard';
    execute format('drop policy if exists %I on public.%I', v_name, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name, r.table_name, r.permission
    );

    v_name := 'p6_' || r.table_name || '_cap_update_guard';
    execute format('drop policy if exists %I on public.%I', v_name, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L)) with check (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name, r.table_name, r.permission, r.permission
    );

    v_name := 'p6_' || r.table_name || '_cap_delete_guard';
    execute format('drop policy if exists %I on public.%I', v_name, r.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (company_id = public.require_company_id() and public.current_user_has_effective_app_permission(%L))',
      v_name, r.table_name, r.permission
    );
  end loop;
end
$guards$;

commit;
