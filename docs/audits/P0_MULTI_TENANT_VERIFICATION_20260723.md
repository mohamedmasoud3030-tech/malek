# P0 — التحقق من عزل المستأجرين (Multi‑Tenant Isolation) والتشديد

- التاريخ: 2026‑07‑23 → 2026‑07‑24 (إغلاق)
- الفرع: `agent/p0-multi-tenant-verification` — PR **#1276**
- نطاق P0 المعتمد: إثبات/إصلاح ثغرات كسر عزل الشركة أو تسريب البيانات **فقط**. لا P1 (أرقام التسوية الموثوقة من العميل) داخل هذا الفرع.

## ٠) مستوى الإثبات (تعريف دقيق — مطبّق على كل نتيجة في هذا التقرير)

> **Confirmed against a full isolated replay of the production migration chain; production applicability is high, live verification pending CI/read‑only transactional probe.**

كل نتيجة «مؤكدة» هنا تعني النص أعلاه حرفيًا: السلسلة الكاملة لهجرات الإنتاج (152/152 بلا أي فشل) أُعيد تنفيذها على PostgreSQL معزول (PGlite)، والاختبارات رُكّضت تحت دور `authenticated` **غير مالك للجداول ودون BYPASSRLS** بمطالبات JWT ثابتة (`app_metadata.company_id`) كما يفعل خطاف المصادقة الحقيقي. الإثبات الحي على Supabase يتم عبر بوابة CI الحية (supabase-live-readiness بأسرار CI) أو فحص قراءة‑فقط داخل `BEGIN/ROLLBACK` بدور مستخدم واقعي لشركة A — ولا ادعاء بغير ذلك.

## ١) هوية جلسة الاختبار (إثبات إلزامي قبل أي حكم)

المصدر: `evidence/p0/cause/session-identity.json`

| البند | القيمة |
|---|---|
| `current_user` | `authenticated` |
| `session_user` | `postgres` (تبديل دور، وليس مستخدم اتصال) |
| `current_setting('request.jwt.claims')` | `{"sub":ADMIN_A,"role":"authenticated","app_metadata":{"company_id":"COMPANY_A"}}` |
| `auth.uid()` (مباشر) | ADMIN_A ✔ |
| `public.current_company_id()` | COMPANY_A ✔ |
| `rolsuper` / `rolbypassrls` | false / false |
| يملك الجداول؟ | لا (`pg_get_userbyid(relowner) <> current_user`) |

وبالتماثل اُختبرت هويتا: مدير شركة B (JWT لشركة B)، مستخدم **بلا عضوية شركة**، ودور `anon`.

## ٢) الثغرات المؤكدة سببيًا (قبل الإصلاح) — بجدول السبب الكامل

لكل بند: الجدول/السياسة المسببة، الدور+JWT، استعلام الإنتاج، المتوقع مقابل الفعلي، والحكم البيئي. المصدر: `evidence/p0/cause/operation-matrix.json`, `precision-probes.json`, `policies.json`, `behavioral-isolation.json`.

| # | السطح (جدول/SQL + السياسة) | الدور+JWT | استعلام الإنتاج | المتوقع | الفعلي (قبل الإصلاح) | الحكم |
|---|---|---|---|---|---|---|
| L1 | `payments/expenses/invoices/contracts` — `app_read_* (qual: is_app_user())` | authenticated@A | `SELECT … company_id DISTINCT` | صفوف A فقط | **صفوف A+B** (انضم للتأكيد) | قابل للإنتاج: لا قيد شركة إطلاقًا |
| L2 | نفس الجداول — `app_read_*` | authenticated@B | كما سبق | B فقط | **A+B** | كما سبق |
| L3 | نفس الجداول — `app_read_*` | authenticated **بلا عضوية** | كما سبق | لا بيانات | **A+B كلها** | أخطر: لا حاجة لأي عضوية |
| L4 | `payments` (ثم `expenses` بدقة) — `manager_write_* (qual: is_admin_or_manager())` | authenticated@A | `UPDATE/DELETE صف B` | 0 صفوف | **صف واحد تأثر فعلًا** (بعد تصحيح فخ المعرف أدناه) | قابل للإنتاج |
| L5 | `expenses` — `manager_write_expenses (with_check: is_admin_or_manager())` | authenticated@A | `INSERT … company_id=B` | رفض | **أُدخل مختومًا بالشركة B** | قابل للإنتاج (REST spoof) |
| L6 | `rpt_cash_flow` (و10 تقارير أخرى من نفس الفئة) | A / B / بلا عضوية | `SELECT rpt_cash_flow(..)` | أرقام الشركة فقط | **تجميع عالمي 7000/1100 لكل الأدوار** | قابل للإنتاج (SECURITY DEFINER بلا قيد شركة) |
| L7 | `rpt_owner_statement(p_owner_id)` | authenticated@A مع مالك B | `SELECT rpt_owner_statement(OWNER_B,…)` | «owner not found» | **كشف مالك باء الكامل gross=6000** | قابل للإنتاج (انتحال معامل) |
| L8 | `create_owner_settlement_draft_atomic` | ADMIN@A بمالك B | استدعاء RPC | رفض 42501 | **DRAFT ناجح لمالك B** (T7) | قابل للإنتاج |
| L9 | `record_invoice_payment_atomic` (عبر `post_receipt_atomic`) | ADMIN@A بفاتورة B | استدعاء RPC | رفض | **«محتوى عرضًا»** بخطأ NOT NULL من ترايغر `update_contract_balance_from_allocation` غير المشدد (يدخل NULL في contract_balances.company_id) — ومع DEFAULT كان سيمرّ ويختلط | قابل للإنتاج (احتواء مصادفة لا تصميم) |
| L10 | `create_owner_agreement_atomic` | أي دور | استدعاء RPC | إنشاء اتفاق | **RPC ميت كليًا**: يدرج في عمود `company_id` لم تضفه هجرة phase‑2 إطلاقًا | كسر chain مؤكد (الواجهة تستدعيه: `ownerAgreementService.ts:117`) |

**درس فخ المحاكاة الذي أُمسك وصُحّح**: نتيجة «UPDATE/DELETE أعادت 0 صفوف» الأولى كانت **أثرًا لمحاكاة وليست دليل أمان**: ترايغر ظل `receipts→payments` يعيد كتابة `payments.id` إلى مُعرّف السند، فاستهدف الاستعلام معرفًا غير موجود. بعد حل الهدف ديناميكيًا من الجدول نفسه ظهر الفعل الحقيقي: **تعديل/حذف صف أجنبي ناجح (1 صف)**. موثق في `precision-probes.json`.

## ٣) نتائج محتواة (ليست ثغرات) — بأمانة

| السطح | النتيجة | سبب الاحتواء |
|---|---|---|
| `anon` على الجداول وكل `rpt_*` | `permission denied` في كل الحالات | منح REVOKE/GRANT سليمة |
| دور USER منخفض على إنشاء تسوية | مرفوض «ADMIN or MANAGER…» | حارس الدور قائم |
| `INSERT` مباشر في `payments` | مرفوض «receipt_id is required» | ترايغر مجال (عرضي، لا RLS) |
| ربط اتفاقية بمالك/عقار أجنبي REST | مرفوض «مالك الاتفاقية لا يملك العقار طوال فترة الاتفاقية» + قيد `owner_agreements_no_overlap` | ترايغر الملكية الزمنية (تصميم سليم) |
| كتابة فاتورة/دفع متقاطع عبر RPC قبل الإصلاح | خطأ NOT NULL في `contract_balances.company_id` | احتواء مصادفة — اعتُمدت كدليل لا كحل |
| SELECT `owner_settlements` كـauthenticated | `permission denied` | لا منحة SELECT — الوصول عبر RPC فقط |

## ٤) موازية البيئة (PGlite مقابل Supabase) — فروق موثقة لا تُحسب ثغرات

| البند | PGlite/الإعادة | Supabase الحقيقية | الأثر |
|---|---|---|---|
| منح `USAGE ON SCHEMA auth` | أُضيفت للمحاكاة (stub) | منحة منصّة افتراضية | بدونها كانت دوال invoker التي تستدعي `auth.jwt()` تفشل «permission denied for schema auth» — فرق بيئة، صُحّح في `replay-stubs.ts` ووُثّق في `evidence/p0/cause/auth-privilege-state.json` |
| `auth.uid()/jwt()/role()` | Stub يقرأ `request.jwt.claims` GUC | GoTrue يحقن المطالبات | مطابق شكليًا (نفس مصدر البيانات داخل الاستعلامات) |
| الملكية | postgres يملك كل شيء | postgres/supabase_admin | لا أثر: أدوار الاختبار ليست مالكة ولا BYPASSRLS |
| `pg_cron` | غير متوفر (محذوف في الذاكرة فقط) | متوفر | لا يمس العزل |
| فحص الملف `20260713000005` | WARNING بدل EXCEPTION (سلسلة منح auth الناقصة بيئيًا) | يمرّ | موثق في `replay-stubs.ts` REPLAY_TRANSFORMS |
| FORCE RLS على `deposit_txs/owner_settlements/tenants` | مطبق كما في السلسلة | مطبق | مطابق |

## ٥) مجموعة الإصلاح (هجرة واحدة 20260724120000 + rollback)

1. **F‑RPT**: 13 دالة تقارير تشتق الشركة من JWT (`require_company_id()` صارم / `current_company_id()`) وتُقيد كل جدول مصدر بها. المنطق الرقمي مطابق بايت‑لبايت.
2. **F‑RLS**: سياسة RESTRICTIVE موحدة `p0_tenant_isolation` على 56 جدولًا (`USING` + `WITH CHECK` بالشركة)، مع `DEFAULT current_company_id()` لختم الإدخالات المباشرة تلقائيًا، وسياسة خاصة لـ`companies` على `id`.
3. **F‑AGMT + تحليل أثر إلزامي**: عمود `owner_agreements.company_id` — **ليست إضافة متسرعة**: RPC الكتابة الوحيد `create_owner_agreement_atomic` يدرج في هذا العمود **بالفعل** (20260722000002) وهو **ميت على main** لأن phase‑2 أسقطت الجدول من إضافة الأعمدة (مثبت سلوكيًا: `column "company_id" … does not exist`). التوثيق: `cause/owner-agreements-trace.json`. التعبئة من `owners` (مصدر وحيد لا لبس فيه)، FK إلى `companies`، فهرس، nullable (لا كسر)، DEFAULT للختم. القراءات لا تتغير؛ `rpt_owner_statement` كان بالفعل ينضم عبر الاتفاقية وأصبحت فلترته صحيحة.
4. **F‑SET**: رفض مالك/عقار خارج شركة المُنادي (يسد T7). **دلالات الأرقام لم تُمس** — سلاح P1.
5. **F‑WR**: `record_invoice_payment_atomic` + `post_receipt_atomic` (نقطتا الدخول) يجعلان الفاتورة/العقد الأجنبي غير مرئي؛ ترايغر `update_contract_balance_from_allocation` يُختم من العقد نفسه (وليس من JWT) — يمنع الختم الخاطئ.
6. **F‑AGR**: حارس owner/property في `create_owner_agreement_atomic` + إصلاح إحالة `property_id` إلى uuid (كسران متسلسلان كانا سيظهران مع الإحياء: العمود المفقود ثم نوع text→uuid).

ضمانات الهجرة (مختبَرة في عقد الاختبار): بلا DROP TABLE/COLUMN، بلا حذف بيانات، كل دالة search_path مثبت، لا منح لـanon/public، لا صلاحية مقبولة من `payload.company_id`، سياسات الكتابة `WITH CHECK` وليس `USING` فقط، `UPDATE` الوحيد على مستوى الهجرة هو تعبئة العمود المضاف (الذي كان ينبغي أن تأتي به phase‑2).

## ٦) إغلاق Migration/Rollback — 19/19 وبصمة مطابقة

- جدول التغطية الآلي: `evidence/p0/fn-coverage.{json,md}` — **19/19**: 18 جسد pre‑P0 مُستعاد بايت‑لبايت (التوقيعات وأنواع المعاملات وSECURITY DEFINER/INVOKER مطابقة) + الدالة الجديدة `require_company_id()` مسار تراجعها `DROP FUNCTION` بالتوقيع المحدد + عمود `owner_agreements.company_id` (مع FK/الفهرس) يُحذف ككائن أنشأته الهجرة نفسها.
- اختبار **forward → security → rollback → fingerprint** (`src/p0/p0-forward-rollback.test.ts`، أخضر): بعد التراجع، سطح المخطط (تعريفات الدوال كاملةً بـ `pg_get_functiondef` ووضع SECURITY، السياسات، أعلام RLS/FORCE، أعمدة owner_agreements، الافتراضيات) **مطابق تمامًا** لما قبل P0. أمسك هذا الاختبار فرقًا حقيقيًا: `20260713000006` رفع `rpt_tenant_statement` إلى SECURITY DEFINER عبر `ALTER FUNCTION` بعد آخر CREATE؛ أُضيف ملحق خصائص في الملفين كي لا يهبط الإصلاح وضعها إلى INVOKER.
- الإعادة الكاملة: **152/152 نظيفة** (`evidence/p0/replay-coverage.json`) + تطبيق هجرة الإصلاح نظيفًا فوقها.

## ٧) تصنيف التقارير الستة المكسورة (لا حجب، تصنيف دقيق)

المصدر: `evidence/p0/pre-existing-defects.json` — لكل تقرير: خطأ authenticated قبل/بعد (متطابق) + **نفس الخطأ كمستخدم مالك (superuser)** → استبعاد «الـFixture الناقص» و«الصلاحيات/RLS»، والخلاصة:

| التقرير | التصنيف | الأثر الأمني | القرار |
|---|---|---|---|
| `rpt_trial_balance` | خلل تعريف SQL فعلي: `text <= date` لا يُحسم (أعمدة تواريخ مخزنة text) | لا شيء — يفشل مغلقًا | مؤجل (غير أمني) — مثبت على سلسلة origin/main |
| `rpt_balance_sheet` | نفس عائلة المعامل | لا شيء | مؤجل — نفس الإثبات |
| `rpt_aged_receivables` | ينادي `public._safe_date(date)` غير الموجود (يوجد text فقط) | لا شيء | مؤجل — نفس الإثبات |
| `rpt_overdue_invoices` | نفس الحمل المفقود | لا شيء | مؤجل |
| `rpt_rent_roll` | نفس الحمل المفقود | لا شيء | مؤجل |
| `rpt_tenant_statement` | `c.id = p_contract_id::text` (uuid = text) | لا شيء | مؤجل |

قاعدة القبول: التأجيل مسموح **فقط** لخلل وظيفي غير أمني مثبت على origin/main — والتحقق: الخطأ بايت‑متطابق before/after على نفس القاعدة المعادة، ولا بيانات شركة تُرجع في أي سياق. إصلاحها في طابور NEXT.md (مرحلة تصليح التقارير)، وقد زُوّدت مسبقًا بمقيّد الشركة في نفس الهجرة كي تحوز العزل فور إصلاحها.

## ٨) البوابات (Local gates — عبر Corepack وpackageManager المثبّت pnpm@10.11.1)

| البوابة | النتيجة |
|---|---|
| `typecheck` (root tsc ‑b + app) | ✅ |
| `lint` | ✅ |
| `typecheck:test` | ✅ |
| `test` الكامل | ✅ 202/202 ملف — **1000 اختبار** |
| `build` | ✅ |
| `check:architecture` | ✅ |
| حزم P0 المستقلة (`src/p0/`) | ✅ 12/12 ملف — 57 اختبارًا (سلوكيّ قبل/بعد + عزل السبب + العقد + forward/rollback + إعادة إنتاج بوابة الإصدار) |
| إعادة الهجرات | ✅ 152/152 + الإصلاح يطبق نظيفًا |
| جرد/مصفوفة RPC آليّة | ✅ `scripts/p0/inventory.mjs`, `rpc-security-matrix.mjs`, `fn-coverage.mjs` |

ما يتطلب أسرار GitHub (Supabase حية/متصفح E2E/Docker) يعمل داخل Actions ولا ادعاء محلي عنه؛ بوابة `pr1233-isolated-replay` (Docker) و`supabase-live-readiness` و`browser-readiness` تُراقب على الـPR.

### ٨‑أ) انحدار أمسكه CI وأُصلح (شفافية كاملة)

الدّفعة الأولى من الإصلاح أخفقت بوابتا `isolated-replay` و`release-blocker-database` على الـPR. وبكلمانًا: `supabase test db` فشل على مسار إنشاء الدفعة. أعدتُ إنتاج بوابة الإصدار **محليًا دون Docker** عبر `rentrix-app/src/p0/zz-release-gate-repro.test.ts` (إعادة تشغيل سلسلة الهجرات على PGlite + ترقيع pgTAP صغير + تنفيذ `supabase/tests/*.sql` عبارة‑بعبارة قبل/بعد الإصلاح)، فعزلت السبب الحقيقي الوحيد:

- **خلل فعلي في هجرتي** داخل `public.update_contract_balance_from_allocation()` (مشغّل ميزان العقود): أضفتُ `c.company_id` إلى قائمة الـ`SELECT` لختم `contract_balances.company_id` لكن دون إضافته إلى `GROUP BY` ⇒ خطأ تشغيلي `42803 column "c.company_id" must appear in the GROUP BY clause` ينكسر كل إنشاء دفع. أصلحتُ `scripts/p0/assemble_p0_fix.py` بإضافة `c.company_id` إلى الـ`GROUP BY` (الشرط `WHERE c.id = …` يثبّت عقدًا واحدًا فالتقسيم مطابق دلاليًا) وأعدت توليد الهجرة. **بعد الإصلاح: فرق الأعطال قبل/بعد = صفر عبر كل حزم pgTAP** (release_blockers, release_lifecycle_rehearsal, security_drift, value_contract) — أي لا انحدار متبقيًا. فُحص ساكنًا أيضًا: لا أي `company_id` منسوخ دون تجميع في أي دالة أخرى (0 حالة).
- **أعطال متطابقة قبل/بعد (قطع أثر المحاكاة لا المشروع):** مقارنة نصية عددية في ترقيع `is()` (`25.00` مقابل `25`) + فجوة منحة جدول `owner_settlements` لدور `authenticated` في إعادة التشغيل المحلية — كلها مكرّرة حرفيًا قبل الإصلاح وبعده، وأساس المنطق كان أخضر على `origin/main`، فهي ليست من صنع P0.

الحارس الانحداري الجديد (`zz-release-gate-repro.test.ts`) يُثبّت الخاصية «فشل بعد ⊆ فشل قبل» كاختبار دائم ضمن `src/p0/`. بوابتا CI تُعاد خُضرهما على الدفعة المصحّحة للتأكيد النهائي.

## ٩) خطة التحقق الحي (Production applicability)

1. تشغيل workflow الحي (supabase-live-readiness) بأسرار CI على الـPR — يقرأ إنتاجيًا قراءة فقط.
2. عند الموافقة: فحص إنتاجي آمن داخل `BEGIN/ROLLBACK` بجلسة مستخدم واقعي لشركة A: `SELECT count(*) FROM payments` (المتوقع بعد الدمج: صفوف A فقط) + استدعاء `rpt_cash_flow` + محاولة draft تسوية لمالك B (المتوقع 42501) — ثم ROLLBACK.

## ١٠) قرار GO/NO‑GO لـP1

الحالة الآن: **GO مشروط** — P0 مكتمل تقنيًا: كل ثغرة عزل مؤكدة مغلقة باختبارات سلوكية قبل/بعد، Rollback 19/19 وبصمة مطابقة، والانحدار التشغيلي الوحيد الذي أمسكته بوابة الإصدار (42803 في ميزان العقود) أُصلح وتحقق محليًا بفرق أعطال صِفر. كل البوابات المحلية خضراء (1000 اختبار كامل + 57 P0). الشروط المتبقية حوكمية لا تقنية: اكتمال خُضر CI على PR #1276 (بما فيه بوابتا `isolated-replay`/`release-blocker-database` اللتان تُعاد خُضرهما على الدفعة المصحّحة) ثم الدمج (squash) إلى main. **لا يبدأ P1** (خلل أرقام التسوية الموثوقة من العميل — إثبات مستقل قائم في `behavioral-isolation.json`: قبول net_payable=999999 قبل الإصلاح وبعده عمدًا) **إلا بعد الدمج ومن أحدث main في PR مستقل.**

## ١١) فهرس الأدلة (كلها قابلة لإعادة التوليد من هذا الفرع)

`evidence/p0/`: `behavioral-isolation.json` (قبل/بعد كامل) · `cause/operation-matrix.json`, `cause/precision-probes.json`, `cause/policies.json`, `cause/session-identity.json`, `cause/catalog-context.json`, `cause/owner-agreements-trace.json`, `cause/auth-privilege-state.json` · `pre-existing-defects.json` · `fn-coverage.{json,md}` · `fn-effective-attrs.json` · `forward-rollback-fingerprint.json` · `replay-coverage.json` · `inventory.{json,md}` · `rpc-security-matrix.{json,md}` · `numeric-parity.json` · `rls-enabled-prefix.json` · `grant-catalog.json`.

الاختبارات: `rentrix-app/src/p0/p0-multi-tenant-isolation.test.ts` (سلوكي شامل قبل/بعد) · `p0-cause-isolation.test.ts` (عزل السبب بثلاث هويات × 5 عمليات) · `p0-forward-rollback.test.ts` · `p0-company-isolation-migration-contract.test.ts` (26 اختبار عقد) · `zz-*-probe.test.ts` (مسابر أدلة).
