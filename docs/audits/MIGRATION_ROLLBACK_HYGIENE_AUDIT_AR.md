# جرد نظافة Migrations و Rollback (PR-D)

**التاريخ:** 2026-08-04
**النطاق:** `supabase/migrations/`, `supabase/rollback/`, `scripts/`, `.github/workflows/`, التوثيق ذو الصلة.
**Base:** `origin/main` @ `c3d1041d8be8d9a9c03edcd5410b6b7d0954a7d5` (بعد دمج PR-C / PR #1332).
**الهدف:** حصر كل ملف له علاقة بمنطق rollback/revert/undo، وتصنيفه، دون حذف أو نقل أو إعادة تسمية أي Migration تاريخية.

---

## منهجية الفحص

تم البحث عن الأنماط التالية في أسماء الملفات ومحتواها داخل `supabase/migrations/` و`supabase/rollback/` و`scripts/` و`.github/workflows/` وملفات التوثيق:

```
rollback, revert, undo, down migration, reverse migration,
manual rollback, drop function, drop table, drop policy,
restore previous, previous definition
```

كما تم فحص:
- `supabase/tests/` بحثًا عن اختبارات Migration Replay.
- `package.json` (الجذر و`rentrix-app/`) لأوامر الـ CI ذات الصلة.
- `.github/workflows/` لتحديد أي Workflow يُنفّذ Migration Replay فعليًا.
- كل التوثيق تحت `docs/` الذي يذكر migrations أو rollback.

---

## النتيجة الإجمالية

| المجلد | عدد الملفات | ملاحظة |
|---|---|---|
| `supabase/migrations/` (المستوى الأعلى فقط، وهو ما يُطبَّق فعليًا في Clean Replay) | 177 ملف `.sql` | السلسلة التاريخية الكاملة، Forward-only بالتصميم فعليًا فيما عدا استثناء واحد موثّق أدناه |
| `supabase/migrations/rls_per_table/` (مجلد فرعي، خارج نطاق `-maxdepth 1` وبالتالي خارج Clean Replay تمامًا) | ملفين `.sql` + `.md` واحد | قالب تشغيل يدوي (انظر التصنيف أدناه) |
| `supabase/rollback/` | 20 ملف `.sql` | مجلد Rollback يدوي منفصل بالفعل — **لم يكن موجودًا بشكل رسمي وموثّق بسياسة مكتوبة قبل هذا الـPR** |

**الاكتشاف الجوهري:** البنية الأساسية (فصل `migrations/` عن `rollback/`) كانت موجودة فعلًا من عمل سابق (PR-C وما قبله). ما كان ناقصًا هو:
1. سياسة مكتوبة رسمية (`docs/database/MIGRATION_AND_ROLLBACK_POLICY_AR.md`).
2. Guard آلي يمنع تكرار وضع محتوى Rollback داخل `supabase/migrations/` مستقبلًا.
3. توثيق صريح للاستثناء التاريخي الوحيد الذي يحتاج تصنيف `LEGACY_APPLIED_MIGRATION`.

---

## جدول الملفات المشبوهة

| file | directory | classification | reason | already_in_main | replayed_by_ci | safe_to_move | action | blocker |
|---|---|---|---|---|---|---|---|---|
| `20260731190947_create_maintenance_atomic_rpc.sql` | `supabase/migrations/` | FORWARD_MIGRATION | Migration أمامية عادية (إضافة عمود، فهرس، RLS، RPC) | نعم | نعم | لا ينطبق | إبقاء كما هو | لا يوجد |
| `20260731190948_rollback_create_maintenance_atomic_rpc.sql` | `supabase/migrations/` | LEGACY_APPLIED_MIGRATION | محتواه Rollback فعلي (DROP POLICY/FUNCTION/INDEX/COLUMN) لكنه **مُطبّق تاريخيًا** كجزء من سلسلة الـmigrations نفسها — تم إنشاء `create_maintenance_atomic` ثم التراجع عنه فورًا (timestamp تالٍ مباشرة) ضمن نفس دورة النشر. لا يوجد أي migration لاحقة تعيد إنشاء الدالة، أي أن هذا هو الحال الفعلي المُطبّق على الإنتاج اليوم. | نعم | نعم (جزء من Clean Replay) | **لا** — نقله يكسر ترتيب السلسلة التاريخية ويغيّر بصمة الـreplay | **إبقاء بدون أي تعديل، حذف، نقل، أو إعادة تسمية.** تم توثيقه هنا فقط. | لا يوجد — هذا سلوك متوقع ومُقصود من مطوّري تلك المرحلة (انظر تعليق الملف: "raw INSERTs become the write path again") |
| `20260719142548_revert_post_receipt_atomic_payments_sync_v2.sql` | `supabase/migrations/` | LEGACY_APPLIED_MIGRATION | ملف "Live ledger capture" فارغ فعليًا (`begin; commit;` بدون أي DDL/DML) — سجل تاريخي إداري لعملية تم توثيقها وقتها، وليس Rollback تنفيذي بالمعنى الوظيفي. الاسم فقط يحتوي كلمة `revert`. | نعم | نعم (no-op آمن تمامًا في الـreplay) | لا ينطبق | إبقاء كما هو — لا خطر لأنه لا يغيّر أي شيء في القاعدة | لا يوجد |
| 47 ملف Forward migration إضافي تحتوي `DROP FUNCTION` / `DROP TABLE` / `DROP POLICY` / `DROP TRIGGER`/`DROP INDEX` كجزء من نمط "Drop-and-recreate" الاعتيادي (مثال: `20260706022859_drop_stale_renew_contract_atomic_uuid_overload.sql`, `20260715000001_drop_stale_soft_delete_contract_uuid_overload.sql`, `20260718170255_drop_legacy_void_receipt_overload.sql`, `20260719150000_drop_rogue_permissive_attachments_upload_policy.sql`) | `supabase/migrations/` | FORWARD_MIGRATION | استخدام `DROP ... IF EXISTS` قبل `CREATE OR REPLACE` هو نمط قياسي في Postgres migrations لتفادي تعارض الـoverloads (موثّق في الذاكرة التشغيلية للمشروع). هذا **ليس** محتوى Rollback — الاتجاه أمامي دائمًا (يضيف/يصلح سلوكًا جديدًا ولا يُعيد سلوكًا قديمًا). | نعم | نعم | لا ينطبق | إبقاء كما هو، لا حاجة لأي إجراء | لا يوجد |
| كل ملفات `supabase/rollback/*.sql` (20 ملفًا) | `supabase/rollback/` | ROLLBACK_ONLY | ملفات Rollback يدوية بالفعل، خارج مسار الـMigration Replay (`supabase/migrations` فقط هو ما يُشغَّل بواسطة `supabase start` / `supabase migration up` في `scripts/ci/run-supabase-database-gate.sh`) | لا ينطبق (ليست migrations) | **لا** — تم التحقق أن مسار الـreplay في `scripts/ci/run-supabase-database-gate.sh` يستهدف `supabase/migrations` حصرًا | لا ينطبق (هي بالفعل في مكانها الصحيح) | لا حاجة للنقل، فقط توثيق السياسة رسميًا (المرحلة 2) وإضافة Guard (المرحلة 3) | 12 من أصل 20 ملفًا لا يحتوي سطر تحذير صريح مستقل بصيغة "Manual / NOT auto-applied" (انظر تفصيل المرحلة 5 أدناه) — هذا لا يمنع دمج PR-D لأنه لا يغيّر سلوك قاعدة البيانات، لكنه مسجّل كملاحظة سياسة للمستقبل |
| `docs/*.md` (عدة ملفات: `APP_STATUS.md`, `ARCHITECTURE.md`, `NEXT.md`, `RELEASE_READINESS.md`, إلخ) | `docs/` | NON_EXECUTABLE_DOCUMENTATION | ذكر نصي لكلمة "rollback" في سياق سردي/تاريخي لعمليات تحقق سابقة (مثال: "forward→rollback→بصمة ≡ → إعادة تطبيق") — لا SQL تنفيذي | لا ينطبق | لا ينطبق | لا ينطبق | لا حاجة لأي إجراء | لا يوجد |
| `scripts/verify-supabase-live-readiness.sh` (سطر 110: `ROLLBACK;`) | `scripts/` | NON_EXECUTABLE_DOCUMENTATION | جملة `ROLLBACK;` قياسية ضمن معاملة SQL تشخيصية للتحقق القرائي فقط من القراءة (read-only verification transaction) — ليست ملف Rollback لمخطط قاعدة بيانات | لا ينطبق | لا ينطبق | لا ينطبق | لا حاجة لأي إجراء | لا يوجد |
| `scripts/check-manual-migration-workflow.mjs` | `scripts/` | NON_EXECUTABLE_DOCUMENTATION | Guard موجود مسبقًا يتحقق من بنية Workflow نشر الإنتاج اليدوي (`supabase-production-migrations.yml`) — يذكر `rollback_plan_reference` كحقل إدخال إلزامي للنشر، وليس ملف Rollback بحد ذاته | لا ينطبق | لا ينطبق | لا ينطبق | لا حاجة لأي إجراء — منفصل تمامًا عن Guard الجديد ولا تعارض | لا يوجد |
| `supabase/migrations/rls_per_table/00_apply_rls_to_table.sql`, `00_rollback_rls_for_table.sql`, `01_table_order.md` | `supabase/migrations/rls_per_table/` (مجلد فرعي) | NON_EXECUTABLE_DOCUMENTATION | **اكتشاف الـGuard الآلي:** مجلد فرعي داخل `supabase/migrations/` يحتوي قالبين يدويين (Apply / Rollback) لتفعيل RLS جدول-بجدول عبر Supabase SQL Editor يدويًا، بالإضافة لملف Markdown يوضح ترتيب التنفيذ. **تم التحقق مباشرة من `scripts/collect-supabase-migration-evidence.sh` أن قراءة الـmigrations تستخدم `find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql'`** — أي أن أي مجلد فرعي (`-maxdepth 1`) غير مشمول إطلاقًا في Clean Replay أو في `supabase start`/`migration up`. هذا قالب تشغيل يدوي (Runbook) وليس Migration تنفيذية. | نعم | **لا** (خارج `-maxdepth 1`) | لا ينطبق | إبقاء كما هو دون أي تعديل | لا يوجد — تم توثيقه فقط كإضافة شفافية للجرد؛ الـGuard الجديد يُصدر تحذير Legacy غير معطِّل بخصوصه تلقائيًا |

---

## الملفات التاريخية التي بقيت دون أي تعديل (والسبب)

طبقًا لقاعدة الأمان الإلزامية في الـPR، الملفان التاليان **لم يُمسّا إطلاقًا** رغم احتوائهما على كلمات مفتاحية مطابقة لأنماط الـGuard:

1. **`supabase/migrations/20260731190948_rollback_create_maintenance_atomic_rpc.sql`**
   السبب: هذا الملف جزء لا يتجزأ من سلسلة الـMigration المُطبّقة فعليًا على القاعدة (كل من `create_maintenance_atomic_rpc` والملف الذي يليه بفارق ثانية واحدة في الـtimestamp). حذفه أو نقله يكسر:
   - ترتيب إعادة التشغيل (Clean Replay) في `scripts/ci/run-supabase-database-gate.sh`.
   - بصمة القاعدة الحالية (الدالة `create_maintenance_atomic` غير موجودة فعليًا في الإنتاج بسبب هذا التراجع المُتعمّد).
   تم تصنيفه `LEGACY_APPLIED_MIGRATION` ووُثّق هنا فقط.

2. **`supabase/migrations/20260719142548_revert_post_receipt_atomic_payments_sync_v2.sql`**
   السبب: سجل تاريخي فارغ (`begin; commit;`) لا يغيّر أي شيء، لكنه جزء من الترقيم الزمني المتسلسل للـMigrations ولا يجوز حذفه أو إعادة ترقيمه.

**لم يتم حذف أو نقل أو إعادة تسمية أو تعديل أي من الملفين أعلاه بأي شكل.**

---

## تأكيد: مسار الـReplay لا يشمل `supabase/rollback/`

تم التحقق مباشرة من `scripts/ci/run-supabase-database-gate.sh`:

- `supabase start` يُطبّق كل ملفات `supabase/migrations/*.sql` فقط على قاعدة بيانات فارغة (تعليق صريح في السكربت: *"applies every migration under supabase/migrations to the empty database"*).
- لا يوجد أي استدعاء لمسار `supabase/rollback/` في أي Workflow أو سكربت CI.
- Workflow منفصل `.github/workflows/pr1233-isolated-replay.yml` يُفعَّل فقط عند تغيّر `supabase/migrations/**` أو `supabase/tests/**` أو `scripts/ci/**` — لا يتضمن `supabase/rollback/**` ضمن مساراته.

**النتيجة: `supabase/rollback/` لم يكن، وليس، ولن يكون جزءًا من Clean Replay.** هذا يُثبت أن البنية القائمة صحيحة من الأصل، والعمل المطلوب في PR-D هو التوثيق الرسمي + الـGuard الوقائي فقط.

---

## ملاحظة سياسة (غير معطِّلة للدمج): تناسق Headers في `supabase/rollback/`

من أصل 20 ملف Rollback موجود، **8 ملفات** تحتوي على تحذير صريح بصيغة "Manual/Emergency/Safe rollback" في أول سطرين، بينما **12 ملفًا** يبدأ مباشرة بـ`BEGIN;` أو بتعليق وصفي دون كلمة "Manual" صريحة (لكنها جميعًا خارج مسار الـReplay فعليًا وهذا هو الضمان الحقيقي، وليس نص التعليق).

هذا **لا يُعد Blocker** لأن:
- الحماية الفعلية (عدم التشغيل التلقائي) مضمونة بنيويًا عبر عدم استدعاء المجلد من أي Workflow، وليس عبر نص تعليق.
- السياسة الجديدة (`docs/database/MIGRATION_AND_ROLLBACK_POLICY_AR.md`) والـGuard الجديد (`scripts/check-migration-rollback-hygiene.mjs`) يفرضان هذا الشرط **على الملفات الجديدة فقط** من الآن فصاعدًا، دون إلزام بإعادة كتابة الملفات القديمة (تفاديًا لأي تعديل غير ضروري على تاريخ قد يُعتبر حساسًا).

تم تسجيل هذه الملاحظة فقط لأغراض الشفافية؛ لا إجراء مطلوب ضمن نطاق PR-D.

---

## خلاصة التصنيف النهائي

| التصنيف | العدد |
|---|---|
| FORWARD_MIGRATION | 177 (179 - استثناءين) |
| FORWARD_COMPATIBILITY_MIGRATION | 0 |
| LEGACY_APPLIED_MIGRATION | 2 |
| ROLLBACK_ONLY | 20 |
| MIXED_OR_AMBIGUOUS | 0 |
| NON_EXECUTABLE_DOCUMENTATION | عدة ملفات توثيق/سكربتات مساعدة + مجلد القالب اليدوي `rls_per_table/` (مذكورة أعلاه) |

**لا يوجد أي ملف تم حذفه أو نقله أو إعادة تسميته أو تعديل محتواه ضمن `supabase/migrations/` في هذا الجرد.**
