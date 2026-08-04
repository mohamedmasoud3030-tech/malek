# 0009. Malek canonical accounting and contract-rights model

## Status

**PROVISIONAL ACCOUNTING BASELINE AND DECISION GATE**

هذا المستند مرجع مرحلي معتمد لاسم المنتج والقرارات التشغيلية التي حُسمت، لكنه ليس اعتمادًا قانونيًا أو ضريبيًا نهائيًا للقرارات التي تعتمد على عقود فعلية غير موجودة في المستودع.

- اسم المنتج الرسمي: `Malek`.
- اسم المستودع التقني الحالي: `mohamedmasoud3030-tech/malik`.
- أسماء المسارات التقنية مثل `rentrix-app/` لا تُغيَّر ضمن هذا القرار.

## Context

يمتلك المشروع قرارات منتج سابقة وبنية GL وRPCs مالية متطورة، لكنه لا يحتوي على عقود قانونية فعلية تثبت بصورة نهائية حقوق المكتب والمالك والمستأجر. لذلك تفصل هذه المرحلة بين:

1. القرار التشغيلي المعتمد.
2. الترجيح المحاسبي.
3. القرار القانوني أو الضريبي المحجوب.

هذه المرحلة Documentation-only. لم تُنشئ أو تعدّل Migration أو RPC أو RLS أو Trigger أو Journal Entry أو Backfill أو خدمة Frontend.

## Decision

### 1. property_management

الخط الأساسي المرحلي:

```text
principal_agent_role = AGENT
presentation = NET
collection_role = OWNER_IS_CREDITOR (PROVISIONAL)
```

- كامل الإيجار ليس إيرادًا للمكتب.
- إيراد المكتب هو العمولة أو الرسم المستحق له.
- إجمالي الإيجارات المدارة مؤشر تشغيلي منفصل.
- `OWNER_IS_CREDITOR` ترجيح يحتاج عقد إدارة فعليًا قبل Backfill أو اعتماد قانوني نهائي.
- إصدار الفاتورة باسم الشركة تقنيًا لا يثبت وحده أن المكتب هو الدائن القانوني.

### 2. master_lease

- نشاط مستقل عن إدارة أملاك الغير.
- المكتب مرجح أن يكون أصيلًا تجاه المستأجر الفرعي.
- الالتزام تجاه المالك قد يستمر رغم الخواء.
- القيد الشهري المبسط ليس نموذجًا محاسبيًا كاملًا.
- أصل حق الاستخدام، التزام الإيجار، الفائدة، الإهلاك والتعديلات تبقى محجوبة حتى مراجعة عقد فعلي ومحاسب مؤهل.

### 3. GL وSubledgers

- GL هو مصدر القوائم المالية.
- الفواتير، العقود، الودائع، التسويات وRent Roll هي Subledgers تشغيلية.
- كل Subledger مالي له حساب رقابة ومصالحة واضحة.
- لا تُجبر التقارير التشغيلية على القراءة من GL مباشرة.

### 4. OMR precision — القرار النهائي

اعتمد مالك المنتج ما يلي:

- العملة الحالية: `OMR`.
- دقة التخزين والترحيل النهائية: **3 خانات عشرية**.
- وحدة التقريب النهائية: **0.001 OMR**.
- الحسابات الوسيطة يمكن أن تستخدم دقة أعلى.
- التقريب النهائي يتم مرة واحدة خادميًا.
- يجب أن يتساوى المدين والدائن بعد التقريب إلى 0.001.
- أي سماحية قديمة `0.01` في ADR 0003 تعتبر **Superseded for OMR**.
- لا تستخدم الواجهة JavaScript `Number` كمصدر حقيقة نهائي للأموال.

**C7 = APPROVED.**

أي نص في مستندات هذه المرحلة يصف تعارض C7 بأنه غير محسوم يعتبر مستبدلًا بهذا القسم وبـ`ACCOUNTING_DECISION_GATES_AR.md` المحدّث.

### 5. المصروفات والمقاصة

- مصروف المكتب: مصروف تشغيلي للمكتب.
- مصروف المالك: `Due from Owner`، وليس مصروفًا للمكتب.
- مصروف المستأجر: مطالبة/فاتورة استرداد واحدة دون تكرار الذمة.
- المقاصة مع المالك لا تُفترض قانونيًا دون سند تعاقدي.
- الرصيد السالب لا يُقص إلى صفر؛ يُعرض `Due from Owner` مستقلًا.

### 6. التأمينات

- التأمين التزام تجاه المستأجر.
- خصم المتأخرات يجب أن يخصص لفواتير حقيقية ويحدث حالتها ذريًا.
- تعويض التلفيات يذهب للمالك أو المكتب حسب المستفيد الاقتصادي والعقد.
- لا يوجد Default آمن لحقل مستفيد التلفيات.

### 7. الاتفاقيات التاريخية

- لا تعديل صامت على سجل مستخدم تاريخيًا.
- كل تعديل ينشئ Version جديدًا.
- التعديل القانوني بأثر رجعي يعالج بـCatch-up Adjustment.
- لا تُعاد كتابة قيود أو تسويات قديمة.

## C1–C11 summary

| Gate | Status |
|---|---|
| C1 — Invoice / receivable recognition | APPROVED WITH CONTRACT CONDITION |
| C2 — Fee recognition timing | MIXED BY FEE TYPE |
| C3 — Owner expenses | APPROVED WITH CONTRACT CONDITION |
| C4 — Fixed fee proration | APPROVED |
| C5 — Master lease full accounting | BLOCKED |
| C6 — Accounting periods | BLOCKED |
| C7 — OMR precision | APPROVED — 3dp / 0.001 |
| C8 — Due from Owner | APPROVED WITH CONTRACT CONDITION |
| C9 — Deposit usage | PARTIALLY APPROVED / PARTIALLY BLOCKED |
| C10 — Net/Gross presentation | APPROVED |
| C11 — Agreement amendments | PRINCIPLE APPROVED / IMPLEMENTATION BLOCKED |

## Implementation gates

يمكن تنفيذ المرحلة التالية الخاصة بالأمان وسلامة التسويات لأنها لا تغير نموذج القيد:

- عزل الشركات.
- منع تكرار عناصر التسوية.
- إعادة التحقق قبل الاعتماد والدفع.
- إغلاق الكتابة المالية المباشرة الآمنة.
- سلامة سلسلة migrations.

ولا يبدأ تنفيذ إعادة تصميم القيود أو Backfill قبل:

1. مراجعة عقد إدارة مالك فعلي.
2. تحديد `collection_role` لكل نموذج.
3. تصميم الفترات المحاسبية.
4. فصل `master_lease` في مسار مستقل.
5. مراجعة VAT عند التفعيل.

## Companion documents

- `docs/accounting/CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md`
- `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md`
- `docs/accounting/CANONICAL_ACCOUNTING_EVENT_SPEC_AR.md`
- `docs/accounting/ACCOUNTING_ACCEPTANCE_SCENARIOS_AR.md`
- `docs/accounting/ACCOUNTING_IMPLEMENTATION_IMPACT_MAP_AR.md`

## Constraints honored

- Documentation-only.
- No migrations or rollback changes.
- No RPCs, functions, triggers, RLS or grants.
- No journal entries or backfill.
- No frontend changes.
- No production data changes.
