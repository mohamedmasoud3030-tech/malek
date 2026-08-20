# AGENT_HANDOFF

> Handoff قائم على فحص فعلي للريبو (مش ذاكرة شات). آخر تحقق: 2026-08-19.

## المنتج

- **الاسم المرئي**: MALEK — «كل أملاكك في مكان واحد».
- **المجال**: منصة عربية أولًا لإدارة أملاك الإيجار (عقارات، وحدات، أشخاص، عقود، مالية، صيانة، تقارير، إعدادات).
- **المستخدمون**: مكاتب العقارات وفرقها، متعددة الشركات (multi-tenant).
- **الأدوار (6)**: `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER` (من `features/auth/permissions.ts`).

> ملاحظة توافق: اسم الريبو `rentrix-app/` ومعرّفات قاعدة البيانات تُبقى كما هي؛ التسمية المرئية MALEK فقط.

## البنية والمسارات المهمة

| المسار | الدور |
|---|---|
| `rentrix-app/src/` | التطبيق (React + TS + Vite + Tailwind v4) |
| `rentrix-app/src/app/navigation/` | التنقل (route-contract، terminology-registry) |
| `rentrix-app/src/components/ui/` + `components/layout/` | نظام التصميم (Card، EntityForm، EntityTable، EntityDetailHeader، PageLayout، BottomSheet…) |
| `rentrix-app/src/features/*/` | وحدات الأعمال (dashboard، properties، contracts، financials…) |
| `rentrix-app/src/styles/` | tokens.css + الأنظمة المرئية |
| `supabase/migrations/` | الترحيلات (baseline canonical في `20260901000000_canonical_baseline.sql`) |
| `docs/source-of-truth/` | الحزمة القانونية (8 مستندات) |
| `governance/` + `tickets/` | الحوكمة (10 مراحل) والتذاكر |

**مصادر الحقيقة**: `route-contract.ts` (الطرق)، `terminology-registry.ts` (التسمية)، `feature-flag-definitions.json` (الفلاغز)، `docs/source-of-truth/` (المنتج).

## القرارات المتخذة هذه الجلسة (والسبب)

1. **الهوية الزرقاء MALEK** (رجوع من الأخضر): أزرق راقٍ `217 71% 45%` (فاتح) / `213 82% 64%` (غامق) + توهج ambient مقيد في الوضع الداكن.
2. **Bottom-sheet navigation** للموبايل بدل drawer جانبي + إزالة الهامبرغر المكرر + Control Center سفلي.
3. **توحيد الـ status tones** على الـ semantic palette (`success/warning/danger/info/neutral`) — أزال تناقض "نفس الحالة بألوان مختلفة" اللي كان بيخلّي الصفحات تبان من تطبيقات مختلفة.
4. **OMR فقط** — إزالة hardcode الـ EGP.
5. **إزالة ازدواج المؤشرات/الأزرار** في 6 شاشات (Dashboard, Properties, Owners, Maintenance, Units, Contracts).
6. **AI assistant كـ panel عائم persistent** مش full page.

## الشغل المنجز — بدليل موثّق (VERIFIED)

**المدمج على `main`** (~26 commit): الهوية الزرقاء، bottom-sheet، OMR، توحيد الألوان، إزالة الازدواج، الـ AI panel، login redesign، جدولة الجداول، RTL typography، والـ standards (MOBILE_EXPERIENCE_STANDARD، UX_CONTENT_GUIDE، UI_UX_MASTER_REVIEW، INFORMATION_ARCHITECTURE، FORM_EXPERIENCE_STANDARD، FEATURE_ROLLOUT_POLICY).

**على الفرع المعزول `arena/frontend-redesign-isolated`** (8 commits، PR #1517 draft):
- Dashboard KpiGrid فريد غير مكرر
- إزالة ازدواج المؤشرات في Properties/Owners/Maintenance/Units/Contracts
- توحيد status/state tones على semantic palette
- `RTL_ACCESSIBILITY_STANDARD.md` (جديد)

**آخر تحقق محلي** (من الفرع المعزول @ `4afbb5a5`):
- `typecheck` ✅ خروج 0
- `build` ✅ خروج 0
- اختبارات مركّزة ✅ 15/15 (contracts + units + status)
- **Chromium walkthrough**: صفر overflow أفقي على 360/390/430، RTL صحيح، OMR فقط، Tab/Enter/focus سليم

## منفَّذ لكن غير موثّق بتشغيل حي

- **الـ final integration** للفرع المعزول (rebase على main بعد اكتمال الـ database rebuild + walkthrough نهائي ضد القاعدة المستقرة + merge). معلّق لأن الـ database agent كان شغال بالتوازي.

## العيوب والمخاطر المعروفة

1. **10 اختبارات contracts فاشلة (migration-contract tests)** — كانت بتشير لملفات ترحيلات (`20260730091200_contract_workflow_invariants.sql` وغيرها) الـ database agent شالها في الـ "canonical baseline" refactor. **في نطاق الـ database agent** مش نطاقي. (تحتاج إعادة تحقق بعد دمج الـ rebuild — آخر ما رأيته `#1519 regenerate database types`).
2. **`rpt_dashboard_snapshot`** كان غائبًا من الـ live DB (PGRST202) — الـ database agent أعاد البناء؛ تحتاج إعادة تحقق.
3. **browser headless** يحتاج مكتبات نظام (`libnspr4 libnss3 libatk libgbm …`) مش مثبّتة افتراضيًا في الساندبوكس.

## قاعدة البيانات / الترحيلات / البيئة

- **لم ألمس أي ملف database/migration/SQL/RPC/types/env** في كل الجلسة (Frontend فقط، حدود صارمة).
- الـ database agent (موازي) نفّذ: `canonical database baseline` + `regenerate database types` + تقييد `invoice status helper`.

## المزوّدون وأسماء المتغيرات الآمنة (بدون قيم)

- **Supabase**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`.
- **QA**: `QA_ENVIRONMENT_KIND`, `QA_SUPABASE_PROJECT_REF`, `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, `QA_MUTATION_APPROVED`.
- **Vercel** (نشر + فلاغز build-time): `VITE_FEATURE_<NAME>`, `VITE_KILL_<NAME>`.

## أوامر مؤكدة من الريبو

```bash
pnpm install --frozen-lockfile            # التثبيت (pnpm 10.11.1)
pnpm --filter ./rentrix-app dev           # التطوير
pnpm typecheck                            # tsc -b + typecheck
pnpm lint                                 # lint
pnpm test                                 # كل الاختبارات
pnpm --filter ./rentrix-app run test      # اختبارات الواجهة
pnpm --filter ./rentrix-app run build     # build إنتاج
pnpm check:expired-flags                  # فحص انتهاء الفلاغز
```

## حالة النشر/الإنتاج

- **origin/main**: `bff391e2` (database agent دمج #1519 regenerate types).
- **الفرع المعزول**: `4afbb5a5` (PR #1517 draft — **DO NOT MERGE** حتى اكتمال الـ database stabilization).
- **الإنتاج**: منشور عبر Vercel؛ الـ database rebuild اكتمل (تحتاج إعادة تحقق حي).

## الموافقات/الحسابات المطلوبة من المالك

1. **موافقة نهائية على دمج الـ frontend redesign** بعد التأكد من استقرار القاعدة (Yes/No).
2. (اختياري) تدوير الـ service role key السابق.

## الخطوات الثلاثة التالية ذات الأولوية

1. **Rebase الفرع المعزول على main الجديد** — المعيار: صفر تعارض + الحفاظ على نسخة الـ database agent لكل ملفات الـ data + typecheck/build ناجح.
2. **Final browser walkthrough** ضد القاعدة المستقرة — المعيار: كل الشاشات (Dashboard, Properties, Units, Contracts, People, Maintenance, Invoices, Receipts, Expenses, Arrears, Reports) تعرض بيانات + OMR + RTL صحيح.
3. **Merge الـ PR #1517** — المعيار: كل الفحوصات خضرا + صفر ملفات database في الـ diff.

## تحذيرات — تغييرات يجب ألا تُستبدل/تُداس

- **لا ترجع** الألوان القديمة (الأخضر `160`، الأزرق `217/214` القديم) — الهوية الحالية أزرق MALEK.
- **لا ترجع** `uppercase`/`tracking` على عربي.
- **لا ترجع** الـ status tones القديمة (legacy `blue/green/gold/gray`) — الموحّد semantic.
- **لا ترجع** الهامبرغر المكرر أو الـ drawer الجانبي للموبايل.
- **لا ترجع** hardcode الـ EGP.
- **لا تحذف** تحويلات الطرق القديمة.
- **لا تلمس** ملفات الـ database agent (supabase/، migrations، types/database.ts، RLS، RPC).
