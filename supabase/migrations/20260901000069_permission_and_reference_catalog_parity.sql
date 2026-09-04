begin;

-- ALLOW_GOVERNED_DATA_MIGRATION: canonical permission + tax-code reference repair.
--
-- Verified root cause (P0-1), replayed on PGlite 2026-09-04:
-- The frontend permission surface declares 61 codes
-- (rentrix-app/src/features/auth/permissions.ts) and the database role map
-- (public.role_has_app_permission) grants most of them to at least one role.
-- After
-- `supabase db push` only 21 of the 61 codes exist in
-- public.app_permission_catalog, because the remaining 40 were shipped only
-- through supabase/seed.sql. .github/workflows/supabase-production-migrations.yml
-- deploys with `db push` alone, and `db push` never applies [db.seed], so every
-- hosted environment is missing those rows while every `db reset` environment
-- (which applies seed.sql through the canonical replay harness and local
-- Supabase) has all 61. The frontend and the database therefore agree only by
-- accident of which bootstrap command was run.
--
-- public.current_user_has_effective_app_permission() resolves unknown
-- permission names to false and fails closed — including for ADMIN
-- (DATABASE_RULES.md: "Unknown permission names always return false, including
-- for ADMIN"). Consequences measured on the migrations-only replay:
--   * all 40 codes resolve false for every role, and the ADMIN client-side
--     short circuit in effective-permissions.ts hides it, so 14 routes and the
--     matching navigation entries are unreachable for MANAGER/ACCOUNTANT/USER;
--   * eight of them are also server-authoritative: users.manage is evaluated by
--     app_private.can_manage_company_members() (20260901000009) and drives
--     company_members RLS; contracts.write, financial.invoices.generate,
--     financial.payments.create, financial.bank_reconciliation.view,
--     financial.bank_reconciliation.match, permission_requests.review and
--     service_providers.write gate RPCs (20260901000015, 20260901000049,
--     20260901000058) and service-provider table policies. In a `db push`
--     environment those checks are permanently false for every role, including
--     ADMIN;
--   * delegation cannot even record one of those codes: the
--     enforce_app_permission_catalog trigger raises 'Unknown permission' (22023)
--     on user_permission_grants and permission_requests, so granting or
--     requesting a missing code fails outright rather than being merely
--     unadvertised.
--
-- This migration makes the migrations-only bootstrap path self-sufficient, i.e.
-- an exact superset of nothing and an exact match for what seed.sql delivers.
-- Values are taken verbatim from supabase/seed.sql so that both bootstrap paths
-- converge on the same rows; the three compatibility parent write permissions
-- keep the requestable=false hardening that 20260901000051 applied, which the
-- seed upsert silently reverted on `db reset` (reconciled in seed.sql too, so
-- the difference cannot come back).
insert into public.app_permission_catalog
  (permission, label_ar, admin_only, requestable)
values
  ('app.dashboard.view','عرض لوحة التحكم',false,false),
  ('arrears.view','عرض المتأخرات',false,true),
  ('audit.view','عرض سجل التدقيق',true,true),
  ('auth.password.change','تغيير كلمة المرور',false,false),
  ('automation.view','عرض الأتمتة',false,true),
  ('commissions.view','عرض العمولات',false,true),
  ('communication.view','عرض التواصل والمتابعات',false,true),
  ('company.settings.manage','إدارة إعدادات الشركة',true,true),
  ('contracts.write','إضافة وتعديل العقود',false,false),
  ('cost_centers.manage','إدارة مراكز التكلفة',false,true),
  ('documents.write','رفع واستبدال وأرشفة المستندات',false,true),
  ('expenses.view','عرض المصروفات',false,true),
  ('expenses.write','إضافة وتعديل المصروفات',false,true),
  ('financial.bank_reconciliation.match','تنفيذ المطابقة البنكية',false,true),
  ('financial.bank_reconciliation.view','عرض المطابقة البنكية',false,true),
  ('financial.deposits.view','عرض التأمينات',false,true),
  ('financial.fixed_monthly_accruals.execute','تنفيذ الاستحقاقات اليومية للعمولة الشهرية',false,true),
  ('financial.fixed_monthly_accruals.reverse','عكس استحقاق يومي للعمولة الشهرية',false,true),
  ('financial.fixed_monthly_accruals.view','عرض الاستحقاقات اليومية للعمولة الشهرية',false,true),
  ('financial.invoices.export','تصدير الفواتير',false,true),
  ('financial.invoices.generate','إنشاء الفواتير',false,true),
  ('financial.owner_settlements.approve','اعتماد تسويات الملاك',true,true),
  ('financial.owner_settlements.pay','صرف تسويات الملاك',true,true),
  ('financial.owner_settlements.view','عرض تسويات الملاك',false,true),
  ('financial.payments.create','تسجيل التحصيلات',false,true),
  ('financial.receipts.void','إلغاء الإيصالات',true,true),
  ('financial.reports.export','تصدير التقارير المالية',false,true),
  ('integrity.view','عرض سلامة البيانات',true,true),
  ('lands.view','عرض الأراضي',false,true),
  ('leads.view','عرض العملاء المحتملين',false,true),
  ('maintenance.view','عرض الصيانة',false,true),
  ('owners.detail.view','عرض ملف المالك',false,true),
  ('owners.hub.view','عرض سجل الملاك',false,true),
  ('permission_requests.review','مراجعة طلبات الصلاحية',false,false),
  ('properties.write','إضافة وتعديل العقارات',false,false),
  ('service_providers.view','عرض مزودي الخدمات',false,true),
  ('service_providers.write','إضافة وتعديل وأرشفة مزودي الخدمات',false,true),
  ('settings.manage','إدارة الإعدادات القديمة',true,true),
  ('system.view','عرض إعدادات النظام والحوكمة',true,true),
  ('users.manage','إدارة المستخدمين والأدوار',true,true)
on conflict (permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

-- Re-assert the 20260901000051 hardening after the upsert: these parents exist
-- for role-matrix compatibility only and must never become employee-requestable,
-- whichever bootstrap path created the row.
update public.app_permission_catalog
set requestable = false
where permission in ('properties.write', 'contracts.write', 'maintenance.write');

-- Same defect class, required by the P0-2 tax authority path: public
-- .company_tax_profiles.tax_code has a foreign key into public.tax_code_catalog,
-- which was also delivered only by seed.sql. In a `db push` environment the
-- catalog is empty, so the FK cannot be satisfied and create_tax_profile_atomic
-- can never produce a profile; every browser-side tax resolution then fails
-- with TAX_PROFILE_MISSING regardless of the RPC permission boundary.
insert into public.tax_code_catalog
  (code, name_ar, name_en, description, is_active)
values
  ('NON_TAXABLE','غير خاضع للضريبة','Non-taxable','Explicit non-taxable treatment; rate remains configuration-owned at 0.000.',true),
  ('VAT','ضريبة القيمة المضافة','Value Added Tax','Standard consumption tax applied to taxable supplies.',true),
  ('VAT_ZERO','ضريبة القيمة المضافة صفرية','Zero-rated VAT','Taxable supply reported at a 0% rate.',true)
on conflict (code) do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  description = excluded.description,
  is_active = excluded.is_active;

-- No code list is duplicated here on purpose: a hand-copied enumeration of the
-- permission names would itself become a stale constant. The parity guard lives
-- in rentrix-app/src/features/auth/permission-catalog-parity.pglite.test.ts,
-- which replays migrations only (the `db push` path, seed.sql excluded) and
-- compares the catalog against the codes the frontend actually declares.
comment on table public.app_permission_catalog is
  'Canonical permission catalog. Rows are migration-owned; supabase/seed.sql only '
  're-asserts the identical values for local reset. Unknown permission names fail '
  'closed for every role including ADMIN.';

commit;
