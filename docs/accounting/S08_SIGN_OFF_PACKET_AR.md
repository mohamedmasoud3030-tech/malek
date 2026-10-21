# حزمة اعتماد S08 — التحليل التاريخي للقراءة فقط

> **الحالة:** `READY_FOR_SIGNATURE` — الحزمة جاهزة. **التوقيع لم يُمنح**، ولا يجوز افتراضه.
> **التاريخ:** 2026-10-21
> **الأساس المرجعي:** `main@d64703003c84`
> **السُّلطة المطلوبة:** المحاسب (Accountant) — وفق `REL-004` و`D18`.
> **الغرض:** تحويل `GAP-015/GAP-016` من «محجوبة بتوقيع» إلى «جاهزة للتوقيع في جلسة مراجعة واحدة».

---

## 1. لماذا هذه الحزمة موجودة

`REL-004` يمنع أي تصحيح تاريخي قبل اعتماد تحليل S08 للقراءة فقط. الوكيل لا يملك سلطة منح هذا الاعتماد،
ولا يجوز له اختراعه. لكن الوكيل **يملك** أن يجعل مهمة المحاسب قصيرة وقابلة للتدقيق:

1. تحديد السؤال المحاسبي بدقة.
2. إثبات أن ضوابط قاعدة البيانات تمنع تجاوز البوابة حتى لو حاول أحد.
3. توفير الاستعلامات والخطوات التي يراها المحاسب بنفسه.
4. تحديد ما يترتب على التوقيع بالضبط، وما لا يترتب.

---

## 2. السؤال المطلوب اعتماده (دقيق ومحدود)

هل يعتمد المحاسب أن **التحليل التاريخي للقراءة فقط** — بصيغته المنفذة — يمثل أساسًا سليمًا
للبدء في **S09 (التصحيح التاريخي الإضافي فقط)**، ضمن النطاق التالي؟

| البند | داخل الاعتماد | خارج الاعتماد |
| --- | --- | --- |
| نطاق البيانات | بيانات الشركة/الفترة المحددة في المراجعة المجمّدة | أي شركة أو فترة أخرى |
| نوع التحليل | قراءة فقط: استثناءات الودائع، ازدواج التسويات، تصنيف المصروفات | أي كتابة أو تعديل |
| الأساس | بصمة SHA256 مجمّدة ومُعاد إنتاجها بشكل حتمي | أي افتراض عن بيانات غير مفحوصة |
| الأثر | يسمح بإنشاء مقترحات تصحيح **مقترحة** فقط | لا يسمح بتطبيق أي قيد تصحيح |

**ما لا يعنيه التوقيع:** لا يعني أن الأرقام التاريخية صحيحة، ولا أنه يقرّ بأي تصحيح بعينه. يعني فقط أن
الأساس التحليلي سليم بما يكفي لبدء اقتراح تصحيحات تُراجع لاحقًا.

---

## 3. ما يمنعه النظام بالفعل (وليس مجرد اتفاق)

هذه ليست وعودًا في مستند؛ هي كائنات قاعدة بيانات موجودة في `20260901000000_canonical_baseline.sql`
وتم التحقق من وجودها في هذا الالتزام:

| الكائن | الوظيفة |
| --- | --- |
| `s08_frozen_reviews` | جدول المراجعات المجمّدة — إضافي فقط (append-only) |
| مُشغِّل الحماية | يمنع `UPDATE`/`DELETE` إلا عبر RPCs مصرّح لها (`malik.s08_review_change_authorized`) |
| `s08_compute_dataset_fingerprint` | بصمة SHA256 حتمية لـGL والدفاتر الفرعية |
| `s08_verify_fingerprint` | حماية من إعادة التشغيل: ترفض البصمة غير المطابقة |
| دورة الحياة | `CREATED → ANALYZED → … → APPROVED \| REJECTED` بحراسات طرفية |
| `s08_approve_frozen_review` | تتطلب دور `ACCOUNTANT` للانتقال إلى `APPROVED` |
| `s09_corrections` + `s09_apply_correction` | ترفض أي تصحيح غير مرتبط بمراجعة `APPROVED` |

**دليل تنفيذي:** الاختبار `malek-app/src/features/financials/services/s09-correction.pglite.test.ts`
يشغّل هذا على PostgreSQL 18 حقيقي، ومنه حالة صريحة:
`refuses a correction anchored to a review that is not APPROVED`.

تشغيله:

```bash
corepack pnpm evidence:live --only GAP-015
corepack pnpm evidence:live --only GAP-016
```

---

## 4. خطوات المراجعة (تقديريًا 60–90 دقيقة)

### الخطوة 1 — إنشاء المراجعة المجمّدة

> **توقيعات الدوال أدناه منقولة حرفيًا من `20260901000000_canonical_baseline.sql` عند `d647030`.**

```sql
-- الشركة تُشتق من الجلسة عبر require_company_id() وليست معاملًا.
select public.s08_create_frozen_review(
  p_payload => jsonb_build_object(
    'accounting_period_id', :period_id,
    'analysis_version',     'v1',
    'evidence_reference',   :evidence_ref,
    'dataset_lineage',      :lineage,
    'review_scope',         '{}'::jsonb,
    'analysis_results',     '{}'::jsonb,
    'reconciliation_evidence', '{}'::jsonb,
    'exceptions',           '[]'::jsonb
    -- 'dataset_fingerprint' يُحسب تلقائيًا إن لم يُمرَّر
  )
);
```

سجّل الناتج: `review_id` و`dataset_fingerprint`. **البصمة هي أساس الاعتماد** — أي تغيير لاحق في
البيانات يجعلها غير صالحة تلقائيًا.

### الخطوة 2 — تشغيل التحليلات الثلاثة وتسجيلها في المراجعة

```sql
-- 1) استثناءات الودائع
select * from public.s08_analyze_deposit_exceptions(:company_id, :period_id);

-- 2) ازدواج التسويات
select * from public.s08_analyze_settlement_duplicates(:company_id, :period_id);

-- 3) سوء تصنيف المصروفات
select * from public.s08_analyze_expense_misclassification(:company_id, :period_id);

-- 4) القيود اليتيمة (ترحيل بلا مصدر)
select * from public.s08_orphan_postings(:company_id, :period_id);
```

لكل صف: هل التفسير (`explanation`) مقبول محاسبيًا؟ هل الخطورة (`severity`) مناسبة؟ هل هناك استثناء
يجب استبعاده من نطاق التصحيح؟

ثم ثبّت النتائج على المراجعة (تصبح غير قابلة للتعديل بعدها):

```sql
select public.s08_analyze_frozen_review(
  p_review_id => :review_id,
  p_analysis_results => :analysis_json,
  p_reconciliation_evidence => :reconciliation_json,
  p_exceptions => :exceptions_json
);
```

### الخطوة 3 — التحقق من البصمة قبل الاعتماد

```sql
select public.s08_verify_fingerprint(:review_id);
```

إذا فشل التحقق: **توقف**. لا يُعتمد تحليل على بيانات تغيّرت بعده.

### الخطوة 4 — قرار المحاسب

```sql
-- اعتماد
select public.s08_approve_frozen_review(
  p_review_id => :review_id,
  p_notes     => :review_notes
);

-- أو رفض
select public.s08_reject_frozen_review(
  p_review_id => :review_id,
  p_reason    => :reject_reason
);
```

### الخطوة 5 — بعد الاعتماد (S09) — لا يتم تلقائيًا

1. `wp05_generate_correction_proposals(p_as_of, p_request_id, p_accounting_period_id)` يولّد **مقترحات** فقط.
2. `s09_create_correction_draft(p_payload)` ثم `s09_validate_correction(p_correction_id)`.
3. `s09_apply_correction(p_correction_id)` يُنشئ قيدًا تعويضيًا إضافيًا — **لا يعدّل أي قيد مُرحّل**.
4. العكس عبر `s09_reverse_correction(p_correction_id, p_reason)`.

**كل مقترح يراجعه المحاسب فردًا فردًا. لا تطبيق جماعي.**

---

## 4.1 جدول التوقيعات (للتحقق السريع)

<!-- sql-signatures:start -->
| الدالة | التوقيع |
| --- | --- |
| `s08_create_frozen_review` | `(p_payload jsonb) → jsonb` |
| `s08_analyze_frozen_review` | `(p_review_id uuid, p_analysis_results jsonb, p_reconciliation_evidence jsonb, p_exceptions jsonb) → jsonb` |
| `s08_verify_fingerprint` | `(p_review_id uuid) → jsonb` |
| `s08_approve_frozen_review` | `(p_review_id uuid, p_notes text) → jsonb` |
| `s08_reject_frozen_review` | `(p_review_id uuid, p_reason text) → jsonb` |
| `s08_list_frozen_reviews` | `(p_period_id uuid) → jsonb` |
| `s09_create_correction_draft` | `(p_payload jsonb) → jsonb` |
| `s09_validate_correction` | `(p_correction_id uuid) → jsonb` |
| `s09_apply_correction` | `(p_correction_id uuid) → jsonb` |
| `s09_reverse_correction` | `(p_correction_id uuid, p_reason text) → jsonb` |
<!-- sql-signatures:end -->

> تحقّق من هذه القائمة عند أي التزام مختلف؛ أسماء المعاملات قد تتغير.
> `node scripts/live-evidence/run.mjs --only GAP-015` يشغّل الضوابط على المخطط الحقيقي.

## 5. سجل التوقيع

يُملأ يدويًا بعد المراجعة. لا يجوز لوكيل تعبئته.

| الحقل | القيمة |
| --- | --- |
| القرار | ☐ `APPROVED` ☐ `REJECTED` |
| `review_id` | |
| البصمة `fingerprint` | |
| الشركة | |
| الفترة المحاسبية | |
| نطاق الاعتماد | التحليل للقراءة فقط؛ لا يقرّ أي تصحيح بعينه |
| سبب القرار | |
| الاسم | |
| الصفة | ☐ محاسب ☐ مالك المنتج ☐ أخرى: |
| التاريخ | |
| التوقيع / المرجع | |

---

## 6. ما يتغيّر بعد التوقيع

| قبل | بعد |
| --- | --- |
| `GAP-015` — التحليل المجمّد غير معتمد | يُغلق عند اعتماد مراجعة مجمّدة ببصمة مطابقة |
| `GAP-016` — التصحيح التاريخي محجوب | يصبح قابلاً للتشغيل على النطاق المعتمد فقط |
| `S09` — محجوب على مستوى قاعدة البيانات | يفتح للنطاق المعتمد؛ يظل محجوبًا لبقية النطاق |

**ما لا يتغيّر:** لا يُمنح Stage Credit تلقائيًا، ولا تُغلق `GAP-013/014` (التقارير تحتاج دليلًا حيًا)،
ولا يصبح المشروع جاهزًا لإطلاق تاريخي.

---

## 7. المراجع

- `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md` — `REL-004`.
- `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md` — صفوف `GAP-015` و`GAP-016`.
- `supabase/migrations/20260901000000_canonical_baseline.sql` — الكائنات أعلاه.
- `malek-app/src/features/financials/services/s09-correction.pglite.test.ts` — الدليل التنفيذي.
- `docs/evidence/live-evidence.md` — نتائج التشغيل عند الالتزام الحالي.
