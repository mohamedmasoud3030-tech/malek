# بيئة الإعادة (PGlite) مقابل Supabase الحقيقية — الموازية والفروق الموثقة

الغرض: أي فرق بين بيئة إعادة التشغيل المعزولة وبين Supabase يُوثّق هنا و**لا يُسجَّل ثغرة إنتاج**.

| البند | إعادة PGlite (`src/p0/replay-stubs.ts`) | Supabase الحقيقية | الحكم |
|---|---|---|---|
| أدوار `anon/authenticated/service_role` | تُنشأ بلا `SUPERUSER` ولا `BYPASSRLS` (أهلية مطابقة) | أدوار المنصة | مطابق وظيفيًا لاختبارات RLS |
| `GRANT USAGE ON SCHEMA auth` | **أُضيفت صراحة للمحاكاة** بعد إثبات غيابها (`cause/auth-privilege-state.json`) | منحة منصّة افتراضية (تتطلبها كل سياسة تستدعي `auth.*()`) | فرق بيئة صُحّح في الـstub — ليس ثغرة إنتاج |
| `auth.jwt()/uid()/role()` | SQL stubs تقرأ `request.jwt.claims` | GoTrue + PostgREST يحقنان الـGUC من JWT الموقّع | نفس الشكل داخل الاستعلام؛ سرّية التوقيع خارج النطاق (لا JWTs حقيقية في الأدلة) |
| ملكية الجداول/الدوال | postgres | postgres / supabase_admin | أدوار الاختبار ليست مالكة إطلاقًا — لا أثر على الاستنتاجات |
| `pg_cron` | `CREATE EXTENSION` تُحذف في الذاكرة فقط (`REPLAY_TRANSFORMS`) مع stub `cron.schedule` | متوفّر | جدولة الوظائف لا تمس عزل الشركة |
| ملف `20260713000005_fix_void_receipt_anon_grant.sql` | `RAISE EXCEPTION` خفّض إلى `WARNING` في الذاكرة فقط؛ ادعاءات المنح تحققت ساكنًا | يمرّ على المنصة | فرق سلسلة منح env-specific — موثق |
| FORCE ROW LEVEL SECURITY (`deposit_txs`, `owner_settlements`, `tenants`) | مطبق كما في السلسلة | مطبق | مطابق |
| دوال SQL‑language في-line من الدوال المستدعية لـ `auth.*` | تُقيَّم كتعبيرات مضمّنة (التخطيط يضمّن SQL‑functions) | نفس سلوك المخطّط | مطابق |

الخلاصة: كل نتيجة في `cause/` و`behavioral-isolation.json` قابلة للنقل إلى الإنتاج لأن أدوار الجلسة واقعية (`authenticated` غير مالك ودون BYPASSRLS بمطالبات JWT ثابتة)، والفروق الوحيدة المنصوص عليها أعلاه إما صُحّحت في طبقة المحاكاة بشفافية أو لا تمس مسارات العزل. التحقق الحي النهائي: بوابة CI الحية أو فحص BEGIN/ROLLBACK آمن (موثق في تقرير P0 §٩).
