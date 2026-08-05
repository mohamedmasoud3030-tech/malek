# بوابات القرارات المحاسبية — MALEK

## Status

**FINAL — ALL DECISION GATES CLOSED**

هذا الملف لم يعد قائمة قرارات محجوبة. جميع قرارات المنتج السابقة أُغلقت نهائيًا في:

- `docs/decisions/0011-final-business-accounting-and-operating-policies.md`
- `governance/final-decision-register.json`

لا توجد بعد هذا القرار حالة `BLOCKED` أو `PROVISIONAL` تمنع التنفيذ. قد يكون التنفيذ البرمجي غير مكتمل، لكن الوكيل لا يوقف العمل ولا يخترع سياسة جديدة.

## C1 — الفاتورة وذمة المستأجر

- `OWNER_IS_CREDITOR`: الذمة في Tenant Subledger، ولا يظهر كامل الإيجار أصلًا أو إيرادًا للمكتب.
- `OFFICE_IS_CREDITOR`: تثبت Tenant Receivable في GL.
- `collection_role` محفوظ صراحة في الاتفاقية وSnapshot داخل العقد.

**Status: FINAL — D01.**

## C2 — توقيت إيراد المكتب

- RATE عند التحصيل.
- FIXED_MONTHLY استحقاق يومي.
- Brokerage عند تفعيل عقد موقع.
- Renewal عند تفعيل التجديد.
- Setup عند قبول التسليم.
- النقدية قبل حدث الاعتراف Deferred Revenue.

**Status: FINAL — D02/D03.**

## C3 — مصروفات المالك

- `Dr Due from Owner / Cr Cash or Bank`.
- لا تدخل قائمة دخل المكتب.
- المقاصة فقط بحق صريح وترتيب ثابت.

**Status: FINAL — D04.**

## C4 — FIXED_MONTHLY والتناسب

- الافتراضي النهائي `DAILY_ACCRUAL`.
- لا يوجد `FULL_MONTH` افتراضي.
- التاريخ لا يعاد حسابه بصمت.

**Status: FINAL — D02.**

## C5 — Master Lease

- وحدة مستقلة.
- ROU Asset + Lease Liability عند البداية.
- المعدل الضمني إن أمكن، وإلا IBR Snapshot.
- سياسات قياس لاحق وتعديلات وإعفاء قصير الأجل محسومة.
- Owner Settlements لا تستخدم بدل محاسبة العقد الرئيسي.

**Status: FINAL — D07.**

## C6 — الفترات المحاسبية

- شهرية: OPEN / SOFT_CLOSED / HARD_CLOSED.
- Hard Closed غير قابل لإعادة الفتح.
- الحدث المتأخر يرحل في أول فترة مفتوحة مع حفظ effective date.

**Status: FINAL — D06.**

## C7 — العملة والتقريب

- OMR.
- 3 خانات عشرية.
- وحدة التقريب 0.001.
- التقريب النهائي خادمي مرة واحدة.

**Status: FINAL.**

## C8 — مديونية المالك

- الرصيد يعرض `Due from Owner`.
- ممنوع Owner Payable سالب.
- الاسترداد بعد دفع المالك ينشئ Due from Owner.

**Status: FINAL — D04/D14/D15.**

## C9 — التأمين

- التزام حتى الرد أو التطبيق.
- المستفيد صريح.
- التطبيق يحتاج مطالبة/فاتورة ودليلًا وتخصيصًا وحركة ذرية.
- العكس بحركة تعويضية.

**Status: FINAL — D05.**

## C10 — Net وGross

- OWNER_AGENCY = Agent / Net.
- MASTER_LEASE وOFFICE_OWNED = Principal / Gross.
- إجمالي الإيجارات المدارة KPI تشغيلي، لا إيراد مكتب.

**Status: FINAL.**

## C11 — تعديل الاتفاقيات

- Version أو Amendment جديد.
- effective_from/effective_to.
- لا تعديل صامت أو إعادة كتابة التاريخ.
- التصحيح الرجعي Catch-up/Reversal.

**Status: FINAL — D13.**

## قرارات إضافية أُغلقت

- VAT والضرائب: D08.
- غرامات التأخير: D09.
- الإنهاء المبكر: D10.
- الاعتماد والتوقيع: D11.
- تهيئة العقار حسب النوع: D12.
- تسويات الملاك: D14.
- الإلغاء والاسترداد: D15.
- استيراد البنك: D16.
- التصحيح التاريخي: D17.
- حوكمة التنفيذ: D18.

## بوابة التنفيذ الجديدة

القرار لم يعد مانعًا لأي مرحلة. المانع الوحيد المقبول هو فشل Evidence أو اختبار أو Security Gate محدد داخل Checklist المرحلة. لا يُسمح بعبارة «نحتاج قرارًا» إلا إذا ظهر نموذج أعمال جديد خارج النماذج الأربعة، وعندها يفتح ADR منفصل دون تغيير هذه القواعد خفية.
