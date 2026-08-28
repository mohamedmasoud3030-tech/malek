-- MALEK canonical reference data.
-- This file contains only global/system reference data. It contains no company,
-- user, contract, invoice, payment, receipt, journal or other disposable demo
-- transaction. Demo transactions are created through the authoritative runtime
-- RPC paths by the existing isolated single-office seed runner.

begin;

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
  ('contracts.view','عرض العقود والمستأجرين',false,true),
  ('contracts.write','إضافة وتعديل العقود',false,true),
  ('cost_centers.manage','إدارة مراكز التكلفة',false,true),
  ('documents.write','رفع واستبدال وأرشفة المستندات',false,true),
  ('expenses.view','عرض المصروفات',false,true),
  ('expenses.write','إضافة وتعديل المصروفات',false,true),
  ('financial.workspace.view','عرض المالية والتحصيل',false,true),
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
  ('maintenance.write','إنشاء ومتابعة وتنفيذ الصيانة',false,true),
  ('owners.detail.view','عرض ملف المالك',false,true),
  ('owners.hub.view','عرض سجل الملاك',false,true),
  ('permission_requests.review','مراجعة طلبات الصلاحية',false,false),
  ('properties.view','عرض العقارات والوحدات',false,true),
  ('properties.write','إضافة وتعديل العقارات',false,true),
  ('service_providers.view','عرض مزودي الخدمات',false,true),
  ('service_providers.write','إضافة وتعديل وأرشفة مزودي الخدمات',false,true),
  ('settings.manage','إدارة الإعدادات القديمة',true,true),
  ('system.view','عرض إعدادات النظام والحوكمة',true,true),
  ('users.manage','إدارة المستخدمين والأدوار',true,true)
on conflict (permission) do update set
  label_ar=excluded.label_ar,
  admin_only=excluded.admin_only,
  requestable=excluded.requestable;

insert into public.tax_code_catalog
  (code, name_ar, name_en, description, is_active)
values
  ('NON_TAXABLE','غير خاضع للضريبة','Non-taxable','Explicit non-taxable treatment; rate remains configuration-owned at 0.000.',true),
  ('VAT','ضريبة القيمة المضافة','Value Added Tax','Standard consumption tax applied to taxable supplies.',true),
  ('VAT_ZERO','ضريبة القيمة المضافة صفرية','Zero-rated VAT','Taxable supply reported at a 0% rate.',true)
on conflict (code) do update set
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  description=excluded.description,
  is_active=excluded.is_active;

insert into public.onboarding_requirement_templates
  (code, label_ar, required, waiver_policy, sort_order, completion_source)
values
  ('owner','إضافة أول مالك',true,'NON_WAIVABLE',1,'OWNER_EXISTS'),
  ('property','إنشاء أول عقار',true,'NON_WAIVABLE',2,'PROPERTY_EXISTS'),
  ('unit','إنشاء أول وحدة',true,'ADMIN_WAIVABLE',3,'UNIT_EXISTS'),
  ('contract','إنشاء أول عقد',true,'ADMIN_WAIVABLE',4,'CONTRACT_EXISTS'),
  ('invoice','إصدار أول فاتورة',false,'ADMIN_WAIVABLE',5,'INVOICE_EXISTS')
on conflict (code) do update set
  label_ar=excluded.label_ar,
  required=excluded.required,
  waiver_policy=excluded.waiver_policy,
  sort_order=excluded.sort_order,
  completion_source=excluded.completion_source;

commit;
