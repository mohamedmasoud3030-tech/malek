-- MALEK canonical reference data.
-- This file contains only global/system reference data. It contains no company,
-- user, contract, invoice, payment, receipt, journal or other disposable demo
-- transaction. Demo transactions are created through the authoritative runtime
-- RPC paths by the existing isolated single-office seed runner.
--
-- This file declares NO authorization authority. public.app_permission_catalog
-- is owned exclusively by the migration chain (migrations 00005 / 00039 /
-- 00044 / 00051 / 00065 and 20260904000001_authoritative_permission_catalog_parity).
-- Seeding the catalog here ran after the chain, so it silently reverted
-- migration 00051's requestable=false decision and left 39 permission codes
-- resolvable only in seeded environments.

begin;

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
