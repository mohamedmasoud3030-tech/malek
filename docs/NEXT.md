# الخطوات القادمة

للحالة الفعلية الحالية للتطبيق (الميزات، الجودة، الجاهزية): **[`APP_STATUS.md`](APP_STATUS.md)** — دايماً المصدر الوحيد المعتمد، آخر تحقق مباشر بتاريخه المذكور فيه.

## P0 — التحقق متعدد الشركات (مكتمل تقنيًا — 2026-07-24، فرع `agent/p0-multi-tenant-verification` → PR #1276)

- ✅ جرد آلي قابل لإعادة التشغيل (`scripts/p0/inventory.mjs`), مصفوفة أمان (`rpc-security-matrix.mjs`), إعادة معزولة كاملة **152/152**.
- ✅ **عزل سببي بثلاث هويات × SELECT/INSERT/UPDATE/DELETE/RPC** مع إثبات هوية الجلسة (`current_user=authenticated`, session_user, JWT, `current_company_id()`, لا BYPASSRLS/لا ملكية): تأكدت تسريبات القراءة (A/B/بلا عضوية يرون الشركتين)، الكتابة المتقاطعة (UPDATE/DELETE/INSERT‑spoof ناجحة عبر REST)، انتحال معامل `rpt_owner_statement`، انتحال مالك التسوية (T7)، مسار كتابة الفاتورة/الإيصال المتقاطع، وموت RPC إنشاء الاتفاقيات على main. سبب «0 صفوف» الأولي وثّق كأثر محاكاة (ترايغر ظل يعيد كتابة معرفات المدفوعات) وصُحّح بالاستهداف الديناميكي.
- ✅ الإصلاح (هجرة `20260724120000_p0_company_isolation_reports_rls.sql` + rollback): 13 دالة تقارير بقيود شركة صارمة، سياسة RESTRICTIVE موحدة (56) + DEFAULT للختم (55)، إحياء `owner_agreements.company_id` مع تحليل أثر موثق، حُرّاس F‑SET/F‑WR/F‑AGR. **تغطية التراجع 19/19** وبصمة ما بعد الـrollback مطابقة تمامًا لما قبل P0 (`p0-forward-rollback.test.ts`).
- ✅ البوابات المحلية كلها خضراء: typecheck/lint/typecheck:test/**test (1000)**/build/check:architecture + حزم P0 المستقلة (57).
- ✅ أمسكت بوابة الإصدار على الـPR انحدارًا تشغيليًا حقيقيًا (42803 في `update_contract_balance_from_allocation()` — `company_id` دون GROUP BY)، أُعيد إنتاجه محليًا دون Docker عبر `src/p0/zz-release-gate-repro.test.ts` وأُصلح في الهجرة؛ **فرق الأعطال قبل/بعد = صفر** عبر حزم pgTAP. حارس انحداري دائم مضاف ضمن `src/p0/`.
- 🔶 تصنيف التقارير الستة المكسورة على main (تعريف SQL فعلي، فشل مغلق بلا تسريب، مثبت superuser‑مطابق): مؤجلة كوظيفية غير أمنية — إصلاحها في مرحلة تصليح التقارير (P‑لاحقة): `rpt_trial_balance`, `rpt_balance_sheet` (operator text<=date)؛ `rpt_aged_receivables`, `rpt_overdue_invoices`, `rpt_rent_roll` (حمل `_safe_date(date)` مفقود)؛ `rpt_tenant_statement` (uuid=text).
- 🔶 فروق بيئة PGlite↔Supabase موثقة (منحة USAGE على schema auth) في `evidence/p0/cause/env-parity.md`.
- ✅ **CI على #1276 كله أخضر على `02696f6`**: `isolated-replay` و`release-blocker-database` (إعادة تشغيل الهجرات كاملة + pgTAP على Supabase الحقيقي) ✅، `release-blocker-code`/`release-blocker-authenticated-staging`/`build`/`browser-smoke`/`codacy`/`aikido`/`vercel`/`**SonarCloud**` ✅. المتبقي حوكمي فقط: دمج squash → فحص حي آمن قراءة‑فقط بعد الدمج. **P1 (أرقام التسوية الموثوقة من العميل — الإثبات مستقل وجاهز) يبدأ بعد الدمج من أحدث main في PR مستقل.**

## P1 — سلامة تسويات الملاك (مكتمل تقنيًا — 2026-07-24، فرع `agent/p1-owner-settlement-integrity` من `8cd87a1`)

- ✅ **العميل لم يعد مصدر أي مبلغ**: `calculate_owner_net_payout(...)` (STABLE SECURITY DEFINER، search_path مثبّت، EXECUTE لـ authenticated+service_role فقط) يشتق الإجمالي من تحصيلات POSTED غير الملغاة المربوطة باتفاقية كل عقد (بمصادقية `rpt_owner_statement`)، الأتعاب RATE لكل دفعة بـ`_r3` (توافق التقارير)، والثابتة بعدد الشهور المغطاة مقصوصًا بصلاحية الاتفاقية، مع استبعاد تحصيلات الماستر (استحقاق المكتب) واعتماد أساس الالتزام له، ومصروفات OWNER المرحّلة في الفترة فقط، وVAT من `company_settings` عند انتمائها لشركة المُنفّذ فقط. `net = greatest(g−f−e−t,0)` بـ`round(...,3)`.
- ✅ **مسار الكتابة** `create_owner_settlement_draft_atomic`: نفس حُرّاس P0 حرفيًا (دور/F‑SET/تكرار/قفل استشاري) + حذف قراءة مفاتيح المبالغ + اشتقاق بعد حارس التكرار؛ الحمولة الملفّقة 999999/1/1/1 تُخزَّن 1500/150/120/0/**1230** (`'amounts_source','server_derived'`).
- ✅ **مناعة تخزينية**: تريغر `p1_owner_settlements_amounts_immutable` يمنع أي UPDATE لأعمدة المبالغ بعد الإدراج (اكتشاف إنتاجي ثانٍ: سياسة FOR ALL التساهلية كانت تتيح التعديل المباشر) — لا يمس approve/pay/cancel.
- ✅ **عزل الفشلين بالبروتوكول الكامل**: approve = فروق منح PGlite↔Supabase (تصنيف 2، حُل بمنح تكافؤ التطوير المحلي داخل هارنس البوابة فقط)؛ pay 1111/2000 = فجوة مثبّت — `accounts.no` **فريد كليًا** والمخطط يُزرع مرة واحدة لشركة العرض ولا تريغر يمد شركة جديدة بدليل حسابات (حارس pay شركة‑مقصود بالتصميم). قبل/بعد P1 **متطابق** (نفس SQLSTATE/الرسالة/سطر RAISE 37، وmd5 جسم pay واحد) → لا انحدار P1 ولا خلل إنتاجي؛ الحل تعديل المثبّت فقط (إسناد الدليل المُمدّ لشركة التشغيل الاختبارية). الملاحظة البنيوية (تعدد أدلة الحسابات الحقيقي عبر الشركات) موثقة لـ P2.
- ✅ **الواجهة**: حذف حقول المبالغ الأربعة والحاسبات المحلية؛ معاينة خادمية قراءة‑فقط بمفتاح `[الهدف، الفترة]`؛ زر الإنشاء معطّل حتى نجاح المعاينة؛ `request_id` ثابت للمحاولة (النقر المزدوج يعيد تشغيل التخزين المؤقت خادميًا). الاختبار الساكن يمنع رجوع النمط القديم.
- ✅ **التغطية**: P1 ‏27/27 (اشتقاق/كيل/دورة حياة/عزل حسابات/مناعة/محاولات غير صالحة/توازي) · pgTAP الفعلي ‏65/65 صفر فشل · forward→rollback→بصمة ≡ → إعادة تطبيق ✓ · P0 ‏57/57 · financials ‏271/271 · الكل ‏1034/1034 · build ✓.
- ✅ **مُدمج ومتحقق منه على production**: PR #1277 اندمج squash على `fc9c5b6d` (2026-07-24، 07:11 بتوقيت عُمان) بعد إصلاح فشل بوابة `release-blocker-database` — السبب كان `search_path` غير مثبّت على دالة `enforce_owner_settlement_amount_immutability` (الدرس: أي دالة trigger جديدة لازم تُفحص لـsearch_path قبل فتح الـPR، مش بعد فشل الـCI). تحقق مباشر لاحق على `nnggcnpcuomwfuupupwg` (2026-07-25) أكّد: migration `20260725000000` في الـledger، الدوال الثلاث حيّة بالضبط كما في الكود، والـtrigger مفعّل فعليًا (لا يكفي دمج GitHub وحده لإثبات التفعيل على production — لازم فحص مباشر بعد كل دمج migration).
- 🔶 **P2 القادم**: تشديد حارس التداخل الجزئي للفترات + مكافحة ازدواج الأتعاب عبر الفترات + بنية دليل الحسابات لكل شركة.

## Phase 3A-1B — حسابات قياسية للفاتورة والدفع والسند وVOID (مكتملة، 2026-07-25)

- ✅ **الجرد التنفيذي** (من إعادة تشغيل الكتالوج الحية، `evidence/p3/phase3a1b/active-financial-function-inventory.json` بصورتَي قبل/بعد): 8 تواقيع حية لـ 7 أسماء — أثبت أن `find_payment_account_id` كان يجيب حساب أي شركة بـ`LIMIT 1`، وأن مولّد الفواتير كان يلف على عقود **كل الشركات** بـ`WHERE no='1201' LIMIT 1` + `company_settings` عالمية، وأن VOID كان **بدون أي قيد شركة**، وأن حسابات قيود السند كانت تُقبل من العميل كما هي.
- ✅ **الإصلاح**: الحلول كلها عبر مساعدي 3A-1A (`require_company_account_id` — دون تغيير سلوكهما، md5 ثابت عبر السلسلة)؛ 2100 (VAT) مطلوب فقط عند فرض الضريبة؛ حلقة العقود + إعدادات VAT + فحص حسابات القيود كلها مقيّدة بالشركة؛ VOID يستنسخ **نفس حسابات القيد الأصلية** (بلا إعادة بحث بالرقم) ويرفض عبر الشركات بسلوك P0002 قبل أي كتابة؛ التكرار أصبح `<operation>:<company_uuid>` مع ثبات مخطط `financial_operation_idempotency` (23205 لاصطدام `receipts.request_id` العالمي موثق حتى 3A-2، وتخزين request_id الخام محفوظ لعقد البوابة).
- ✅ **التواقيع legacy محفوظة**: overload القديم `void_receipt_atomic(uuid,timestamptz,jsonb,jsonb)` بلا إثبات عدم استخدام ⇒ بقي **حرفيًا** (غير مكشوف أصلًا).
- ✅ **التغطية**: دورات الفاتورة/الدفع/السند/VOID + العزل + منع التكرار + forward→rollback→بصمة ≡ → إعادة تطبيق (لا صف مالي يُحذف أو يُعدّل أثناء الـrollback) — الكل ‏1068/1068، financials ‏271/271، P0 ‏57/57، pgTAP ‏65/65، typecheck/lint/architecture/build ✓.
- ✅ **مُدمجة ومطبقة**: PR #1281 اندمج squash على `946a7b37`، وتحقق الفحص الحي قراءة فقط من وجود migration `20260728090000` على Production. التقرير: `docs/audits/PHASE3A1B_INVOICE_PAYMENT_RECEIPT_VOID.md` + ADR `docs/decisions/0005-account-resolution-payment-receipt-void.md`.
- 🔶 **مؤجّل بالتصميم**: `UNIQUE(company_id,no)` المركّب + إمداد دليل الحسابات للشركات الإضافية ‏→ 3A-2 · تداخل فترات التسوية/ادعاءات المصدر · PDC · واجهة المركز المالي.

## Phase 3A-1C — حسابات تسويات الملاك القياسية (مكتملة، 2026-07-25)

- ✅ نُفذت على فرع مستقل من دمج #1281:
  `phase3a/owner-settlement-account-resolution`.
- ✅ تحويل صرف التسوية من بحث `accounts.no ... LIMIT 1` إلى
  `require_company_account_id(company, '2000'/'1111')`.
- ✅ ربط `request_id` بطلب مالي immutable داخل الشركة في create/approve/pay/cancel،
  مع رفض تغيير الهدف أو payload قبل أي كتابة.
- ✅ حصر قراءة/تحديث التسوية بالشركة، وrow-count assertions للتحديث وقيدي الصرف.
- ✅ PGlite: lifecycle + عزل شركتين + حساب مفقود + rollback ذري + cache قديم
  fail-closed + forward/rollback/reapply ببصمة catalog مطابقة.
- ✅ البوابات المحلية: Phase 3A-1C ‏7/7، full Vitest ‏1075/1075،
  financials ‏271/271، pgTAP ‏65/65، typecheck/lint/architecture/docs/build ✓.
- ✅ PR #1282 اندمج squash على `8feddc3f`، وتحقق الفحص الحي قراءة فقط من وجود
  migration `20260729090000` على Production.

التقرير:
`docs/audits/PHASE3A1C_OWNER_SETTLEMENT_ACCOUNT_RESOLUTION.md`،
والقرار:
`docs/decisions/0006-owner-settlement-account-resolution-and-request-binding.md`.

## الأولوية الحالية — تشغيل تجريبي منظم لمكتب واحد

**Single-office pilot: GO تقني، مع HOLD تشغيلي قصير قبل تسليم حسابات حقيقية.** مانع desktop/RTL أُغلق في PR #1292، وإكمال الأرقام اللاتينية أُغلق في PR #1298. النسخة المنشورة الحالية على `main` هي `44ec873d`.

### ما تم إثباته في 2026-07-27

- Browser Readiness: **243 ناجح / 204 متجاوز مقصود / 0 فشل** عبر desktop/tablet/mobile.
- Release Blocker: code + isolated Supabase replay + رحلة المكتب الكاملة + Production authenticated read-only كلها ناجحة.
- رحلة المكتب المعزولة: ADMIN حقيقي، بيانات مترابطة، فاتورة → دفعة → إيصال → VOID، قيد عكسي متوازن، وعدم تكرار.
- Production قراءة فقط: شركة واحدة، والحسابات `1111/1201/2000/2100/4000` مرة واحدة لكل رقم، وآخر migration هي `20260730090500`.
- لا توجد دورة مالية كتابية تجريبية على Production.

### المتبقي قبل أول مستخدم حقيقي

1. تفعيل **Leaked Password Protection** من Supabase Auth؛ Security Advisor يؤكد أنها ما زالت معطلة.
2. تغيير كلمة مرور الحساب التجريبي التي ظهرت في محادثة الاختبار، ثم إنهاء جلساته القديمة.
3. تنفيذ قبول تشغيلي غير متلف لمدة جلسة واحدة وفق [`SINGLE_OFFICE_LAUNCH.md`](SINGLE_OFFICE_LAUNCH.md): دخول، تنقل، طباعة/تصدير، الهاتف، وصلاحيات الأدوار.
4. بدء Pilot محدود بموظف ADMIN واحد، ثم إضافة MANAGER/USER بعد نجاح أول يوم عمل ومراجعة سجل التدقيق.

### ترتيب العمل اليومي للمكتب الأول

1. **التأسيس مرة واحدة:** إعدادات الشركة → الملاك → العقارات → الوحدات → المستأجرون → العقود.
2. **التشغيل اليومي:** لوحة التحكم → الفواتير المستحقة → التحصيل والإيصالات → المصروفات → الصيانة.
3. **إغلاق اليوم:** التقارير اليومية → سجل التدقيق → فحص النزاهة.
4. **الأسبوع الأول:** لا تعتمد التسويات البنكية أو تعدد الشركات أو الأتمتة المتقدمة كمسار يومي؛ تبقى خارج Pilot الأول.

PR #1297 يبقى Draft حتى موافقة مستقلة على دمج migration وتطبيقها. لا يمنع Pilot لمكتب واحد.

عقد الإطلاق: [`SINGLE_OFFICE_LAUNCH.md`](SINGLE_OFFICE_LAUNCH.md).

`supabase/migrations_consolidated/` اتشال نهائياً (2026-07-23): كان مجلد ميت ومتناقض مع نفسه — الـ README بتاعه بيشاور لملفين (`CONSOLIDATION_MAPPING.md`, `CANDIDATES_FOR_REMOVAL.md`) اتمسحوا من زمان في PR #1201، ومستند `supabase/migrations/README.md` كان بيقول إن المجلد ده "اتشال" من 2026-07-18 بينما هو لسه موجود فعلياً. اتأكد إن مفيش أي CI/script بيعتمد عليه قبل الحذف.

باقي: **164 ملفًا في `supabase/migrations/` نفسها** — الفحص المحلي يثبت صفر تكرار timestamp وصفر خلل ترتيب، وProduction تنتهي عند نفس النسخة الأخيرة `20260730090500`. التوحيد المطلوب هنا مش حذف ملفات فعلية، لكن فحص الأزواج متشابهة الاسم (زي `reconcile_unit_legacy_rent` مرتين) للتأكد إنها كلها نمط stub/alias موثق ومش تكرار خفي لمنطق متضارب — ده شغل تدقيق منفصل لكل ملف، مش عملية حذف جماعية.

## تنظيف الفروع والدوكس (2026-07-25)

- **فروع GitHub**: حُذف 66 فرع من أصل 328 (60 مسارات ميتة فقط `docs/archive/tickets/evidence`، 6 مدمجة بالكامل في `main` بنفس المحتوى حرفيًا — تأكيد عبر مطابقة blob SHA). الـ262 المتبقية مصنّفة: 101 مدمج جزئيًا، 153 غير مدمج إطلاقًا (منها 19 فرع يلمس migrations، مرشحة كمُدخل لجلسة توحيد الـmigrations القادمة — ملحوظ إن فرع `codex/rebuild-supabase-migrations-as-code-first-baseline` بالذات تاريخ migrations بديل كامل بترقيم مستقل، مُدخل مباشر لتلك الجلسة).
- **مجلد `docs/`**: أُرشفت (مش اتمسحت) 3 ملفات من `docs/handover/` (`RELEASE_BLOCKERS.md`, `INTEGRATED_TODO_LIST.md`, `MODERN_FORMS_AND_PDF_TODO_LIST.md` — تأكدت أنها مكتملة/محالة فعليًا لـ`NEXT.md` قبل النقل) و5 ملفات UX من `docs/ui/` (استُبدلت رسميًا بـ`docs/ui-ux/RENTRIX_VISUAL_DIRECTION.md`). التفاصيل والمنطق في `docs/archive/README.md`. `docs/handover/HANDOVER_CHECKLIST.md`, `POST_LAUNCH_BACKLOG.md`, و`FORGOTTEN_PLANS_TODO_LIST.md` بقيوا لوجود بنود مفتوحة أو غرض تشغيلي دائم مختلف عن ملفات الحالة.

## بنود قايمة (بعد التوحيد)

- معالجة الـ 224 ملاحظة أداء من Supabase Advisor (79 `auth_rls_initplan`، 20 `multiple_permissive_policies`، فهارس مفقودة/غير مستخدمة) — مش عاجلة عند الحجم الحالي للبيانات، لكن لازم تتعالج قبل أول عميل حقيقي بحجم بيانات كبير
- تفعيل Leaked Password Protection في Supabase Auth (إصلاح فوري، بدون تكلفة)
- توحيد التعريف المكرر في `sonar-project.properties` (`sonar.exclusions`/`sonar.cpd.exclusions` معرّفين مرتين، الثاني بيلغي الأول)
- تنضيف الفروع القديمة على GitHub (250+ فرع تراكمي) — خارج نطاق أي جلسة تقنية حالية، يحتاج قرار مستقل
- استكمال pgTAP لسيناريوهات VOID/الودائع/تسويات الملاك بمزيد من التكرار (الميزات مربوطة بالكامل، لكن بدون بيانات استخدام حقيقية بعد)

## قواعد الأمان الثابتة

- بدون تعديلات إنتاج بدون موافقة صريحة لكل تغيير على حدة
- Squash-merge فقط، PR واحد لكل وحدة عمل
- تحديث `docs/APP_STATUS.md` بعد أي جلسة تمس الجاهزية أو الميزات
- أي migration جديدة عبر `apply_migration` فقط، أبداً `execute_sql` للـ DDL
