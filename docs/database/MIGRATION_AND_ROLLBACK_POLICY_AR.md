# سياسة Migrations و Rollback — Malek (malik)

**الحالة:** سارية
**تاريخ الإصدار:** 2026-08-04
**النطاق:** `supabase/migrations/`, `supabase/rollback/`
**Guard الآلي المرتبط:** `scripts/check-migration-rollback-hygiene.mjs` (`pnpm check:migration-hygiene`)
**الجرد المرجعي:** `docs/audits/MIGRATION_ROLLBACK_HYGIENE_AUDIT_AR.md`

---

## 1. `supabase/migrations/` هي Forward-only وImmutable بعد الدمج

كل ملف داخل `supabase/migrations/` هو جزء من سلسلة تاريخية تُطبَّق بالترتيب على الإنتاج وعلى كل بيئة Replay نظيفة (Clean Replay). بمجرد دمج الملف في `main`:

- **لا يُحذف.**
- **لا يُعاد تسميته.**
- **لا يتغيّر الـTimestamp الخاص به.**
- **لا يُعدَّل محتواه** بأي شكل، حتى لو كان الهدف "تحسين الصياغة" أو "تصحيح خطأ إملائي" — أي تعديل، مهما كان صغيرًا، يغيّر بصمة السلسلة (checksum) ويكسر التطابق بين ما هو مُطبَّق فعليًا على الإنتاج وما هو موجود في الكود.

الاستثناء الوحيد المقبول لملف تاريخي "يبدو" وكأنه Rollback (مثال موثّق: `20260731190948_rollback_create_maintenance_atomic_rpc.sql`) هو تركه دون أي تعديل وتصنيفه `LEGACY_APPLIED_MIGRATION` في وثيقة الجرد. هذا لأنه **مُطبَّق فعليًا** على الإنتاج كجزء من السلسلة، وحذفه أو نقله سيكسر الـReplay ويغيّر الحالة الفعلية للقاعدة دون أي تغيير مقابل حقيقي فيها.

## 2. Rollback scripts داخل `supabase/rollback/` يدوية فقط

`supabase/rollback/` مخصص حصريًا لسكربتات SQL يدوية تُستخدم في حالات الطوارئ فقط، بواسطة مشغّل بشري يقرأها وينفذها عن قصد. هذه الملفات:

- **لا تُشغَّل تلقائيًا** بأي Workflow أو سكربت CI.
- **لا تدخل ضمن Clean Replay** — تم التحقق مباشرة أن `scripts/ci/run-supabase-database-gate.sh` يستهدف `supabase/migrations/` حصرًا عبر `supabase start` / `supabase migration up`، ولا يقرأ `supabase/rollback/` إطلاقًا.
- **لا تُستبدل بها Forward migration** — هي أداة طوارئ أخيرة، وليست جزءًا من مسار التطوير العادي.

## 3. لا يتم حذف أو تعديل Migration مطبقة

نفس القاعدة رقم 1 بصياغة تشغيلية: إذا اكتُشف أن Migration مُطبَّقة تحتوي على خطأ منطقي أو أمني، **لا يُصلَح الملف نفسه أبدًا**. الإصلاح يكون دائمًا عبر Migration جديدة لاحقة (انظر البند التالي).

## 4. إصلاح الخطأ في Migration مطبقة يتم عبر Forward corrective migration جديدة

النمط الصحيح الوحيد لتصحيح مشكلة في Migration سابقة هو إضافة ملف جديد بـTimestamp أحدث يحتوي على التصحيح (مثال حقيقي من هذا المستودع: `20260706022859_drop_stale_renew_contract_atomic_uuid_overload.sql` الذي يُسقط Overload قديم ثم يُعيد إنشاء الدالة بالتوقيع الصحيح — هذا اتجاه أمامي، وليس Rollback، لأنه لا يعيد القاعدة لحالة سابقة بل يدفعها لحالة جديدة مُصححة).

## 5. Rollback ليس بديلًا عن Forward fix

سكربت الـRollback اليدوي هو **شبكة أمان** لحالة طارئة فعلية (فشل نشر يتطلب استعادة فورية)، وليس أداة تطوير عادية. أي مشكلة تُكتشف أثناء التطوير أو المراجعة تُصحَّح بـForward migration جديدة قبل الدمج — لا يُدمَج Migration معطوب "مع الاعتماد على وجود Rollback جاهز".

## 6. لا يتم تشغيل Rollback scripts في Clean Replay

مسار الـReplay (المحلي عبر `supabase start`، وفي CI عبر `scripts/ci/run-supabase-database-gate.sh` وWorkflow `pr1233-isolated-replay.yml`) يقرأ فقط الملفات ذات المستوى الأعلى (`-maxdepth 1`) داخل `supabase/migrations/*.sql`. أي محاولة لإدخال `supabase/rollback/` ضمن هذا المسار تُرفض تلقائيًا بواسطة Guard القاعدة رقم 6 في `scripts/check-migration-rollback-hygiene.mjs`.

## 7. أي تغيير مالي أو RLS أو RPC يحتاج Migration جديدة واختبارات

أي تعديل على:

- الحسابات المحاسبية (Accounts)، القيود (Journal Entries)، أو منطق الـDebit/Credit.
- سياسات RLS.
- دوال RPC مالية (SECURITY DEFINER functions).

يجب أن يكون عبر Migration أمامية جديدة، مصحوبة باختبارات pgTAP في `supabase/tests/` (خاصة `release_blockers.sql`)، ومراجعة صريحة قبل الدمج. لا يُدفَع أي تغيير من هذا النوع كجزء من "تنظيف" أو "Documentation" — هذا خارج نطاق هذه السياسة تمامًا ويحتاج قرار منتج منفصل.

## 8. لا يجوز وضع أسرار أو Production IDs داخل SQL

- لا مفاتيح API، لا كلمات مرور، لا Service Role Keys داخل أي ملف `.sql` في `migrations/` أو `rollback/`.
- الإشارة إلى `nnggcnpcuomwfuupupwg` (Project Ref) كنص توثيقي في تعليق مقبولة (هي معرّف مشروع وليست سرًّا)، لكن أي بيانات إنتاج حقيقية (IDs لعملاء، عقود، مستأجرين حقيقيين) ممنوعة تمامًا من الظهور داخل SQL.
- يُفحَص هذا آليًا عبر `scripts/check-release-secret-leaks.sh` كجزء من `release-blocker-gate.yml`.

## 9. كيفية تسمية الملفات

### Migrations (`supabase/migrations/`)

```
<YYYYMMDDHHMMSS>_<forward_descriptive_slug>.sql
```

- Timestamp من 14 رقمًا (سنة-شهر-يوم-ساعة-دقيقة-ثانية)، UTC.
- الاسم يصف **ما تفعله** الـMigration (الاتجاه الأمامي)، وليس ما تُرجعه.
- **ممنوع** أن يحتوي الاسم على أي من: `rollback`, `revert`, `undo`, `down`.

### Rollback (`supabase/rollback/`)

```
<timestamp>_rollback_<slug_matching_the_forward_migration>.sql
```

- يجب أن يشير الاسم بوضوح لملف الـMigration الذي يُرجعه.
- كل ملف يجب أن يبدأ بترويسة تحتوي **الاثنين معًا**:
  1. إشارة صريحة لاسم ملف الـMigration الأمامية المقابلة (مثال: `-- Rollback for: 20260804020000_financial_direct_write_hardening_commissions.sql`).
  2. تحذير واضح أنه **يدوي وغير مُطبَّق تلقائيًا** (مثال: `-- Manual rollback — not auto-applied, run by hand only.`).

يفرض `scripts/check-migration-rollback-hygiene.mjs` هذا الشرط آليًا على أي ملف Rollback **جديد** يُضاف من الآن فصاعدًا.

## 10. خطوات المراجعة قبل الدمج

قبل دمج أي PR يلمس `supabase/migrations/` أو `supabase/rollback/`:

1. `pnpm check:migration-hygiene` يجب أن ينجح (بدون Violations؛ تحذيرات Legacy على ملفات base غير معطِّلة).
2. `pnpm supabase:migration-evidence` للتحقق من تسلسل الـTimestamps وعدم وجود تكرار.
3. Clean Replay كامل عبر بوابة `release-blocker-database` في `.github/workflows/release-blocker-gate.yml` (يشمل pgTAP، الاختبارات المالية، RLS).
4. أي تعديل على RLS/RPC مالية يحتاج توقيعًا صريحًا من مالك المنتج، وليس مراجعة كود عادية فقط.
5. التأكد أن أي Migration جديدة تحمل اسمًا أماميًا واضحًا (لا `rollback`/`revert`/`undo`/`down`).
6. التأكد أن أي ملف Rollback جديد يتبع عقد التسمية والترويسة في البند 9 أعلاه.

---

## ملاحظة تاريخية مهمة

هذه السياسة لا تُعيد كتابة أي جزء من تاريخ الـMigrations الحالي. الملفان التاريخيان الوحيدان اللذان يحملان أسماء تشبه Rollback ضمن `supabase/migrations/` (موثّقان بالتفصيل في `docs/audits/MIGRATION_ROLLBACK_HYGIENE_AUDIT_AR.md`) يبقيان كما هما إلى الأبد كجزء من السلسلة المُطبَّقة فعليًا على الإنتاج. هذه السياسة تحكم فقط كل ما يُضاف **من الآن فصاعدًا**.
