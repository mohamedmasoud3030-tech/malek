-- P0-1 Permission authority parity.
--
-- Verified defect on main (post-#1795/#1796): public.app_permission_catalog was
-- only partially migration-backed. Forward migrations 00005 / 00039 / 00044 /
-- 00051 / 00065 inserted 21 permission codes, while the remaining 39 codes that
-- the application actually resolves existed only in supabase/seed.sql.
--
-- That is not an acceptable authorization authority:
--   * `pnpm db0:replay` (migrations only, no seed) produced a 21-row catalog;
--   * public.current_user_has_effective_app_permission() fails closed for any
--     code absent from the catalog, so 39 legitimate capabilities were
--     unreachable server-side for every role including ADMIN;
--   * public.list_my_effective_app_permissions() projects only catalog rows, so
--     non-admin employees silently lost role-default capabilities;
--   * app_private.can_manage_company_members() (migration 00009) gates on
--     'users.manage', which was absent, so membership management RLS was dead;
--   * supabase/seed.sql runs AFTER the chain and silently reverted migration
--     00051's explicit `requestable = false` decision for maintenance.write.
--
-- ALLOW_GOVERNED_DATA_MIGRATION: canonical permission-catalog repair.
-- This migration moves the authoritative permission catalog into the migration
-- chain. It adds no new capability: every inserted code is already declared by
-- the six-role compatibility matrix (public.role_has_app_permission, migration
-- 00055), by a SECURITY DEFINER command boundary, or by an owner-assignable
-- portal capability, and every admin_only/requestable flag preserves the value
-- the catalog already declared. 'settings.manage' is deliberately NOT inserted:
-- it is a dead legacy alias with no route guard, navigation gate, feature
-- consumer or server reference, and it is removed from the frontend model in
-- the same change. supabase/seed.sql no longer declares permission authority.

begin;

-- ---------------------------------------------------------------------------
-- 1. Insert the 39 authoritative codes that previously existed only in seed.
--    admin_only / requestable preserve the already-declared intent, except for
--    the two broad compatibility parents that migration 00051 already decided
--    must stay out of the routine owner-facing permission editor.
-- ---------------------------------------------------------------------------
insert into public.app_permission_catalog(permission, label_ar, admin_only, requestable)
values
  ('app.dashboard.view','عرض لوحة التحكم',false,false),
  ('audit.view','عرض سجل التدقيق',true,true),
  ('integrity.view','عرض سلامة البيانات',true,true),
  ('properties.write','إضافة وتعديل العقارات',false,false),
  ('contracts.write','إضافة وتعديل العقود',false,false),
  ('maintenance.view','عرض الصيانة',false,true),
  ('service_providers.view','عرض مزودي الخدمات',false,true),
  ('service_providers.write','إضافة وتعديل وأرشفة مزودي الخدمات',false,true),
  ('system.view','عرض إعدادات النظام والحوكمة',true,true),
  ('users.manage','إدارة المستخدمين والأدوار',true,true),
  ('permission_requests.review','مراجعة طلبات الصلاحية',false,false),
  ('company.settings.manage','إدارة إعدادات الشركة',true,true),
  ('cost_centers.manage','إدارة مراكز التكلفة',false,true),
  ('documents.write','رفع واستبدال وأرشفة المستندات',false,true),
  ('owners.hub.view','عرض سجل الملاك',false,true),
  ('owners.detail.view','عرض ملف المالك',false,true),
  ('lands.view','عرض الأراضي',false,true),
  ('leads.view','عرض العملاء المحتملين',false,true),
  ('commissions.view','عرض العمولات',false,true),
  ('communication.view','عرض التواصل والمتابعات',false,true),
  ('automation.view','عرض الأتمتة',false,true),
  ('auth.password.change','تغيير كلمة المرور',false,false),
  ('expenses.view','عرض المصروفات',false,true),
  ('expenses.write','إضافة وتعديل المصروفات',false,true),
  ('arrears.view','عرض المتأخرات',false,true),
  ('financial.deposits.view','عرض التأمينات',false,true),
  ('financial.invoices.generate','إنشاء الفواتير',false,true),
  ('financial.invoices.export','تصدير الفواتير',false,true),
  ('financial.payments.create','تسجيل التحصيلات',false,true),
  ('financial.receipts.void','إلغاء الإيصالات',true,true),
  ('financial.reports.export','تصدير التقارير المالية',false,true),
  ('financial.bank_reconciliation.view','عرض المطابقة البنكية',false,true),
  ('financial.bank_reconciliation.match','تنفيذ المطابقة البنكية',false,true),
  ('financial.owner_settlements.view','عرض تسويات الملاك',false,true),
  ('financial.owner_settlements.approve','اعتماد تسويات الملاك',true,true),
  ('financial.owner_settlements.pay','صرف تسويات الملاك',true,true),
  ('financial.fixed_monthly_accruals.view','عرض الاستحقاقات اليومية للعمولة الشهرية',false,true),
  ('financial.fixed_monthly_accruals.execute','تنفيذ الاستحقاقات اليومية للعمولة الشهرية',false,true),
  ('financial.fixed_monthly_accruals.reverse','عكس استحقاق يومي للعمولة الشهرية',false,true)
on conflict(permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

-- ---------------------------------------------------------------------------
-- 2. Re-assert migration 00051's compatibility-parent decision. Its UPDATE was
--    a no-op for properties.write / contracts.write (rows did not exist yet)
--    and was reverted for maintenance.write by the reference seed, which runs
--    after the chain. Broad writes stay resolvable for legacy roles, grants and
--    owner overrides, but remain non-requestable and non-assignable.
-- ---------------------------------------------------------------------------
update public.app_permission_catalog
set requestable = false
where permission in ('properties.write', 'contracts.write', 'maintenance.write');

-- ---------------------------------------------------------------------------
-- 3. Fail-closed parity guard. The catalog is the single permission authority,
--    so a six-role matrix code without a catalog row would silently deny a
--    legitimate non-admin capability. Abort the migration instead.
-- ---------------------------------------------------------------------------
do $catalog_parity$
declare
  v_role_matrix text[] := array[
    'app.dashboard.view','arrears.view','audit.view','auth.password.change',
    'automation.view','commissions.view','communication.view','contracts.approve',
    'contracts.cancel','contracts.create','contracts.edit','contracts.view',
    'contracts.write','cost_centers.manage','documents.write','expenses.view',
    'expenses.write','financial.bank_reconciliation.match','financial.bank_reconciliation.view','financial.deposits.view',
    'financial.fixed_monthly_accruals.execute','financial.fixed_monthly_accruals.reverse','financial.fixed_monthly_accruals.view','financial.invoices.export',
    'financial.invoices.generate','financial.owner_settlements.view','financial.payments.create','financial.receipts.void',
    'financial.reports.export','financial.reports.view','financial.workspace.view','lands.view',
    'leads.view','maintenance.approve','maintenance.cancel','maintenance.create',
    'maintenance.edit','maintenance.view','maintenance.write','owners.detail.view',
    'owners.hub.view','permission_requests.review','properties.archive','properties.create',
    'properties.edit','properties.view','properties.write','service_providers.view',
    'service_providers.write','support.operations.view','support.requests.triage'
  ];
  v_expected_catalog text[] := array[
    'app.dashboard.view','arrears.view','audit.view','auth.password.change',
    'automation.view','commissions.view','communication.view','company.settings.manage',
    'contracts.approve','contracts.cancel','contracts.create','contracts.edit',
    'contracts.view','contracts.write','cost_centers.manage','documents.write',
    'expenses.view','expenses.write','financial.bank_reconciliation.match','financial.bank_reconciliation.view',
    'financial.deposits.view','financial.fixed_monthly_accruals.execute','financial.fixed_monthly_accruals.reverse','financial.fixed_monthly_accruals.view',
    'financial.invoices.export','financial.invoices.generate','financial.owner_settlements.approve','financial.owner_settlements.pay',
    'financial.owner_settlements.view','financial.payments.create','financial.receipts.void','financial.reports.export',
    'financial.reports.view','financial.workspace.view','integrity.view','lands.view',
    'leads.view','maintenance.approve','maintenance.cancel','maintenance.create',
    'maintenance.edit','maintenance.view','maintenance.write','owner.portal.link',
    'owners.detail.view','owners.hub.view','permission_requests.review','properties.archive',
    'properties.create','properties.edit','properties.view','properties.write',
    'service_providers.view','service_providers.write','support.operations.view','support.requests.triage',
    'support.user_lookup.view','system.view','tenant.portal.link','users.manage'
  ];
  v_missing text[];
  v_not_requestable text[];
begin
  select array_agg(m.permission order by m.permission)
    into v_missing
    from unnest(v_role_matrix) as m(permission)
    where not exists (
      select 1 from public.app_permission_catalog c where c.permission = m.permission
    );

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception
      'PERMISSION_CATALOG_INCOMPLETE: six-role matrix references % with no public.app_permission_catalog row',
      v_missing;
  end if;

  select array_agg(c.permission order by c.permission)
    into v_not_requestable
    from public.app_permission_catalog c
    where c.permission = any(v_expected_catalog)
      and c.requestable
      and c.permission in ('properties.write', 'contracts.write', 'maintenance.write');

  if coalesce(array_length(v_not_requestable, 1), 0) > 0 then
    raise exception
      'PERMISSION_CATALOG_COMPATIBILITY_PARENT_REQUESTABLE: % must stay out of the owner-facing permission editor',
      v_not_requestable;
  end if;
end
$catalog_parity$;

comment on table public.app_permission_catalog is
  'Single authoritative application permission catalog. Owned by the migration chain; supabase/seed.sql declares no permission authority. A code absent from this table fails closed in current_user_has_effective_app_permission() for every role, including ADMIN.';

commit;
