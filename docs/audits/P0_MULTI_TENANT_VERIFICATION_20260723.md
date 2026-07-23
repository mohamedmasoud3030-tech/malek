# P0 — تقرير التحقق متعدد الشركات (مرحلي — 2026-07-23)

> **الحالة:** مرحلة إثبات وتحقق قيد التنفيذ على فرع `agent/p0-multi-tenant-verification`.
> هذا الملف يوثّق ما ثبت **سلوكيًا** حتى لحظته على قاعدة معزولة (PGlite، إعادة تشغيل 152/152 هجرة).
> لا يمثل تغييرًا في الإنتاج. الأرقام أدناه من بيانات اختبارية مرقّمة (شركة A: 1000/200، شركة B: 6000/900/8000).

## ١) تأكيدات سلوكية مثبتة (قبل أي إصلاح)

| # | الفحص | النتيجة على main | الحكم |
|---|---|---|---|
| T1 | `rpt_cash_flow` كمستخدم شركة A | receipts=**7000** (=A+B)، expenses=**1100** | 🔴 تسرب تجميعي بين الشركات |
| T2 | `rpt_dashboard_overview` كشركة A | collected=**7000**، properties=**2**، units=**2**، contracts=**2** | 🔴 تسرب — وهذه لوحة الإنتاج اليوم |
| T3 | `rpt_daily_collection` كشركة A | total=**7000** | 🔴 تسرب |
| T4 | `rpt_owner_statement` (مالك A) | gross=1000، fee=100 (10%)، net=900 | ✅ مضبوط النطاق والحساب |
| T5 | سياسات RLS على الجداول المالية | كلها دور-فقط بلا مرشّح شركة (`is_app_user()` / `is_admin_or_manager()`)؛ قراءة payments كشركة A أعادت **2** صفًا (الشركتان) | 🔴🔴 طبقة RLS نفسها غير معزولة |
| T6 | `create_owner_settlement_draft_atomic` بمبالغ مصطنعة (999,999) على مالك A | success، net_payable=999999 | 🔴 ثقة بأرقام العميل (توثيق فقط — الإصلاح في P1) |
| T7 | نفس الدالة على **مالك شركة B** من مستخدم شركة A | **success — أُنشئت مسودة بلا أي تحقق ملكية-شركة** | 🔴🔴 خرق عزل كتابة |
| T8 | نفس الدالة بدور USER (شركة B) | مرفوض: «ADMIN or MANAGER role is required» | ✅ فحص الدور يعمل — الأدوار المتأثرة: ADMIN وMANAGER |
| T9 | `record_invoice_payment_atomic` على فاتورة شركة B | مرفوض (تعطّل عبر قيد NOT NULL في `contract_balances`) | ✅ محجوب (برسالة داخلية — ملاحظة تحسين) |
| T10 | تنفيذ `rpt_cash_flow` بدور anon | «permission denied» | ✅ REVOKE/GRANT فعّال |
| T11 | `rpt_trial_balance/income_statement/balance_sheet/vat_return/financial_summary` | بلا اشتقاق شركة في أحدث تعريف (ساكن) — نفس فصيلة التسرب المثبت سلوكيًا في T1–T3 | 🔴 مؤكد |
| T12 | `rpt_owner_statement/tenant_statement/aged_receivables/overdue_invoices/rent_roll` | بلا اشتقاق شركة (ساكن)؛ نطاقها المُعامِلي يحدّ الانكشاف لكنها تقرأ بلا مرشّح شركة | 🟠 مؤكد ساكنًا |

## ٢) نتائج كانت افتراضات وتحققت/انتهت

- ✅ **معتمد الآن:** `owner_agreements` **بلا عمود `company_id`** في المخطط الفعلي (سياساتها دور-فقط أيضًا) — ثغرة عزل هيكلية.
- ✅ **معتمد الآن:** `record_invoice_payment_atomic` لا يشتق الشركة بنفسه؛ يفوّض إلى `post_receipt_atomic` (محصّن) — والكتابة العابرة محجوبة فعليًا (T9).
- ❎ **سقط افتراض** «هجرات 20260722/23 أكملت عزل كل شيء» — غطّت مسار الكتابة فقط؛ التقارير وRLS بقيا مفتوحين.

## ٣) نطاق إصلاح P0 المقترح (هجرة واحدة + rollback + عقد اختبار)

1. **F-RLS:** إعادة بناء سياسات الجداول المالية/Core بإضافة `company_id = public.current_company_id()` مع الحفاظ على بوابات الأدوار؛ إضافة عمود `owner_agreements.company_id` (إضافي + تعبئة رجعية من `owners`) وسياسة معزولة. (لا حذف بيانات — إعادة إنشاء سياسات فقط.)
2. **F-RPT:** `CREATE OR REPLACE` لدوال التقارير الـ13: اشتقاق `v_company_id` من JWT + رفض NULL + إضافة مرشّح الشركة لكل مصدر بيانات، دون تغيير أي منطق آخر (بوابة parity رقمية إلزامية).
3. **F-SET:** إضافة تحقق ملكية الهدف (`owners`/`properties` يخصان شركة المستدعي) في `create_owner_settlement_draft_atomic` وإخوته (approve/pay/cancel) — دون لمس دلالات المبالغ (مرجأة إلى P1 موثقة).

## ٤) ما تبقى لإغلاق P0

- [ ] كتابة هجرة الإصلاح `20260724xxxxxx_p0_company_isolation.sql` + سكربت rollback + اختبار عقد الهجرة.
- [ ] إعادة تشغيل جناح `p0-multi-tenant-isolation.test.ts` بعد الإصلاح: عزل أخضر + parity أحادي-الشركة مطابق.
- [ ] بوابات CI المحلية: typecheck/lint/tests/build + توثيق بوابات CI-فقط (Docker replay، e2e staging).
- [ ] قرار GO/NO-GO نهائي إلى P1.

## ٥) أدلة قابلة لإعادة التوليد (في هذا الفرع)

`evidence/p0/{inventory, rpc-security-matrix, behavioral-isolation, replay-coverage, rls-policy-dump, grant-catalog, fixture-*}` + سكربتات `scripts/p0/*` + أجنحة `rentrix-app/src/p0/*`.

إعادة التشغيل: `node scripts/p0/inventory.mjs && node scripts/p0/rpc-security-matrix.mjs && pnpm --filter @workspace/rentrix exec vitest run src/p0/`
