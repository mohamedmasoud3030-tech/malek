# Consolidated Master Audit & Remediation Log — August 2026
# سجل التدقيق الموحد وخارطة طريق الإصلاح الفني — أغسطس 2026

**Date / التاريخ:** 2026-08-05  
**Audit Conducted By / الجهة المعدة:** Arena.ai's Agent Mode (Technical Audit & Safety Team)  
**Status / الحالة:** Completed & Recorded in Repository (جاهز للتنفيذ)  

---

## 1. Introduction / مقدمة

This **Consolidated Master Log** integrates all findings from the Technical Debt Audit, Incident Postmortem, Design Critique, Design System Review, and Testing Strategy into a single, authoritative reference matrix. 

يجمع هذا **السجل الموحد الشامل** كافة النتائج والتوصيات التي تم التوصل إليها في عمليات التدقيق الفني، وتحليل الحوادث الأمنية السابقة (Postmortem)، وتقييم الواجهة وتجربة المستخدم (UI/UX)، وهندسة تصميم النظام (Design System)، واستراتيجيات الفحص بـ CI وقواعد البيانات (Testing Strategy) في جدول واحد متكامل يسهل تتبعه وتضمينه في خطط التطوير القادمة.

---

## 2. Consolidated Master Matrix / الجدول الموحد للنتائج والأدلة الفنية

| الفئة / المجال <br>(Category) | اسم المشكلة أو الميزة <br>(Item Name) | الأدلة والملفات البرمجية المتأثرة <br>(Evidence & File Paths) | التشخيص والأثر الفني <br>(Diagnosis & Technical Impact) | الإجراء والحل الفوري المقترح <br>(Remediation & Action) | الأولوية والدرجة <br>(Priority Score) |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **🔒 الأمان والحوكمة <br>(Security & Isolation)** | **ثغرة مسار البحث المفتوح للـ SQL** <br>(Unpinned `search_path` on Definer trigger) | دالة المقارنة: <br>`public.audit_journal_entry_insert()` <br>الملف: <br>`supabase/migrations/20260730091000_...` | غياب مسار البحث الثابت يتيح إمكانية تسييل وتعديل سياق تنفيذ الـ Trigger عبر جداول مؤقتة (`pg_temp`). | دمج وتطبيق هجرة الإصلاح المعلقة `20260730091000` لفرض الحارس `SET search_path = public, pg_temp`. | **SEV1** <br>Score: **30** |
| **🛡️ الأمان والحوكمة <br>(Security & Isolation)** | **تسريبات عزل البيانات ما بين الشركات** <br>(P0 Company Data Leakage Incident) | الجداول: `payments`, `expenses`, `invoices`, `contracts` <br>التقارير: `rpt_cash_flow`, `rpt_owner_statement` <br>ملف التقرير: `docs/audits/P0_MULTI_TENANT_...` | سياسات الـ RLS السابقة كانت تعتمد على فحص الدور فقط (`is_app_user`) مما سمح بقراءة وتعديل فواتير ومصروفات الشركات الأخرى. | تطبيق سياسة العزل المشددة `p0_tenant_isolation` على 56 جدولاً وفرض تصفية التقارير بـ JWT العميل (PR #1276). | **SEV1 (Resolved)** <br>Score: **18** |
| **⚡ الأداء والاستقرار <br>(Database Performance)** | **بطء سياسات الـ RLS وحظر الفهارس** <br>(224 Supabase Advisor Performance Gaps) | قاعدة بيانات الإنتاج: <br>`nnggcnpcuomwfuupupwg` <br>تنبيهات الـ RLS: `auth_rls_initplan` <br>مفاتيح بدون فهارس: 62 مفتاحاً | تكرار استدعاء `auth.uid()` لكل صف بدلاً من الكاش، مما يبطئ الاستعلامات مع كبر حجم البيانات، مع غياب فهارس الفهارس الخارجية. | 1. تعديل سياسات RLS لتخزين الهوية في متغير الجلسة. <br>2. إضافة فهارس `CREATE INDEX` لـ 62 مفتاحاً خارجياً. <br>3. حذف 63 فهرساً غيراً مستخدم. | **High** <br>Score: **21** |
| **🧩 هندسة الكود <br>(Code Boundaries)** | **تداخل واجهات العرض مع الخدمات الخارجية** <br>(Cross-Feature Presentation Coupling) | الملف: `check-architecture.mjs` <br>قائمة التجميد: `presentationServiceDebtAllowList` <br>المكون المسبب: `owner-detail-view.tsx` | تستورد مكونات العرض في الملاك وتنسيق التقارير دوالاً مالية وتنسيقية مباشرة من feature الفواتير بدلاً من المكتبة المشتركة. | استبدال الاستيراد المباشر باستدعاء `formatCompanyMoney` من `@/lib/companyFormatters.ts` ومسح الملفات من قائمة التجميد تدريجياً. | **Medium** <br>Score: **20** |
| **📊 جودة الكود <br>(Quality & Static Analysis)** | **تداخل استثناءات السونار وتصفية التغطية** <br>(SonarCloud Overlapping Exclusions) | الملف: <br>`sonar-project.properties` | تكرار تصفية وتعارض استثناءات `sonar.exclusions` واستبعاد كافة ملفات الـ `*.ts` والـ `*.tsx` مما يعطل قراءة التغطية الفعلية للاختبارات. | دمج وتوحيد خصائص الاستثناءات وإزالة wildcards الكود الرئيسي لتعود تقارير التغطية على SonarCloud للعمل بدقة. | **Medium** <br>Score: **20** |
| **📁 الفجوات التشغيلية <br>(Functional Accounting Gaps)** | **غياب جدولة عقود الاستئجار المباشر** <br>(Master Lease Fixed Obligations) | المسار: `rentrix-app/src/features/owners/*` <br>الجداول والسياسات: `owner_balances` والسياسات المالية | السياسات المحاسبية تفرض التزاماً شهرياً ثابتاً للمالك في عقود الاستئجار المباشر، ولكن الهيكل لا يملك بعد شاشة لتوليد هذا الالتزام تلقائياً. | بناء واجهة توليد وجدولة الدفعات الافتراضية للمالك (Obligation Schedule) وربطها بدفاتر الخصم والاستحقاق المباشر للمكتب. | **High** <br>Score: **14** |
| **📁 الفجوات التشغيلية <br>(Functional Accounting Gaps)** | **غياب التوزيع الآلي لتكاليف الصيانة** <br>(Split Maintenance Cost Allocation UI) | الواجهة: `src/features/maintenance/*` <br>دالة الباك إند: <br>`resolve_maintenance_with_expense` | رغم وجود الـ RPC بالخلفية، لا تزال واجهة الصيانة تفتقر لخيار تحديد نسب التوزيع المشتركة (مثال: 50% مالك، 50% مستأجر). | مواءمة نموذج إغلاق الصيانة ليتيح اختيار "توزيع التكاليف" ونسب الخصم والترحيل المزدوج لليومية العامة. | **High** <br>Score: **14** |
| **📁 الفجوات التشغيلية <br>(Functional Accounting Gaps)** | **حماية تماسك حساب الودائع من الحذف** <br>(Tenant Deletion Balance Trigger Guard) | الجداول: `people`, `tenants`, `tenant_deposits` | إمكانية حذف جهة الاتصال للمستأجر من الواجهة بالخطأ بالرغم من وجود وديعة تأمين سارية أو رصيد غير مصفّى بدفاتر الأمانات. | إدراج Trigger حماية برمجية بقاعدة البيانات يمنع حذف أي مستأجر يملك رصيد ودائع نشط (على غرار حارس الملاك `trg_prevent_owner_delete_with_balances`). | **High** <br>Score: **14** |
| **🎨 لغة التصميم <br>(Design System)** | **تداخل أحجام وتسميات الأزرار والـ Badges** <br>(Button Size & Badge Token Drift) | الملفات: <br>`button.tsx` <br>`badge.tsx`, `status-badge.tsx` | 1. الحجم الصغير `sm` والمتوسط `md` للأزرار يملكان نفس قيود الطول `min-h-10`. <br>2. استخدام الـ `Badge` لتوكنات مخصصة `bg-success-bg` بينما `StatusBadge` تستخدم `/10`. | 1. تعديل الأزرار `sm` لتصبح `min-h-9` لتوفير تدرج حقيقي. <br>2. توحيد توكنات الخلفية للـ Badges لتعتمد كلياً على شفافية ألفا لتايلوند (`bg-success/10`). | **Medium** <br>Score: **20** |
| **⚙️ قواعد البيانات <br>(Database Architecture)** | **تضارب أنواع المعرفات الفردية** <br>(Mismatched SQL ID Types: `text` vs `uuid`) | الجداول الأساسية: <br>`contracts.id` (text) <br>`invoices.contract_id` (text) <br>مقابل: `owners.id` (uuid) | يؤدي تباين الأنواع بين الجداول القديمة والجديدة لفرض التحويل الصريح `::text` داخل الدوال والترايغرات، ويعوق بناء Foreign Keys أصلية. | جدولة صيانة مرحلية غير متصلة (Offline Migrations) لتحويل المعرفات القديمة بالكامل إلى `uuid` وتحديث كافة ترايغرات الربط. | **Low** <br>Score: **8** |
| **🧪 استراتيجيات الفحص <br>(Testing Strategy)** | **غياب الفحص الاستباقي على نسخ الإنتاج** <br>(Missing Staging Preflight Execution) | بيئة الاختبار: `CI Pipeline / Vitest` <br>الأدلة: عدم توفر `SUPABASE_DB_URL` في الفحص | يتم تشغيل سلسلة الهجرات بنجاح على PGLite بالذاكرة، ولكن غياب الفحص على قاعدة بيانات حية حقيقية يمنع اكتشاف أخطاء تضارب الأنواع قبل الدمج. | كتابة سكريبت مسبق في الـ CI يقوم بعمل نسخة هيكلية من الإنتاج (Staging Clone) وتشغيل سلسلة التراجع والتقديم عليها وتوثيق الفروقات. | **Medium** <br>Score: **12** |

---

## 3. Roadmap & Phased Execution Plan / خارطة الطريق وخطة التنفيذ التدريجية

### 🟢 Phase 1: Security & Immediate Fixes (Weeks 1–2 / السبرنت الأول)
* **Objective:** Secure database triggers, close local configuration loops, and eliminate visual clutter.
* **الأهداف:** تأمين قاعدة البيانات ضد ثغرات التسييل، إغلاق إعدادات الحماية الفورية، والتخلص من الكود البصري الميت.
* **Actions / الإجراءات:**
  - Hardening the `audit_journal_entry_insert` search path via `20260730091000_reconcile_audit_journal_trigger_security.sql`.
  - Manually enable **Leaked Password Protection** in the Supabase Dashboard.
  - Delete legacy raster files `icon-rentrix-192.png` and `icon-rentrix-512.png`.

### 🟡 Phase 2: Performance & Quality Gates (Month 1 / الشهر الأول)
* **Objective:** Clean up Static Analysis reports and optimize indexing to prepare the database for real client scaling.
* **الأهداف:** تنظيف لوحة تحكم السونار، وتأسيس الفهارس لتهيئة قاعدة البيانات للبيانات الضخمة.
* **Actions / الإجراءات:**
  - Consolidate exclusion wildcards inside `sonar-project.properties` to restore test coverage analytics.
  - Generate a dedicated migration to provision `CREATE INDEX` for all 62 unindexed foreign keys flagged by the Supabase Advisor.
  - Drop the 63 unused indexes to accelerate transactional processing on high-volume accounting ledgers.

### 🔵 Phase 3: Architectural Cleanup & Local Triggers (Months 2–3 / الشهر الثاني والثالث)
* **Objective:** Ensure feature-boundary isolation compliance and write missing data integrity triggers.
* **الأهداف:** تصفية مديونات تداخل الكود في واجهات العرض وتأسيس ترايغرات تماسك البيانات التشغيلية.
* **Actions / الإجراءات:**
  - Refactor formatters in `owner-detail-view.tsx` and reports to leverage `@/lib/companyFormatters.ts`. Remove files from `presentationServiceDebtAllowList`.
  - Deploy the **Tenant Deletion Balance Guard trigger** to prevent contact deletion of active deposit accounts.
  - Wire Split Maintenance Cost Allocation form input with backend RPC `resolve_maintenance_with_expense`.

### 🟣 Phase 4: Long-Term Alignments & Gaps (Months 4–6 / المخطط الاستراتيجي)
* **Objective:** Align structural database identifier types and implement complete Multi-Company tenant isolation.
* **الأهداف:** توحيد أنواع المعرفات بقاعدة البيانات وتعميم الـ RLS وعقد الاستئجار المباشر والمرافق للشركات.
* **Actions / الإجراءات:**
  - Execute database alignment migration, converting `text` primary/foreign keys (in `contracts`, `invoices`, etc.) to native `uuid` columns.
  - Rollout company-isolation `company_id` columns and JWT-scoping for all Tier 1/2 tables and Multi-Currency configurations.
  - Implement Master Lease Obligations schedules and periodic Utility billing workflows.
