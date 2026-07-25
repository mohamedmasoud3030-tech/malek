# Rentrix Comprehensive Codebase Audit — 2026-07-25

## ملخص تنفيذي

- **P0 — Critical:** 0 مشاكل جديدة مؤكدة آليًا.
- **P1 — High:** 1 مشكلة مؤكدة وتم إصلاحها في هذا الفرع.
- **P2 — Medium:** 2 ملاحظات موثقة تحتاج تحقق/تنظيف لاحق.
- **P3 — Low:** 2 ملاحظات جودة/اختبار غير حاجبة.

النطاق المنفّذ: فحص static للـTypeScript/Supabase contracts، فحص migrations المحلية، replay اختبارات مالية/PGlite، build/typecheck، واختبارات browser/E2E المتاحة محليًا. لم يتم تطبيق أي mutation على قاعدة الإنتاج.

## P0 — Critical

- لا توجد P0 مؤكدة من الفحص المحلي الحالي.

## P1 — High

- **فرض `property_id` كـUUID في مسارات مالك/تسوية مع أن `properties.id` قد يكون `text` live**
  - **المواقع:**
    - `supabase/migrations/20260725000000_p1_owner_settlement_server_derivation.sql`
    - `supabase/migrations/20260729090000_phase3a1c_owner_settlement_account_resolution.sql`
    - `supabase/migrations/20260724120000_p0_company_isolation_reports_rls.sql`
  - **الأثر:** مسارات `calculate_owner_net_payout` و`create_owner_settlement_draft_atomic` و`create_owner_agreement_atomic` يمكن أن تفشل عند property ids غير UUID، ما يكسر إنشاء/معاينة تسويات الملاك أو اتفاقيات الملاك بدلًا من قبول الـtext id الصحيح.
  - **الإصلاح المطبق:**
    - أضيفت هجرة `20260729091000_p1_owner_settlement_property_text_compatibility.sql` لتعريف `calculate_owner_net_payout(uuid,date,date,text)` بدل overload الـUUID للـproperty filter، وتحديث draft settlement لاستدعاء الـRPC بدون `v_property_id::uuid`.
    - تم تحديث `create_owner_agreement_atomic` ليستخدم `%TYPE` للـ`owner_agreements.property_id` ويقارن بـ`::text` بدل cast مباشر لـUUID.
    - يتم إسقاط overload القديم `calculate_owner_net_payout(uuid,date,date,uuid)` لتجنب ambiguity في PostgREST RPC resolution.
    - أضيف rollback مرافق: `supabase/rollback/20260729_rollback_p1_owner_settlement_property_text_compatibility.sql`.
  - **اختبارات الحماية:**
    - `rentrix-app/src/features/owners/owner-property-text-identifier-migration-contract.test.ts`
    - تحديث `rentrix-app/src/p1/p1-owner-settlement-integrity.test.ts`
    - تحديث عزل `rentrix-app/src/p3/phase3a1c-forward-rollback.test.ts`

## P2/P3

### P2 — Medium

- **Live migration/schema reconciliation غير مؤكد محليًا**
  - `pnpm supabase:migration-evidence` نجح في preflight المحلي، لكن reconciliation مع Supabase live كان **BLOCKED** لعدم توفر `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_URL`/`VITE_SUPABASE_URL` محليًا.
  - المطلوب قبل أي production apply: تحقق read-only من live `pg_proc`, `information_schema`, ledger `supabase_migrations.schema_migrations`.

- **مخلفات casts تاريخية في migrations أقدم**
  - توجد casts أقدم لـ`property_id::uuid` في migrations تاريخية، لكنها أصبحت superseded بالهجرة الجديدة في clean replay.
  - أبقيتها دون تعديل لتجنب إعادة كتابة تاريخ migrations؛ التحقق الحاسم هو آخر definition في replay/live.

### P3 — Low

- **تحذيرات اختبارات موجودة مسبقًا**
  - بعض اختبارات RTL/React تظهر تحذيرات `act(...)` وRadix Dialog description، لكنها لا تفشل suite ولم تتغير في هذا العمل.

- **استخدامات `any` في طبقات Supabase service**
  - موجودة لتجاوز drift بين generated types/live schema. لم يتم تنظيفها في هذا الفرع حتى لا يتحول الإصلاح إلى refactor واسع.

## يحتاج تحقق يدوي (مش ممكن التأكد منه آليًا هنا)

- **Live Supabase:** تأكيد read-only أن production/staging بعد تطبيق الهجرة يحتوي:
  - `public.calculate_owner_net_payout(uuid,date,date,text)`
  - عدم وجود/عدم استخدام overload `uuid,date,date,uuid`
  - `create_owner_settlement_draft_atomic` لا يحتوي `v_property_id::uuid`
  - `create_owner_agreement_atomic` لا يحتوي `(payload->>'property_id')::uuid`
- **Browser حقيقي ببيانات staging:** تشغيل flow مالك → عقار → اتفاقية مالك → عقد → تحصيل → معاينة تسوية → إنشاء Draft → Approve → Pay، خاصة مع property id نصي غير UUID إن وجد في live.
- **ملاحظة مهمة:** أخطاء Supabase JS داخل React SPA لا تظهر دائمًا في Vercel runtime logs؛ يلزم browser verification فعلي.

## حالة الـbuild

- `corepack pnpm --filter ./rentrix-app run typecheck` — **PASS**
- `corepack pnpm --filter ./rentrix-app run typecheck:test` — **PASS**
- `corepack pnpm --filter ./rentrix-app run test:financials` — **PASS**: 61 files / 276 tests
- `corepack pnpm --filter ./rentrix-app run test` — **PASS**: 227 files / 1098 tests
- `corepack pnpm --filter ./rentrix-app run build` — **PASS**
- `corepack pnpm run supabase:migration-evidence` — **PASS local preflight**, live reconciliation **BLOCKED** بسبب غياب Supabase credentials محليًا
- `bash scripts/check-release-secret-leaks.sh` — **PASS**
- `bash scripts/check-production-mutation-guard.sh` — **PASS**
- Browser/E2E المتاح محليًا قبل الهجرة غير المرئية UI:
  - full desktop Playwright: **138 passed / 11 skipped**
  - readiness smoke all projects: **15 passed / 3 skipped**

## ملاحظات الإصدار

- لم يتم تعديل بيانات إنتاج، RLS، أو جداول مباشرة في البيئة الحية من هذا الفحص.
- الهجرة الجديدة يجب أن تمر عبر PR/CI ثم apply مع صلاحيات Supabase المعتمدة فقط.
