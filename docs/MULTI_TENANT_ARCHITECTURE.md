# Rentrix — Multi-Tenant Architecture

> تاريخ التحويل: 2026-07-22 | Migration: `20260722010000_phase1_create_companies_and_seed.sql`

---

## نظرة عامة

Rentrix تحول من تطبيق مكتب واحد إلى **منصة Multi-Tenant SaaS** باستخدام Supabase Row-Level Security. كل صف بيانات في النظام يحمل `company_id`، وسياسات RLS تمنع أي مستخدم من رؤية أو تعديل بيانات غير شركته.

---

## بنية البيانات

### جداول جديدة

```sql
-- جدول المكاتب/الشركات
companies (
  id uuid PK,
  name text,
  slug text UNIQUE,
  currency text,        -- e.g. 'OMR', 'SAR'
  locale text,          -- e.g. 'ar-OM', 'en-SA'
  timezone text,        -- e.g. 'Asia/Muscat'
  is_active boolean
)

-- ربط المستخدمين بالمكاتب (Many-to-Many)
company_members (
  id uuid PK,
  company_id uuid FK → companies,
  user_id uuid FK → auth.users,
  role text CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  is_active boolean,
  UNIQUE (company_id, user_id)
)
```

### دالة الشركة النشطة

```sql
-- تستخرج company_id من JWT الحالي
current_company_id() → uuid
-- Reads: auth.jwt() -> 'app_metadata' ->> 'company_id'
```

### Custom Access Token Hook

`custom_access_token_hook()` الآن يحقن `company_id` في JWT:
- يقرأ أول شركة نشطة للمستخدم من `company_members`
- يحقنها في `app_metadata.company_id`
- لو المستخدم غيّر شركته النشطة، الـhook يُعاد استدعاؤه

---

## RLS Policies

### النمط الأساسي (معظم الجداول)

```sql
CREATE POLICY {table}_company_isolation ON public.{table}
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
```

### الاستثناءات

| الجدول | السبب |
|--------|-------|
| `users` | cross-company — المستخدم يشوف حسابه فقط |
| `profiles` | per-user — بيانات شخصية |
| `sessions` | per-user — جلسات المستخدم |
| `audit_log` | system-level — للأدمن فقط |
| `financial_operation_idempotency` | ممنوع الوصول المباشر |
| `governance`, `schema_refactor_notes` | system-level |
| `automation_jobs` | system-level — وظائف عامة |
| `companies` | member-read — عضو يشوف شركته فقط |
| `company_members` | admin-write — الأدمن يديروا العضويات |

---

## Frontend Architecture

### CompanyProvider (Context)

```
AppProviders
  └── AuthProvider
       └── CompanyProvider     ← NEW
            └── App Content
```

### Hooks

```tsx
// الحصول على بيانات الشركة النشطة
const { activeCompany, companies, switchCompany, currentRole } = useCompany();

// للحصول على company_id فقط (لـ INSERT operations)
const companyId = useActiveCompanyId();
```

### Company Selector

- **`CompanySelectorPage`**: صفحة كاملة تظهر بعد الدخول لو المستخدم في أكتر من شركة
- **`CompanySwitcher`**: dropdown في الـsidebar/header للتبديل بين الشركات

---

## INSERT Operations

كل INSERT في كود الفرونت إند **لازم** يشمل `company_id`:

```tsx
const companyId = useActiveCompanyId();

await supabase.from('properties').insert({
  title: '...',
  // ... other fields
  company_id: companyId,  // REQUIRED
});
```

---

## Flow: تسجيل الدخول + اختيار شركة

```
1. المستخدم يدخل email + password
   ↓
2. Supabase يرجع JWT + custom_access_token_hook يحقن company_id
   ↓
3. CompanyProvider يحمل شركات المستخدم من company_members
   ↓
4a. شركة واحدة → dashboard مباشرة
4b. أكتر من شركة → CompanySelectorPage تظهر → المستخدم يختار
   ↓
5. switchCompany() يُحدث app_metadata → JWT جديد بـ company_id
   ↓
6. كل الاستعلامات بعدها مفلترة تلقائيًا بـ RLS
```

---

## جداول مشمولة (53 جدول)

### Tier 1 — Operational (42 جدول)
properties, property_owners, owners, units, people, tenants, contracts, invoices, payments, receipts, receipt_allocations, expenses, maintenance_records, contract_balances, owner_balances, accounts, journal_entries, lands, leads, commissions, utility_bills, utility_meters, vault_documents, contract_documents, owner_settlements, deposit_txs, deposit_transactions, tenant_deposits, bank_accounts, bank_statement_imports, bank_statement_lines, bank_reconciliation_matches, budgets, company-assets, account_balances, tenant_balances, serials, status_history, status_transition_rules, kpi_snapshots, snapshots, company_settings

### Tier 2 — Scoped (11 جدول)
automation_rules, automation_runs, automation_run_logs, automation_notifications, notifications, app_notifications, notification_templates, outgoing_notifications, communication_records, missions, attachments

### Tier 3 — System (no company_id needed)
users, profiles, sessions, audit_log, financial_operation_idempotency, governance, schema_refactor_notes, auto_backups, automation_jobs, settings, companies, company_members

---

## Known Issues / Follow-ups

1. **INSERT company_id injection**: يجب فحص كل نقطة INSERT في الكود والتأكد إنها تمرر `company_id`. حاليًا RLS يمنع الإدخال لو company_id مش موجود (WITH CHECK fails)، لكن الأفضل أن يكون الـINSERT صريح.

2. **Company selector integration**: `CompanySelectorPage` لم تُربط بعد بـ router كـ route مستقل. يجب إضافتها كـ guard بين الـlogin والـdashboard.

3. **Subdomain routing**: حاليًا كل المكاتب على نفس الدومين. مستقبلًا يمكن إضافة `company-slug.rentrix.app` لكل مكتب.

4. **Cross-company features**: بعض الميزات مثل الـaudit_log وglobal reports قد تحتاج `service_role` لتجاوز RLS.

---

## اختبار العزل (Isolation Test)

للتأكد من عزل المكاتب، أنشئ شركتين تجريبيتين:

```sql
-- شركة A
INSERT INTO companies (id, name, slug) VALUES (gen_random_uuid(), 'Test Company A', 'test-a');
-- شركة B
INSERT INTO companies (id, name, slug) VALUES (gen_random_uuid(), 'Test Company B', 'test-b');

-- مستخدم في شركة A فقط
-- ... سجل دخول بحساب مربوط بشركة A
-- ... تأكد إن SELECT على properties يرجع بيانات شركة A فقط
-- ... حاول INSERT بـ company_id = B → يجب أن يفشل بـ RLS violation
```
