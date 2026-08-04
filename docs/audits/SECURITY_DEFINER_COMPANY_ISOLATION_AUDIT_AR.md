# تدقيق عزل الشركات في دوال `SECURITY DEFINER` — FA-004

**المنتج:** Malek  
**نطاق التدقيق:** قراءة فقط، مع إصلاح `update_owner_agreement_atomic` فقط  
**التاريخ:** 2026-08-04  
**الفرع:** `arena/019fcacb-malik` (بيئة Arena تفرض اسم الفرع؛ وهو الفرع العامل المعتمد لهذه الجلسة)

## الملخص التنفيذي

كان آخر تعريف ساري للدالة يقرأ ويحدّث `owner_agreements` باستخدام `id` فقط. كان يستخرج
`company_id` من JWT ثم لا يستخدمه في القراءة أو التحديث. وبما أن الدالة
`SECURITY DEFINER`، فإن الاعتماد على RLS وحده لا يحقق عزل الشركات داخل RPC.

تمت إضافة Migration forward-only تعيد تعريف **نفس التوقيع**. أصبحت قراءة الاتفاقية بقفل صف
مقيدة بـ `id` و`company_id`، وأصبح التحديث مقيدًا بالقيدين نفسيهما مع فحص صريح لـ
`ROW_COUNT = 1`. UUID غير موجود وUUID تابع لشركة أخرى يعيدان الرسالة الموحدة
`AGREEMENT_NOT_FOUND_OR_FORBIDDEN` دون قراءة أو إرجاع أي بيانات من الشركة الأخرى.

## التسلسل الزمني للتعريفات

تم البحث في `supabase/migrations/` و`supabase/rollback/` كاملة، مع ترتيب أسماء الملفات
(ترتيب Supabase الزمني):

| الملف | الحالة | التوقيع | ملاحظات |
|---|---|---|---|
| `20260713000100_owner_agreement_temporal_controls.sql` | Migration قديمة | `(uuid, jsonb) -> owner_agreements` | `SECURITY DEFINER`، `search_path = public, pg_temp`، القراءة والتحديث بـ `id` فقط، وصلاحيات `authenticated, service_role`. |
| `20260722000002_multi_tenant_rpc_company_isolation.sql` | **آخر تعريف سابق للإصلاح** | `(uuid, jsonb) -> owner_agreements` | أضاف متغير JWT للشركة لكنه لم يستخدمه في `SELECT` أو `UPDATE`. |
| `20260723000000_harden_remaining_rpcs_company_isolation.sql` | ليس إعادة تعريف | `(uuid, jsonb)` في أوامر الصلاحيات فقط | سحب التنفيذ من `public, anon, authenticated` ثم منحه لـ `authenticated`. |
| `20260722_rollback_multi_tenant_rpc.sql` | Rollback فقط | `(uuid, jsonb)` | ليس جزءًا من سلسلة forward، ولم يتم تعديله. |
| `20260804000000_fix_owner_agreement_company_isolation.sql` | **التعريف الجديد الساري** | `(uuid, jsonb) -> public.owner_agreements` | إصلاح FA-004 مع الحفاظ على التوقيع، وقفل الصف، والعزل، والتحقق من المدخلات والتدقيق. |

لا يوجد Overload فعال آخر بالاسم نفسه. لم يتم تعديل أي Migration قديمة أو ملف Rollback.

## مصدر الشركة والصلاحيات

- المصدر الموثوق هو `public.require_company_id()`، وهي تستدعي `public.current_company_id()`.
- `current_company_id()` تقرأ `company_id` من `auth.jwt()->'app_metadata'`؛ لا يتم قبول
  `company_id` من العميل كمصدر ثقة.
- غياب سياق الشركة يفشل عبر `require_company_id()` قبل قراءة UUID الاتفاقية.
- الدالة ما زالت `SECURITY DEFINER`، ومالكها `postgres`، و`search_path` مثبت إلى
  `public, pg_temp` مع تأهيل الجداول والدوال الحساسة بـ `public.`.
- أعيد تطبيق الصلاحيات: `REVOKE ALL` من `public, anon` و`GRANT EXECUTE` إلى
  `authenticated, service_role`، مع بقاء الحماية التشغيلية الحالية التي تمنح المستخدم
  الفعلي `authenticated` فقط.

## ما تم إصلاحه داخل RPC

1. `SELECT ... FROM public.owner_agreements ... WHERE id = p_agreement_id AND company_id = v_company_id FOR UPDATE`.
2. `UPDATE public.owner_agreements ... WHERE id = p_agreement_id AND company_id = v_company_id`.
3. فحص صريح لـ `ROW_COUNT` بعد التحديث.
4. تحقق مباشر من أن المالك والعقار الحاليين ينتميان إلى الشركة نفسها، دون استنتاج الشركة
   من `owner_id` أو `property_id`.
5. `owner_id` و`property_id` و`company_id` ليست حقول نقل في مسار التعديل؛ إذا أرسل العميل
   قيمة مختلفة يُعاد `AGREEMENT_RELATIONSHIP_IMMUTABLE`.
6. تحقق خادمي من `RATE` (من 0 إلى 100)، و`FIXED_MONTHLY` (قيمة غير سالبة)، والنوع،
   والقيم غير الصالحة مثل `NaN`/`Infinity`، وصحة الفترة الزمنية.
7. نجاح التعديل يسجل actor وcompany وagreement وtimestamp والحقول المتغيرة في آلية
   `public.audit_log` القائمة، بلا إنشاء نظام Audit جديد.

## نتائج تدقيق محدود للدوال الأخرى

التدقيق كان تصنيفيًا ولم يغير الدوال الأخرى. التصنيف التالي يحدد العمل اللاحق فقط:

| التصنيف | النتيجة |
|---|---|
| **P0** | لا توجد نتيجة أخرى مثبتة ضمن نطاق هذا التدقيق تتطلب إدخالًا في هذه Migration. الثغرة المحددة في `update_owner_agreement_atomic` عولجت هنا. |
| **P1** | توجد دوال `SECURITY DEFINER` تاريخية/مساعدة في المستودع تحتاج مراجعة مستقلة إذا ظهر أن قراءاتها أو كتاباتها لا تفرض `company_id` داخل جسمها؛ لم تُلمس لأنها خارج FA-004. |
| **P2** | بعض تعريفات RPC القديمة تستخدم رسائل أعمال غير موحدة أو تستنتج علاقات من UUID؛ يلزم تحليل كل مسار مع اختبارات tenant منفصلة. لم تُصلح. |
| **P3** | توحيد رسائل الخطأ والتوثيق العام لبقية الدوال، وتحسين تغطية اختبارات الأمن الساكنة. مؤجل. |

يوجد فحص عام في `supabase/tests/security_drift_checks.sql` لعزل RLS و`search_path` وACL؛
أضيف فحص FA-004 المحدد في `supabase/tests/owner_agreement_company_isolation.sql`.

## الاختبارات المرتبطة

الاختبار المضاف يتحقق من تعريف الدالة المنشور فعليًا: فلاتر الشركة في القراءة والتحديث،
قفل الصف، فحص عدد الصفوف، helper الشركة، رسالة الخطأ الموحدة، immutable relationships،
تحقق العمولة، `search_path`، ACL، وسجل Audit.

أصبح اختبار التكامل الحقيقي في `supabase/tests/owner_agreement_company_isolation.sql`، ويُشغّل ضمن
Isolated Supabase Replay بعد تطبيق سلسلة Migrations من قاعدة فارغة. ويغطي شركة A وشركة B،
التعديل داخل الشركة، رفض UUID من الشركة الأخرى، UUID غير موجود بنفس SQLSTATE والرسالة،
ثبات اتفاقية B، ومحاولات تغيير `owner_id` و`property_id`، إضافة إلى `commission_value` null/empty.
كما يضيف `scripts/ci/run-owner-agreement-concurrency-test.sh` معاملتين PostgreSQL حقيقيتين
على نفس الصف، ويُستدعى من `scripts/ci/run-supabase-database-gate.sh` بعد `supabase test db`.

**نتيجة التنفيذ الفعلية حتى 2026-08-04:** تم تشغيل الـ Replay مرتين على CI، لكن بوابة
`Fresh Docker-backed replay, pgTAP lifecycle, RLS and cleanup` انتهت بالفشل قبل نشر نتيجة
نجاح لاختبار FA-004؛ لذلك لا أسجل نجاحًا زائفًا ولا أعتبر الاختبار مغلقًا. لا تتوفر سجلات
Azure Actions التفصيلية في بيئة التنفيذ الحالية، وتبقى إعادة التشغيل/تشخيص سبب فشل قاعدة
البيانات مطلوبة قبل الإغلاق.

## خارج النطاق والمؤجل

لم يتم تغيير أي قيد أو حساب محاسبي، ولا التسويات، ولا التقارير، ولا `master_lease`، ولا
VAT أو التقريب، ولا Backfill، ولا البيانات التاريخية، ولا UI غير المرتبط. FA-003 وFA-008
وPR-B وPR-C وPR-D والمرحلة الثالثة لم تبدأ.
