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
- ⏳ المتبقي حوكمي فقط: خُضر CI على #1276 → دمج squash → فحص حي آمن (CI live أو BEGIN/ROLLBACK بدور واقعي). **P1 (أرقام التسوية الموثوقة من العميل — الإثبات مستقل وجاهز) يبدأ بعد الدمج من أحدث main في PR مستقل.**

## الأولوية القادمة — تحديث

`supabase/migrations_consolidated/` اتشال نهائياً (2026-07-23): كان مجلد ميت ومتناقض مع نفسه — الـ README بتاعه بيشاور لملفين (`CONSOLIDATION_MAPPING.md`, `CANDIDATES_FOR_REMOVAL.md`) اتمسحوا من زمان في PR #1201، ومستند `supabase/migrations/README.md` كان بيقول إن المجلد ده "اتشال" من 2026-07-18 بينما هو لسه موجود فعلياً. اتأكد إن مفيش أي CI/script بيعتمد عليه قبل الحذف.

باقي: **149 ملف في `supabase/migrations/` نفسها** — الملفات دي هي الترحيلات الحقيقية والمطبقة فعلياً على production (تطابق 149/149 مع الـ ledger، تحقق منه في `APP_STATUS.md`). التوحيد المطلوب هنا مش حذف ملفات فعلية، لكن فحص الأزواج متشابهة الاسم (زي `reconcile_unit_legacy_rent` مرتين) للتأكد إنها كلها نمط stub/alias موثق ومش تكرار خفي لمنطق متضارب — ده شغل تدقيق منفصل لكل ملف، مش عملية حذف جماعية.

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
