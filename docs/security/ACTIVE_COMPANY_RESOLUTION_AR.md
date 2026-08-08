# عقد تحديد الشركة النشطة (Active Company Resolution)

تاريخ التوثيق: 2026-08-07

## 1. المشكلة الأصلية

التطبيق كان يدخل في حالة fail-closed ويعرض «تعذر تحديد الشركة النشطة» حتى
لمستخدمين لديهم عضوية فعلية صحيحة في `company_members`. الأسباب الجذرية:

1. **كان `CompanyProvider` يعتمد على claim الجاهز في JWT فقط** — أي أن
   `app_metadata.company_id` لو كان غائبًا أو قديمًا (توكن مُخزّن قبل إنشاء
   العضوية، أو صادر قبل تحديث الـhook)، لا يوجد مسار شرعي لاستعادته، فتقفل
   الواجهة نهائيًا رغم وجود عضوية مصرّح بها.
2. **كتابة `updateUser({ data: { company_id } })` كانت تذهب إلى
   `user_metadata` بينما كل القراءة تتم من `app_metadata`** — والـhook المنشور
   في البيئة الحية (نسخة Phase 5) كان يتجاهل `user_metadata` نهائيًا ويحقن دومًا
   أول عضوية، فيفشل `switchCompany` لأي مستخدم متعدد الشركات بعد التحقق.
3. **شاشة الخطأ نفسها كانت غير قابلة للوصول في حالات الفشل** لأن `resolvedUserId`
   كان يُصفَّر عند الخطأ، فتعارض بوابة الانتقال (`authenticatedUserId !== resolvedUserId`)
   عرض شاشة fail-closed ويبقى المستخدم على سبينر لا نهائي.
4. **العميل كان يتحقق من claim في المكان الخطأ بعد تفعيل Custom Access Token
   Hook.** الخطاف يضيف `app_metadata.company_id` إلى **claims الخاصة بالـJWT
   الصادر**، لكنه لا يلزم أن يكتب هذا الحقل إلى سجل `auth.users.raw_app_meta_data`.
   لذلك قد يظل `session.user.app_metadata.company_id` فارغًا رغم أن
   `session.access_token` نفسه يحمل claim صحيحًا وتراه PostgreSQL/RLS بصورة سليمة.

## 2. عقد الحل (ثلاث طبقات، fail-closed)

1. **`company_members` هو مصدر الحقيقة الوحيد** لتحديد الشركات المسموح بها.
   الـProvider يقرأ العضويات النشطة في شركات نشطة، مرتّبة بـ
   `ORDER BY created_at, id` — نفس ترتيب بدائل الـhook — ولا يعرض أي شركة
   خارج هذه القائمة.
2. **`user_metadata.company_id` مجرّد رغبة غير موثوقة من المتصفح.** لا تصبح
   ملزمة إلا بعد أن يتحقق منها **الخادم**: دالة `custom_access_token_hook`
   (migration `20260807133000_multi_company_jwt_selection.sql`) تتحقق من أن
   الشركة المطلوبة عضوية نشطة في شركة نشطة، ثم تحقن `app_metadata.company_id`
   أثناء إصدار التوكن. المتصفح لا يستطيع كتابة `app_metadata` مباشرة أبدًا.
3. **الواجهة لا تُفتح إلا بتوافق ثلاثي:** الـclaim الصادر من الخادم = شركة من
   قائمة العضويات = الشركة المعروضة. كل RLS وكل RPC مالي SECURITY DEFINER
   يشتق المستأجر من `public.current_company_id()` (نفس الـclaim)، لذلك أي
   fallback محلي من جانب العميل فقط كان سيجعل الواجهة معزولة عن المستأجر الذي
   تراه PostgreSQL — ولهذا أي عدم توافق غير قابل للحسم يفشل مغلقًا بدل
   «تجاوز شكلي» للعزل.

### مصدر الـclaim في العميل

مصدر الشركة الموثوق للواجهة هو **payload الخاص بـ`session.access_token` نفسه**،
وتحديدًا `app_metadata.company_id` داخل الـJWT. لا يُستخدم
`session.user.app_metadata.company_id` كسلطة لتحديد المستأجر، لأن كائن المستخدم
يمثل بيانات Auth المخزّنة وليس مضمونًا أن يعكس claims المؤقتة التي أضافها
Custom Access Token Hook وقت إصدار التوكن. بذلك يقرأ العميل نفس claim الذي يصل
إلى PostgREST و`public.current_company_id()`، ويظل أي token مفقود/مشوّه fail-closed.

## 3. مسار الاستدلال في العميل (`use-company.tsx`)

1. الـclaim المقروء من `session.access_token` يطابق عضوية ← يُعتمد فورًا.
2. لا يطابق ← `refreshSession()` واحدة (بلا كتابة) لإعادة اشتقاق الـclaim
   خادميًا — يغطي التوكن المُخزّن القديم، ثم تُقرأ النتيجة من access token الجديد.
3. لا يزال لا يطابق ← يُحسم الافتراضي الحتمي من العضويات، تُخزَّن الرغبة عبر
   `updateUser({ data: { company_id } })`، يُعاد التحديث، و**يُتحقق من أن
   claim الموجود في access token الصادر فعلًا يساوي الشركة المحسومة** قبل الفتح.
4. صفر عضويات، خطأ استعلام، token غير صالح، أو رفض الخادم إصدار claim مطابق ←
   fail-closed مع زر «إعادة المحاولة».

`switchCompany` يطبق نفس البروتوكول: رغبة ← تحديث ← تحقق من access token ← ثم
قراءة الدور من صف العضوية نفسه (لا من الطلب)، ومسح كاش الاستعلامات قبل عرض
الشركة الجديدة.

## 4. خطوات النشر المطلوبة (إلزامية)

الإصلاح متكامل بين العميل وmigration الخطاف:

1. تطبيق `supabase/migrations/20260807133000_multi_company_jwt_selection.sql`
   على البيئة المستهدفة (staging ثم production). بدونه يبقى الـhook القديم
   يتجاهل تفضيل المستخدم، وستظل مزامنة الخطوة 3 تفشل مغلقة عن قصد.
2. التأكد من تفعيل Custom Access Token Hook في إعدادات Auth الخاصة بالمشروع
   (Supabase Dashboard → Authentication → Hooks → Custom Access Token ←
   `public.custom_access_token_hook`). التوكنات لا تُحقن بـ`company_id` دون
   هذا التفعيل مهما كانت الدالة صحيحة.
3. التحقق بعد النشر:
   - استعلام `prosrc` للدالة يتضمن `raw_user_meta_data` (نسخة التفضيل).
   - تسجيل دخول مستخدم شركة واحدة يفتح `/dashboard` مباشرة حتى لو لم يحتوِ
     `session.user.app_metadata` على `company_id`، بشرط وجوده في access token.
   - مستخدم شركتين يبدّل A↔B وتتحدث البيانات فورًا ولا تظهر رسالة القفل.

## 5. الاختبارات

- `rentrix-app/src/hooks/use-company.test.tsx` — سلوكي كامل بالمحاكاة:
  يبني Session بالشكل المطابق للبيئة الحية: `company_id` موجود في JWT فقط وغير
  موجود عمدًا في `session.user.app_metadata`. يغطي مستخدم شركة واحدة (claim
  جاهز / توكن قديم يتعافى بالتحديث / مزامنة تفضيل مع تحقق)، مستخدم multi-company
  (التقاط الـclaim الثاني، تبديل ناجح، تبديل يرفضه الخادم فيقفل)، وجلسات
  (تسجيل خروج/دخول مستخدم آخر بدون تسريب مستأجر)، وكل مسارات القفل.
- `rentrix-app/src/hooks/use-company-regression.test.ts` — عقد نصي يمنع
  إعادة قراءة المستأجر من Auth user object أو إدخال fallback محلي غير متحقق منه.
- `supabase/tests/two_company_readiness.sql` — بوابة pgTAP على الخادم: حقن
  الـclaim، التبديل A↔B، رفض العضوية المعطّلة، وعزل RLS بين شركتين.
- بوابة قاعدة البيانات الكاملة (`scripts/ci/run-supabase-database-gate.sh`)
  تعيد تشغيل كل الـmigrations وتشغّل pgTAP على Postgres حقيقي.
