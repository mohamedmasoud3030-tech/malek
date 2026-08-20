# AGENT_HANDOFF

> **تاريخ الإغلاق:** 2026-08-20
> **الفرع:** `arena/01a01c75-malek`
> **Implementation HEAD قبل commit وثائق الإغلاق:** `a817b7ca7e316a09d5356677b33d1739e1437e03`
> **حالة Git عند الإغلاق:** نظيفة ومتطابقة مع `origin/arena/01a01c75-malek`
> **الدمج/النشر:** لم يُفتح فرع إضافي، ولم يُفتح PR، ولم يحدث merge أو نشر إنتاجي.

## 1. المنتج والمجال والمستخدمون

- **الاسم المرئي:** MALEK.
- **الغرض:** منصة عربية أولاً وRTL لإدارة مكاتب وأملاك الإيجار: الشركات، العقارات، الوحدات، الملاك، المستأجرون، العقود، التحصيلات، الإيصالات، المصروفات، التأمينات، التسويات، الصيانة، التقارير، الوثائق والحوكمة.
- **نطاق الشركات:** multi-tenant؛ الشركة الفعالة وRLS/RPC هما حدود العزل، ولا تُوثق واجهة العميل كسلطة أمنية.
- **الأدوار الستة:** `ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER`.
- **نماذج التشغيل:** owner-agency/property management، وMASTER_LEASE المنفصل حيث نُفذ واعتمد. خط الأساس المالي OMR بدقة 3 منازل.

## 2. البنية والمسارات المهمة

| المسار | المسؤولية |
|---|---|
| `rentrix-app/src/app/router/route-tree.ts` | تسجيل الطرق والحراس |
| `rentrix-app/src/app/navigation/` | عقد التنقل والظهور حسب الصلاحية |
| `rentrix-app/src/features/auth/permissions.ts` | مصفوفة أدوار/صلاحيات العميل؛ الخادم يظل المرجع |
| `rentrix-app/src/features/ai-assistant/` | واجهة وسياق واختبارات المساعد |
| `supabase/functions/ai-assistant/` + `_shared/` | حدود AI، adapter، validation، fallback |
| `rentrix-app/src/features/help-support/` | مقالات المساعدة وطلب الدعم الداخلي |
| `rentrix-app/src/features/admin-support/` | التحقيق المقنّع وفرز الدعم ومقترحات الوصول غير المنفذة |
| `rentrix-app/src/features/communication/` | سجل التواصل ومعاينات القوالب الآمنة |
| `rentrix-app/src/features/automation/` | قواعد الأتمتة وحالة المهام المتينة |
| `supabase/functions/background-worker/` | عامل الوظائف المحمي؛ لا يختار المستدعي job/company/payload |
| `supabase/migrations/` | الترحيلات forward-only؛ لا تعدّل التاريخ |
| `supabase/rollback/` | rollback يدوي وتحذيري فقط |
| `docs/source-of-truth/` | Canonical Pack وحقيقة التنفيذ |
| `AI_FEATURE_SYSTEM.md` | عقد AI والجودة/الخصوصية/التكلفة |
| `HELP_SUPPORT_SYSTEM.md` | خريطة المساعدة والدعم وrunbook |
| `COMMUNICATION_SYSTEM_SPEC.md` | مصفوفة الأحداث/القنوات والتفضيلات |
| `ADMIN_SUPPORT_OPERATIONS_SPEC.md` | صلاحيات وقيود عمليات الدعم |
| `BACKGROUND_JOB_ARCHITECTURE.md` | الجرد، queue، worker، retry، التشغيل |

**Stack:** React 19 + TypeScript + Vite + TanStack Router/Query + Supabase Auth/Postgres/Storage/Edge Functions + PGlite لاختبار migration replay.

## 3. قرارات هذه الجلسة وسببها

### AI

- الملخصات الرقمية (المتأخرات، التجديدات، اللقطة المالية) أصبحت deterministic؛ النموذج بقي للصياغة الحرة/المسودة فقط.
- adapter محايد للمزود، JSON schema صارم، تحقق مزدوج، zero paid retry، fallback محلي.
- authorization قبل المزود، context allowlist، host allowlist، request UUID، quota/budget يومي.
- **السبب:** منع hallucination والتسريب والتكلفة المكررة؛ لا تغيير live model بلا موافقة.

### المساعدة والدعم

- `/help` يقدم مقالات مهمة قصيرة وبحثاً عربياً ومساعدة سياقية بدلاً من Help Center ضخم.
- طلب الدعم داخلي في Supabase، بلا منصة خارجية أو مرفقات، مع screening للبيانات الخاصة.
- **السبب:** حل المشاكل المتكررة دون نسخ الواجهة أو تصدير بيانات المستخدم.

### الاتصالات

- in-app هو القناة الفعلية الوحيدة؛ email/WhatsApp معاينة محلية؛ SMS/push معطلان.
- أزيلت روابط `wa.me`/`mailto` التي تحمل recipient/content من مسارات المنتج، وأصبحت القوالب عامة بالعربية/الإنجليزية.
- **السبب:** لا مزود/موافقة/ميزانية حية، ومنع البيانات الحساسة في URL/preview/log.

### عمليات الإدارة والدعم

- `/admin-support` أقل صلاحية: MANAGER يفرز الدعم؛ ADMIN فقط يرى بحث مستخدمين مقنّع ويُنشئ access proposal غير منفذ.
- أوقفت browser writes المباشرة على `public.users`؛ لا impersonation/export/bulk/financial action.
- **السبب:** إزالة super-admin عملي ومنع self-lockout/last-admin bypass والتغيير بلا reason/audit.

### الوظائف الخلفية

- أبقيت المالية والعقود والاستيراد الذري والتقارير/المستندات وAI التفاعلي synchronous.
- حُولت automation evaluation إلى durable Postgres queue؛ أضيف worker محمي، lease، idempotency، retry/backoff، DEAD، cancellation، progress، retention.
- أُلغي افتراض cron التاريخي؛ كل schedule جديد `enabled=false` ولا يوجد `cron.schedule` في migration.
- **السبب:** أبسط آلية موثوقة ضمن Supabase الحالي، بلا Queue مدفوعة وبلا background financial side effects.

## 4. العمل المكتمل مع دليل VERIFIED

### الكود/الترحيلات

- `20260901000000_ai_assistant_budget_idempotency.sql`
- `20260902000000_self_service_support_requests.sql`
- `20260903000000_communication_preview_foundation.sql`
- `20260904000000_admin_support_operations_foundation.sql`
- `20260905000000_background_job_foundation.sql`
- rollback يدوي مقابل لكل migration.
- Edge Functions: `ai-assistant`, `background-worker`.
- طرق جديدة: `/help`, `/admin-support`.

### أدلة التحقق المرصودة في هذه الجلسة

| النطاق | الأمر/الدليل | النتيجة |
|---|---|---|
| AI | focused Vitest: service/context/edge/foundation/quota | **26/26 PASS** |
| Help/support | content + DB replay + route/header/mobile tests | **31/31 PASS** في الجولة المجمعة |
| Communication | policy/DB/outbound/automation/notification/action tests | الجولات المركزة PASS؛ آخر مجموعة شاملة ذات صلة **33/33 PASS** |
| Admin/support | capability/DB/UI/route/auth/governance tests | **86/86 PASS** في الجولة الموسعة؛ replay يثبت ACL/masking/idempotency/immutability |
| Background jobs | queue/worker/automation/bank import tests | **29/29 PASS** |
| TypeScript app | `corepack pnpm --filter @workspace/rentrix run typecheck` | PASS، exit 0 |
| TypeScript tests | `corepack pnpm --filter @workspace/rentrix run typecheck:test` | PASS، exit 0 |
| Build | `corepack pnpm --filter @workspace/rentrix run build` | PASS؛ تحذيرات placeholder Supabase وchunk size فقط |
| Docs | `corepack pnpm check:docs` | PASS؛ 161 ملفاً مُصاناً |
| Migration hygiene | `corepack pnpm check:migration-hygiene` | PASS مع legacy warnings معروفة |
| Secret scan | `bash scripts/check-release-secret-leaks.sh` | PASS |
| Enterprise freeze | `corepack pnpm check:enterprise-freeze` | PASS |
| Diff hygiene | `git diff --check` | PASS قبل commits النهائية |
| Git remote | fetch + SHA comparison | local HEAD = remote branch SHA |

لم تُشغّل في الإغلاق أي مجموعة تتجاوز 5 دقائق، ولم تُعد المجموعة الكاملة أو Playwright لأن النتائج المركزة والبناء كانت خضراء ولأن المستخدم منع الاختبارات الأطول من 5 دقائق.

## 5. منفذ لكن غير متحقق حياً — IMPLEMENTED BUT NOT VERIFIED

- تطبيق migrations الخمسة على Supabase hosted.
- نشر Edge Functions وإعداد secrets في staging/Production.
- worker runtime تحت Edge timeout وحجم Production حقيقي.
- Supabase Cron/`pg_net` + Vault invocation للـ worker.
- browser/device acceptance المصادق عليه لـ Help/Admin/Communication/Automation.
- AI model semantic evaluation، latency والتكلفة بمزود معتمد.
- live email provider/webhooks/unsubscribe؛ لا يوجد مزود حي الآن.
- support staffing وSLA فعلي.

## 6. العيوب والمخاطر المعروفة

1. **Production schedules معطلة عمداً:** التاريخي `rentrix-automation-hourly` يُلغى؛ كل schedule جديد disabled. لا تدّع أن reminders تعمل آلياً حتى التفعيل المصرح.
2. **User access execution غير موجود عمداً:** يوجد proposal فقط (`executed=false`). هذا قد يوقف workflow الإدارة القديم لكنه يغلق browser direct-write خطر. يحتاج maker-checker + recent re-auth قبل أي تنفيذ.
3. **Background worker محدود:** الأنواع المدعومة فقط contract expiry / overdue invoices / maintenance overdue + metadata cleanup. لا تضف financial/import/export/AI job type بلا قرار جديد.
4. **Worker deployment unverified:** `verify_jwt=false` مقصود لأن الوظيفة تتحقق من `BACKGROUND_WORKER_SECRET` بنفسها؛ أي سوء إعداد للسر خطر ويجب أن يفشل مغلقاً.
5. **External communication غير مفعلة:** Postmark مجرد مرشح؛ WhatsApp/SMS/push معطلة؛ لا توجد delivery/callback evidence.
6. **AI provider غير معتمد:** OpenAI-compatible adapter موجود، لكن لا privacy/DPA/model-quality/cost evidence حي.
7. **No hosted browser pass:** الوحدة/التكامل والبناء نجحوا، لكن keyboard/screen reader/mobile authenticated acceptance لم يُشغّل في بيئة مستضافة.
8. **Build warnings غير مانعة:** local build استخدم Supabase placeholders؛ Rollup أبلغ عن chunks أكبر من 500 kB وdynamic/static import overlap.
9. **Bank import:** synchronous ومحدود إلى 5 MB و5,000 صف؛ الملفات الأكبر يجب تقسيمها، ولا يوجد resumable background import.
10. **Retention schedules غير مفعلة:** سيظل metadata يتراكم إلى أن تعتمد cleanup schedules؛ لا تحذف business/audit/financial data عبر generic worker.

## 7. قاعدة البيانات والبيئة

- الترحيلات الجديدة forward-only ولم تُطبق حياً في هذه الجلسة.
- `supabase/config.toml` يعرّف `[functions.background-worker] verify_jwt=false` مع مصادقة سر مخصصة؛ لا schedule مفعّل.
- جداول جديدة تشمل AI budgets، support requests/events، communication preferences/outbox، admin-support audit/proposals، background jobs/events/schedules.
- direct authenticated writes أُلغيت عن `public.users` وعن legacy automation job/run/log evidence.
- automation manual execution يضع job في queue؛ worker ينشئ إشعاراً داخلياً aggregate واحداً كحد أقصى.

## 8. المزوّدون ومتغيرات البيئة الآمنة (بدون قيم)

### Supabase

- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_VERSION`
- Edge/server: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Worker: `BACKGROUND_WORKER_SECRET`
- Deployment/QA عند الحاجة: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`, `SUPABASE_READONLY_DB_URL`, `SUPABASE_DB_PASSWORD`

### AI provider (غير مفعل تلقائياً)

- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`
- `AI_PROVIDER_BASE_URL`
- `AI_PROVIDER_ALLOWED_HOSTS`
- `AI_REQUEST_RESERVATION_MICROUSD`
- `AI_COMPANY_DAILY_BUDGET_MICROUSD`
- `AI_USER_DAILY_REQUEST_LIMIT`

### Feature/QA

- `VITE_FEATURE_<NAME>`, `VITE_KILL_<NAME>`, `VITE_E2E`
- `E2E_BASE_URL`, `E2E_ENVIRONMENT_KIND`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_WORKERS`

### External communication

- لا يوجد Postmark/WhatsApp/SMS/push secret في الريبو أو البيئة المطلوبة حالياً.
- Postmark مرشح staging فقط بعد موافقة منفصلة؛ لا تنشئ حساباً أو خطة قبلها.

## 9. أوامر مؤكدة من الريبو

> الـ package manager المثبت في العقد: `pnpm@10.11.1`. في بيئة لا تضع `pnpm` على PATH استخدم `corepack pnpm` كما حدث في هذه الجلسة.

```bash
# Install
corepack pnpm install --frozen-lockfile

# Development / preview
corepack pnpm --filter @workspace/rentrix run dev
corepack pnpm --filter @workspace/rentrix run serve

# Type/lint (lint alias = app typecheck)
corepack pnpm --filter @workspace/rentrix run typecheck
corepack pnpm --filter @workspace/rentrix run typecheck:test
corepack pnpm --filter @workspace/rentrix run lint

# Focused tests (keep under the user's 5-minute ceiling)
corepack pnpm --filter @workspace/rentrix exec vitest run --config vite.config.ts <test-files...>

# Full tests — repository command exists, but was not rerun at closeout
corepack pnpm --filter @workspace/rentrix run test
corepack pnpm --filter @workspace/rentrix run test:financials

# Build
corepack pnpm --filter @workspace/rentrix run build

# Repository guards
corepack pnpm check:docs
corepack pnpm check:migration-hygiene
corepack pnpm test:migration-hygiene
corepack pnpm check:enterprise-freeze
bash scripts/check-release-secret-leaks.sh

# Database/release commands (non-production unless explicitly authorized)
corepack pnpm db0:replay
corepack pnpm db0:gate
corepack pnpm test:supabase
corepack pnpm qa:preflight
corepack pnpm supabase:live-readiness
```

## 10. Deployment/Production status

- Branch pushed only: `arena/01a01c75-malek`.
- لم يُفتح فرع آخر، لم يُفتح PR، لم يحدث merge إلى `main`.
- لا migrations مطبقة على Production، لا Edge Functions منشورة من هذه الجلسة، لا schedules مفعلة.
- لا رسالة/إشعار خارجي حقيقي، لا AI paid usage، لا replay لوظيفة فاشلة حقيقية.
- لا runtime server يعمل داخل sandbox عند الإغلاق.

## 11. موافقات/حسابات/اعتمادات مطلوبة

1. وصول staging Supabase مخول لتطبيق migrations ونشر Edge Functions والتحقق من Auth/RLS.
2. قرار owner منفصل لتقييم AI provider/نموذج وخصوصيته؛ لا بيانات خاصة قبل ذلك.
3. قرار owner منفصل لتقييم Postmark staging بعناوين اصطناعية فقط.
4. قرار owner لتصميم access-change execution maker-checker/re-auth؛ Production execution يبقى معطلاً.
5. قرار owner لتفعيل pilot background schedules لشركة واحدة بعد staging evidence.
6. `BACKGROUND_WORKER_SECRET` قوي في Secret Manager، وخطة تدوير؛ لا قيمة في chat/repo.

## 12. الخطوات الثلاث التالية ذات الأولوية

### 1) Hosted staging foundation verification

**المعيار:** تطبيق migrations `20260901`–`20260905` بالترتيب على staging مخول؛ نشر `ai-assistant` و`background-worker`؛ إثبات RLS لشركتين ورفض normal user/manager حسب المصفوفة؛ كل schedules تظل disabled؛ لا provider calls ولا بيانات حقيقية.

### 2) Authenticated browser + worker acceptance باستخدام synthetic data

**المعيار:** desktop/mobile/RTL/keyboard لـ `/help`, `/admin-support`, Communication Center, Automation؛ enqueue/claim/process/cancel/retry/DEAD لوظائف صناعية؛ صفر financial jobs وصفر external sends؛ logs metadata-only؛ worker secrets غير ظاهرة.

### 3) Owner go/no-go لطيار إنتاج محدود

**المعيار:** موافقة مسجلة لتفعيل شركة واحدة فقط لـ internal aggregate automation وAI/job metadata cleanup؛ Supabase Cron/`pg_net` يستدعي worker من Vault؛ alerts للـ DEAD/lease/lag؛ rollback مجرب بتعطيل schedule/invocation؛ external delivery وuser-access execution يظلان disabled.

## 13. تحذيرات: تغييرات لا يجب الكتابة فوقها

- لا تعدّل migrations التاريخية؛ أضف forward migration فقط.
- لا تعيد `users_admin_write` أو browser direct update على `public.users`.
- لا تضف impersonation/backdoor/service key إلى المتصفح.
- لا تعرض support descriptions أو payloads أو recipient/content في URL/log/notification preview.
- لا تعيد `wa.me`/`mailto` handoffs التي تحمل بيانات العقد/الإيصال.
- لا تحول financial/destructive work إلى generic background jobs.
- لا تعيد تشغيل `rentrix-automation-hourly` أو تضف `cron.schedule` بلا موافقة.
- لا تجعل schedule seed مفعلاً افتراضياً.
- لا تعيد raw SQL/provider errors إلى run logs أو UI.
- لا تسمح retry غير محدود أو تغيير DEAD إلى QUEUED؛ replay = job جديد بعد مراجعة.
- لا ترفع AI/communication/job budgets أو تفعّل provider بلا owner approval.
- لا تدمج هذا الفرع أو تفتح فرعاً/PR جديداً ضمن هذا الإغلاق.
