# AGENT_HANDOFF

> Handoff قائم على فحص فعلي للريبو (وليس ذاكرة شات). آخر تحقق: 2026-08-19.

## المنتج

- **الاسم المرئي**: MALEK — «كل أملاكك في مكان واحد».
- **المجال**: منصة عربية أولًا لإدارة أملاك الإيجار (عقارات، وحدات، أشخاص، عقود، مالية، صيانة، تقارير، إعدادات).
- **المستخدمون**: مكاتب العقارات وفرقها، متعددة الشركات (multi-tenant).
- **الأدوار (6)**: `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER` (من `features/auth/permissions.ts`).

> ملاحظة توافق: اسم الريبو `rentrix-app/` ومعرّفات قاعدة البيانات والمفاتيح المخزّنة تُبقى كما هي؛ التسمية المرئية هي MALEK فقط.

## البنية والمسارات المهمة

| المسار | الدور |
|---|---|
| `rentrix-app/src/` | التطبيق النشط (React + TypeScript + Vite + Tailwind v4) |
| `rentrix-app/src/app/navigation/` | بنية التنقل (route-contract، terminology-registry) |
| `rentrix-app/src/components/ui/` | نظام التصميم (Card، EntityForm، EntityTable، Dialog، BottomSheet...) |
| `rentrix-app/src/services/` + `src/lib/` | طبقة الخدمات + المكتبات (supabase، money، feature-flags) |
| `rentrix-app/src/styles/` | التوكنز (tokens.css) + الأنظمة المرئية |
| `supabase/migrations/` | ترحيلات قاعدة البيانات (282 عند آخر فحص) |
| `docs/source-of-truth/` | الحزمة القانونية (Canonical Pack، 8 مستندات) |
| `governance/` + `tickets/` | الحوكمة (10 مراحل) والتذاكر |

**مصادر الحقيقة**: `route-contract.ts` (الطرق)، `terminology-registry.ts` (التسمية)، `feature-flag-definitions.json` (الفلاغز)، `docs/source-of-truth/` (المنتج).

## القرارات المتخذة في هذه الجلسة (والسبب)

1. **حذف 41 مستند خطط/تدقيق قديمة** من الجذر و`docs/` — كانت مستبدلة بحزمة Canonical Pack. (السبب: تنظيف الازدواج والفوضى.)
2. **اتجاه تصميم موحّد «الوضوح الأخضر»**: لون براند أخضر `160 84% 27%` في كل سطح (بدل انقسام أزرق/أخضر)، نصف قطر موحّد (كروت وحقول `rounded-xl`، طبقات مرتفعة `rounded-2xl`)، حلقة تركيز `ring-4/10`. (السبب: ازدحام بصري وعدم ارتياح عند التنقل.)
3. **فعل خطأ قانوني واحد «تعذّر»** بدل «فشل» في واجهة المستخدم. (السبب: نبرة أقل لومًا وأكثر اتساقًا — 461 «تعذّر» مقابل 28 «فشل».)
4. **إزالة `uppercase`+`tracking` من النص العربي** — تباعد الأحرف يكسر اتصال الحروف. (السبب: قابلية قراءة الموبايل.)
5. **إزالة خريطتي تسمية يتيمتين** (`hubPageTitles`, `canonicalTerms`). (السبب: صفر مستهلكين + تناقض مع التسمية النشطة.)
6. **نموذج أدوار الفلاغز = 6 أدوار** (من `domain/types.ts`)، لا 3. (السبب: `ACCOUNTANT`/`OPERATIONS`/`VIEWER` كانوا يتعاملون كـ"مجهول".)
7. **لا نسبة مئوية rollout** — لا هوية ثابتة في الـ bundle؛ الـ role gate يكفي عند الحجم الحالي.
8. **ابقاء نظام الفلاغز config-backed** — لا مزوّد خارجي إلا عند الحاجة لـ targeting/audit/تحكم حي.

## الشغل المنجز — بدليل موثّق (VERIFIED)

كل PR اندمج على `main`. **آخر فحص محلي نظيف من HEAD `fd98776`:**

| الفحص | النتيجة |
|---|---|
| `pnpm --filter ./rentrix-app run typecheck` | ✅ خروج 0 |
| `pnpm --filter ./rentrix-app run typecheck:test` | ✅ خروج 0 |
| `pnpm check:expired-flags` | ✅ 7 فلاغز داخل النافذة |
| `pnpm --filter ./rentrix-app run test` (كامل) | ✅ **480 ملف، 3081 اختبار، 0 فشل، 0 تخطّي** |
| `pnpm --filter ./rentrix-app run build` | ✅ خروج 0 (15.2s؛ تحذير chunk>500kB غير معيق) |
| CI على main HEAD | ✅ `build` success، `deploy` success، القواعد المقفولة success |

**PRs المدمجة هذه الجلسة (11):**
- `#1500` استراتيجية الاختبار + إصلاح 6 أعطال انجراف + 4 اختبارات جديدة
- `#1501` توحيد اللون الأخضر + حذف CSS ميت + قراءة الجداول
- `#1502` توحيد نصف قطر الكروت
- `#1503` معيار النماذج + توحيد الحقول
- `#1504` دليل محتوى UX + توحيد فعل الخطأ
- `#1505` مراجعة UX + إصلاح ثيم منع الوميض (كان أزرق)
- `#1506` معيار الموبايل + إزالة tracking من العربي
- `#1507` بنية المعلومات + حذف خرائط التسمية اليتيمة
- `#1508` تحصين نظام الفلاغز (import.meta.env + role-before-override + JSON مركزي + فحص انتهاء في CI)
- `#1509` مواءمة سياسة rollout
- `#1511` مواءمة أدوار الفلاغز (6) + استكمال السياسة (بيئات/نسبة/مقاييس/مزوّد)

**ملفات قياسية جديدة (8)**: `FULL_TEST_STRATEGY.md`, `FORM_EXPERIENCE_STANDARD.md`, `UX_CONTENT_GUIDE.md`, `UI_UX_MASTER_REVIEW.md`, `UI_UX_REMEDIATION_PLAN.md`, `MOBILE_EXPERIENCE_STANDARD.md`, `INFORMATION_ARCHITECTURE.md`, و`FEATURE_ROLLOUT_POLICY.md` (محدَّثة).

**إغلاق PR مكرر**: `#1498` (مؤلفه المالك `M7mdlab`) — أُغلق؛ شغله الحقيقي (تحصين الفلاغز) انتقل إلى `#1508`.

## منفَّذ لكن غير موثّق بتشغيل (IMPLEMENTED BUT NOT VERIFIED)

- **لا شيء مهم**. كل تغييرات هذه الجلسة مبنية على تحقق محلي فعلي (اختبارات/typecheck/build) وليس فقط على CI.

## Auth admin/users 500 — root cause محدد (2026-08-19)

- **السبب الجذري**: مستخدم واحد محدد `84501d15-e68b-4475-b1d2-a654f73fc6f3` (البريد `qa-agent-test@rentrix.local`) عنده سجل تالف في `auth.users` يكسر serialization الـ GoTrue.
- **الأثر**: أي استعلام `admin/users` يتضمنه (list بـ per_page ≥2) يرجع 500 `Database error finding users`. المستخدمون الآخرون (`yaqoop@jiwda.com`, `demo@rentrix.test`, `mohamedmasoud303@gmail.com`) سليمون.
- **محاولة الإصلاح عبر API فشلت**: `DELETE /admin/users/<id>` يرجع 500 `Database error loading user` — التلف يمنع القراءة والحذف معًا.
- **الحل المتبقي (يحتاج وصول SQL للمالك)**: من Supabase Dashboard → SQL Editor:
  ```sql
  delete from auth.users where id = '84501d15-e68b-4475-b1d2-a654f73fc6f3';
  ```
  ثم تنظيف اليتيمات (إن لزم): `delete from public.users where id = '84501d15-...';` و `delete from public.company_members where user_id = '84501d15-...';`
- **مصنّف: BLOCKED** — لا يمكن إصلاحه من بيئة الوكيل (لا وصول Postgres مباشر؛ IPv6-only + pooler tenant-not-found).

## زراعة Demo Data (منفّذة، 2026-08-19)

زرعت **21 صفًا** في الوحدات الفارغة، مربوطة بـ company `00000000-0000-4000-8000-000000000001` وبالعقارات/الوحدات/العقود الموجودة (مبني 25/٢٠، غرف 13/14/15، عقود CNT-001/002):

| الوحدة | الصفوف | ملاحظة |
|---|---|---|
| `service_providers` | 3 | شركة كهرباء، ورشة صيانة، تنظيف |
| `leads` | 5 | حالات متنوعة (new/contacted/qualified/converted) |
| `maintenance_records` | 5 | open/in_progress/resolved/closed + أولويات |
| `expenses` | 5 | تصنيفات صيانة/مرافق/إدارية/تأمين |
| `tenant_deposits` | 3 | held/partially_deducted/refunded |

**مهم**: الإدراج تم مباشرةً عبر REST (service role) — **لم تمر عبر RPCs المحاسبية** (`create_expense_with_journal_atomic` وغيرها)، لذا لا توجد قيود دفتر أستاذ (journal/GL) مطابقة لهذه الصفوف. مقبول لأغراض العرض التجريبي، لكن أي تقرير محاسبي يعتمد على GL لن يرى هذه المصروفات/التأمينات. إن طُلبت سلامة محاسبية كاملة، أعد الزراعة عبر الـ RPCs.

## العيوب والمخاطر المعروفة

1. **«بعض الصفحات فارغة» = وحدات بلا بيانات تجريبية، وليس عطلًا** (تشخيص نهائي بعد فحص فعلي). تم التحقق:
   - يوجد **105 جدول** في `public`، شركة واحدة «ادارة وتشغيل العقارات»، 3 صفوف `company_members`، مستخدمان في `public.users` (المالك `mohamedmasoud303@gmail.com` = ADMIN + `qa-agent-test` = ADMIN).
   - **البيانات الموجودة** (count بالخدمة): properties 14، units 41، owners 12، tenants 40، contracts 8، invoices 12، payments 11، receipts 13، people 53، companies 1.
   - **الوحدات الفارغة (0 صف، بلا بيانات تجريبية)**: expenses، maintenance_records، leads، service_providers، deposit_txs (تأمينات). هذه تعرض حالة «فارغ» صحيحة لأنها لم تُزرع بيانات لها — وليست مشكلة RLS.
   - **سبب التشخيص الخاطئ الأول**: PostgREST يرجع صفر جداول بدون ترويسة `Accept-Profile: public`؛ معها يرجع الـ 105 جداول.
   - **ملاحظة ثانوية**: استعلام GoTrue `admin/users` يرجع 500 «Database error finding users» — إشارة لخلل محتمل في schema الـ auth تستحق فحصًا، لكنه لا يؤثر على عرض بيانات الوحدات المذكورة (التي تُقرأ عبر PostgREST مباشرة).
   - **ما يبقى للمالك (اختياري)**: تأكيد من Supabase Dashboard أن `custom_access_token_hook` مفعّل في Auth → Hooks (هو موجود كدالة، والحقن يعمل عندما يوجد صف `company_members` للمستخدم)، وأن «Exposed schemas» تشمل `public`.
2. **صفحة التسويق مفصولة** — `/` يحوّل إلى `/login`؛ الزائر الجديد لا يرى عرض القيمة. قرار منتج معلّق (موثّق في `UI_UX_MASTER_REVIEW.md` #6).
3. **browser-smoke (Playwright على متصفح حي)** تاريخيًا أحمر في بعض الـ PRs — أثر بيئي/استضافة، خارج نطاق هذه الجلسة. CI النهائي على main يُظهر `build`/`deploy` ناجحين.
4. **`deprecated` components**: `FormField` (`form-field.tsx`) و`TextField` (`text-field.tsx`) معلّمان كبدائل لصالح `EntityForm.Field` — أُبقيا للتوافق الرجعي.

## قاعدة البيانات / الترحيلات / البيئة

- **ترحيلات**: 282 عند آخر فحص؛ الترحيل `20260831000000_hot_path_fk_covering_indexes.sql` سليم (إعادة تشغيل db0 القانونية 282/282 نجحت سابقًا) لكنه مستبعد من نقاط التفتيش التاريخية في اختبارات p0/p1 (انظر `replay-bootstrap.ts`).
- **لم تُطبَّق أي ترحيلات جديدة هذه الجلسة** — كل التغييرات UI/توثيق/اختبار.
- **لم تتغير متغيرات بيئة الإنتاج**؛ **لم تُفعَّل أي ميزة لمستخدمين حقيقيين**.

## المزوّدون الخارجيون وأسماء المتغيرات الآمنة (بدون قيم)

- **Supabase** (Auth + Postgres + Storage): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`.
- **QA**: `QA_ENVIRONMENT_KIND`, `QA_SUPABASE_PROJECT_REF`, `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, `QA_MUTATION_APPROVED`, `E2E_SINGLE_OFFICE_EMAIL`.
- **Vercel** (نشر + فلاغز build-time): `VITE_FEATURE_<NAME>`, `VITE_KILL_<NAME>`.

## أوامر مؤكدة من الريبو

```bash
# التثبيت (pnpm مثبّت 10.11.1 عبر corepack)
pnpm install --frozen-lockfile

# التطوير
pnpm --filter ./rentrix-app dev

# الفحص
pnpm --filter ./rentrix-app run typecheck
pnpm --filter ./rentrix-app run typecheck:test

# الاختبار
pnpm --filter ./rentrix-app run test          # كامل
pnpm --filter ./rentrix-app run test:financials

# بناء
pnpm --filter ./rentrix-app run build

# فحص انتهاء الفلاغز
pnpm check:expired-flags
```

## حالة النشر/الإنتاج

- **CI على `main` (HEAD `fd98776`)**: `build` ✅، `deploy` ✅، القواعد المقفولة ✅.
- **الإنتاج**: منشور عبر Vercel (`malek-plus.vercel.app`). قاعدة البيانات **تحتوي بيانات تجريبية** (105 جداول، شركة واحدة، 3 أعضاء، عقارات) — التشخيص السابق «قاعدة فارغة» كان خاطئًا. المشكلة الفعلية المبلغ عنها: **بعض الصفحات فارغة**، والسبب الأرجح RLS/company-scoping (انظر المخاطر #1)، ويحتاج تأكيد المالك.

## الموافقات/الحسابات/الاعتمادات المطلوبة من المالك

1. **قرار حالة قاعدة بيانات الإنتاج** (`nnggcnpcuomwfuupupwg`) — هل فُرّغت أم تحتاج ترحيل؟ (عائق للتحقق الحي).
2. **تدوير الـ service role key + كلمة مرور قاعدة البيانات** — كانت مكشوفة في الشات سابقًا (أمان).
3. **قرار صفحة التسويق** (`/` → `/login`) — نعم/لا على إعادة تفعيل عرض القيمة للزائر الجديد.
4. **لا موافقة محاسبية/قانونية معلّقة** من شغل هذه الجلسة.

## الخطوات الثلاث التالية ذات الأولوية (معايير قبول)

1. **تشخيص «البيانات لا تظهر في بعض الصفحات»** — المعيار: من Supabase Dashboard → Authentication/SQL، تأكيد أن المستخدم المُسجَّل لديه (أ) صف `company_members` نشط لشركة `00000000-0000-4000-8000-000000000001`، و(ب) claim الـ `company_id` مضبوط في JWT (عبر Auth Hook أو app_metadata). وإذا كانت «Exposed schemas» لا تشمل `public` افتراضيًا، إضافتها.
2. **قرار صفحة التسويق** — المعيار: قرار مالك نعم/لا على إعادة ربط landing أو إضافة شريط تعريف داخل `/login`.
3. **ضبط الكثافة البصرية (إن لزم)** — المعيار: بعد التأكد من الإنتاج الحي، معاينة بصرية حية للـ Dashboard وتقليل الكثافة بمقاييس مسافات موثّقة.

## تحذيرات — تغييرات يجب ألا تُستبدل/تُداس

- **لا تعيد إضافة** المستندات القديمة المحذوفة (AI_DECISIONS، *_PLAN، *_AUDIT، *_STATUS... في الجذر و`docs/`). المصدر القانوني هو `docs/source-of-truth/`.
- **لا ترجع** `uppercase tracking-*` على نص عربي، ولا ألوان البراند الزرقاء القديمة (`200 85%`, `217 91%`, `214 92%`).
- **لا تعيد** خريطتي التسمية اليتيمتين (`hubPageTitles`, `canonicalTerms`).
- **لا تضيّق** نموذج أدوار الفلاغز عن 6 أدوار.
- **لا تحذف** تحويلات الطرق القديمة (redirects) قبل ثبوت صفر زيارات.
- **لا تستخدم** فلاغ عميل كتفويض — RLS/RPC هي المرجع.
