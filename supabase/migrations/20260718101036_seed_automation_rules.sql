-- Seed default automation rules from UI catalog

begin;

insert into public.automation_rules (id, name, description, rule_type, is_enabled, config, schedule_interval_hours, created_at)
values
  ('contract-expiry-30', 'تذكير انتهاء العقود (30 يوماً)', 'إشعار داخلي قبل انتهاء العقد بثلاثين يوماً.', 'contract_expiry', true, '{"days_before":30,"channels":["in_app","whatsapp"],"audience":"tenant_owner_manager"}'::jsonb, 24, now()),
  ('contract-expiry-7', 'تذكير انتهاء العقود (7 أيام)', 'تنبيه عاجل قبل أسبوع من نهاية العقد مع اقتراح مسار التجديد.', 'contract_expiry', true, '{"days_before":7,"channels":["in_app"],"audience":"operations"}'::jsonb, 24, now()),
  ('rent-reminder-due', 'تذكير استحقاق الإيجار', 'إرسال تذكير قبل تاريخ الاستحقاق بثلاثة أيام.', 'overdue_invoice', true, '{"days_before_due":3,"channels":["whatsapp"]}'::jsonb, 24, now()),
  ('rent-overdue-escalation', 'تصعيد المتأخرات', 'تنبيه تصعيدي بعد 7 أيام من التأخر.', 'overdue_invoice', false, '{"overdue_days":7,"channels":["email","in_app"]}'::jsonb, 24, now()),
  ('owner-monthly-report', 'تقرير المالك الشهري', 'ملخص تحصيل ومصروفات وإشغال يُجهز نهاية كل شهر.', 'contract_expiry', false, '{"report":"owner_monthly","channels":["email"]}'::jsonb, 168, now()),
  ('maintenance-sla', 'تنبيهات الصيانة', 'تنبيه عند تجاوز طلب صيانة المفتوحة لمدة محددة دون حل.', 'maintenance_overdue', true, '{"open_hours":48,"channels":["in_app"]}'::jsonb, 24, now())
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  rule_type = excluded.rule_type,
  config = excluded.config,
  updated_at = now();

commit;
