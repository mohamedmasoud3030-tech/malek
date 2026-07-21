# Multi-Tenant Migration Audit — جدول بكل الجداول والحالة

> تاريخ: 2026-07-22 | الفرع: `feature/multi-tenant-company-isolation`

---

## Tier 1 — جداول عملياتية تحتاج `company_id` (بيانات مكتب)

| # | الجدول | RLS حاليًا | البيانات | ملاحظات |
|---|--------|-------------|----------|---------|
| 1 | `properties` | ✅ | محتمل | id uuid PK |
| 2 | `property_owners` | ✅ | محتمل | FK → properties, owners |
| 3 | `owners` | ✅ | محتمل | id uuid PK |
| 4 | `units` | ✅ | محتمل | FK → properties |
| 5 | `people` | ✅ | محتمل | tenants/owners/contacts |
| 6 | `tenants` | ✅ | محتمل | **id text PK** |
| 7 | `contracts` | ✅ | محتمل | FK → properties, units, people |
| 8 | `invoices` | ✅ | محتمل | FK → contracts |
| 9 | `payments` | ✅ | محتمل | FK → invoices, contracts |
| 10 | `receipts` | ✅ | محتمل | FK → contracts |
| 11 | `receipt_allocations` | ✅ | محتمل | FK → receipts, invoices |
| 12 | `expenses` | ✅ | محتمل | FK → properties |
| 13 | `maintenance_records` | ✅ | محتمل | FK → properties, units |
| 14 | `contract_balances` | ✅ | محتمل | FK → contracts |
| 15 | `owner_balances` | ✅ | محتمل | FK → owners |
| 16 | `accounts` | ✅ | محتمل | شجرة الحسابات |
| 17 | `journal_entries` | ✅ | محتمل | FK → accounts |
| 18 | `lands` | ✅ | محتمل | أراضي |
| 19 | `leads` | ✅ | محتمل | عملاء محتملين |
| 20 | `commissions` | ✅ | محتمل | عمولات |
| 21 | `utility_bills` | ✅ | محتمل | فواتير مرافق |
| 22 | `utility_meters` | ✅ | محتمل | عدادات |
| 23 | `vault_documents` | ✅ | محتمل | مستندات |
| 24 | `contract_documents` | ✅ | محتمل | مرفقات عقود |
| 25 | `owner_settlements` | ✅ | محتمل | تسويات ملاك |
| 26 | `deposit_txs` | ✅ | محتمل | تحويلات تأمينات |
| 27 | `deposit_transactions` | ✅ | محتمل | Ledger تأمينات |
| 28 | `tenant_deposits` | ✅ | محتمل | تأمينات مستأجرين |
| 29 | `bank_accounts` | ✅ | محتمل | حسابات بنكية |
| 30 | `bank_statement_imports` | ✅ | محتمل | استيراد كشوفات |
| 31 | `bank_statement_lines` | ✅ | محتمل | بنود كشف |
| 32 | `bank_reconciliation_matches` | ✅ | محتمل | مطابقات |
| 33 | `budgets` | ✅ | محتمل | ميزانيات |
| 34 | `"company-assets"` | ✅ | محتمل | أصول |
| 35 | `account_balances` | ✅ | محتمل | أرصدة حسابات |
| 36 | `tenant_balances` | ✅ | محتمل | أرصدة مستأجرين |
| 37 | `serials` | ✅ | محتمل | أرقام تسلسلية |
| 38 | `company_settings` | ✅ | محتمل | سيتحول لجدول companies |
| 39 | `status_history` | ✅ | محتمل | سجل حالات |
| 40 | `status_transition_rules` | ✅ | محتمل | قواعد انتقال |
| 41 | `kpi_snapshots` | ✅ | محتمل | لقطات KPI |
| 42 | `snapshots` | ✅ | محتمل | لقطات عامة |

---

## Tier 2 — جداول Scoped (تحتاج company_id لكن ثانوي)

| # | الجدول | ملاحظات |
|---|--------|---------|
| 43 | `automation_rules` | قواعد أتمتة لكل مكتب |
| 44 | `automation_runs` | تنفيذات مرتبطة بالقواعد |
| 45 | `automation_run_logs` | سجلات تنفيذ |
| 46 | `automation_notifications` | إشعارات أتمتة |
| 47 | `notifications` | إشعارات داخلية |
| 48 | `app_notifications` | إشعارات تطبيق |
| 49 | `notification_templates` | قوالب إشعارات |
| 50 | `outgoing_notifications` | إشعارات صادرة |
| 51 | `communication_records` | سجل تواصل |
| 52 | `missions` | مهام ميدانية |
| 53 | `attachments` | مرفقات عامة |

---

## Tier 3 — جداول نظام (لا تحتاج company_id)

| # | الجدول | السبب |
|---|--------|-------|
| 54 | `users` | مستخدمون عبر المكاتب (Many-to-Many) |
| 55 | `profiles` | بيانات مستخدم شخصية |
| 56 | `sessions` | جلسات مستخدم |
| 57 | `audit_log` | سجل تدقيق شامل |
| 58 | `financial_operation_idempotency` | منع تكرار عمليات |
| 59 | `governance` | حوكمة النظام |
| 60 | `schema_refactor_notes` | ملاحظات تقنية |
| 61 | `auto_backups` | نسخ احتياطية |
| 62 | `automation_jobs` | وظائف أتمتة عامة |
| 63 | `settings` | إعدادات عامة للنظام |

---

## جداول جديدة (ستُنشأ)

| الجدول | الوصف |
|--------|-------|
| `companies` | جدول المكاتب/الشركات |
| `company_members` | ربط المستخدمين بالمكاتب |

---

## الدوال الحالية المؤثرة

| الدالة | الدور الحالي | التأثير |
|--------|--------------|---------|
| `current_app_role()` | يقرأ role من JWT | سيُضاف `current_company_id()` بجانبها |
| `is_app_user()` | يتحقق من وجود مستخدم | ستُعدّل لتشترط وجود company |
| `is_admin()` | يتحقق من ADMIN | ستبقى كما هي + company scope |
| `is_admin_or_manager()` | ADMIN أو MANAGER | ستبقى كما هي + company scope |
| `custom_access_token_hook()` | يحقن user_role في JWT | سيُضاف company_id في JWT |
