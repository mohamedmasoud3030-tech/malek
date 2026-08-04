# خريطة أثر التنفيذ المستقبلية — Malek

**الحالة:** توثيقي فقط. لا SQL تنفيذي ولا Migration في هذه المرحلة.

## قرارات ثابتة تؤثر على التنفيذ

- اسم المنتج الرسمي: `Malek`.
- اسم المستودع التقني الحالي يبقى `mohamedmasoud3030-tech/malik`.
- OMR يُخزن ويُرحّل بثلاث خانات عشرية.
- التقريب النهائي الخادمي: `0.001`.
- الحسابات الوسيطة يمكن أن تستخدم دقة أعلى.
- أي سماحية قديمة `0.01` تعتبر مستبدلة بالنسبة إلى OMR.
- `property_management` مرجح كـAgent/Net، لكن `collection_role` يحتاج عقدًا فعليًا.
- `master_lease` يحتاج وحدة مستقلة ومراجعة محاسبية/قانونية.

---

## الحقول المطلوبة مستقبلًا

| الحقل | الموقع المتوقع | القيم | الافتراضي الآمن |
|---|---|---|---|
| `principal_agent_role` | `owner_agreements` | `AGENT`, `PRINCIPAL` | لا يوجد للبيانات القديمة |
| `collection_role` | `owner_agreements` | `OWNER_IS_CREDITOR`, `OFFICE_IS_CREDITOR` | لا يوجد للبيانات القديمة |
| `commission_recognition_basis` | `owner_agreements` | `ON_COLLECTION`, `ON_ACCRUAL` | السلوك الحالي `ON_COLLECTION` فقط حيث تقرره السياسة |
| `fixed_fee_proration_method` | `owner_agreements` | `FULL_MONTH`, `DAILY_PRORATED` | `FULL_MONTH` وفق ADR 0004 |
| `effective_from` / `effective_to` | نسخة الاتفاقية | تاريخ | يحتاج مراجعة تاريخية |
| `supersedes_agreement_id` | نسخة الاتفاقية | UUID | `NULL` |
| `legal_offset_allowed` | `owner_agreements` | boolean | لا يوجد افتراضي قانوني آمن |
| `owner_expense_recovery_method` | `owner_agreements` | enum | `ON_SETTLEMENT_APPROVAL` كخط أساس تشغيلي |
| `deposit_damage_beneficiary` | معاملة خصم التأمين | `OWNER`, `OFFICE` | لا يوجد افتراضي آمن |
| `vat_treatment` | الشركة/الاتفاقية | تصميم لاحق | معطل حتى مراجعة ضريبية |
| `currency_code` | الشركة | `OMR` حاليًا | `OMR` |
| `currency_precision` | الشركة/النظام | integer | `3` |
| `accounting_effective_date` | القيد | date | تاريخ الحدث |
| `posting_date` | القيد | date | تاريخ الترحيل |
| `accounting_period_id` | القيد | UUID | لا يوجد قبل تصميم الفترات |

لا يُنفذ Backfill جماعي للحقول القانونية الحساسة.

---

## الجداول المتوقعة

| الجدول | الأثر |
|---|---|
| `owner_agreements` | تصنيف الدور القانوني، أسلوب الاعتراف، المقاصة، التناسب، النسخ التاريخية |
| `owner_agreement_versions` محتمل | Versioning وعدم إعادة كتابة التاريخ |
| `tenant_deposits` / `deposit_transactions` | تحديد مستفيد التلفيات وربط الخصومات بالفواتير |
| `accounting_periods` جديد | OPEN / SOFT_CLOSED / HARD_CLOSED |
| `journal_entries` | ربط الفترة، تاريخ الحدث، تاريخ الترحيل، دقة 3dp |
| `master_lease_agreements` جديد محتمل | مدة العقد، التجديد، الزيادات، الإنهاء |
| `right_of_use_assets` / `lease_liabilities` محتمل | فقط بعد اعتماد نموذج `master_lease` |
| `commissions` | إعادة تصميم دورة الاعتماد والدفع والعكس |
| `expenses` | فصل COMPANY / OWNER / TENANT بصورة سليمة |

---

## الدوال المتوقعة

- `post_receipt_atomic`: معالجة مشروطة حسب `collection_role` بعد اعتماد العقود.
- `calculate_owner_net_payout`: فصل `Due from Owner` ومنع القص إلى صفر.
- دالة خصم تأمين مرتبطة ذريًا بفواتير محددة.
- دوال فتح/إقفال الفترات.
- دالة Catch-up Adjustment.
- مراجعة كاملة لدورة عمولات الوسطاء.
- دوال `master_lease` مستقلة عن تسويات إدارة الأملاك.

لا يُكتب SQL لهذه الدوال في هذا PR.

---

## التقارير المتأثرة

### GL

- ميزان المراجعة.
- قائمة الدخل.
- المركز المالي.
- دفتر الأستاذ.
- التدفق النقدي.

### Subledgers

- الفواتير وأعمار الذمم.
- Rent Roll.
- كشف المستأجر.
- كشف المالك.
- الودائع.
- التسويات.
- العمولات.

### مصالحات إلزامية

```text
Owner Funds Subledger = GL Owner Funds Payable
Tenant Deposits Subledger = GL Tenant Deposits Payable
Due from Owners Subledger = GL Due from Owners
Broker Commissions Subledger = GL Broker Commissions Payable
```

مصالحة `Tenant Receivable` تعتمد على `collection_role`.

---

## اختبارات لاحقة

1. OMR بثلاث خانات في الخادم وقاعدة البيانات والتقارير.
2. توازن كل Batch بعد التقريب إلى `0.001`.
3. عدم استخدام JavaScript `Number` كمصدر نهائي لقيم المال.
4. `OWNER_IS_CREDITOR` مقابل `OFFICE_IS_CREDITOR`.
5. عمولة RATE على التحصيل الجزئي.
6. FIXED_MONTHLY حسب `FULL_MONTH` و`DAILY_PRORATED`.
7. مصروف المالك وظهور `Due from Owner` مستقلًا.
8. خصم التأمين لمتأخرات مع تحديث الفاتورة ذريًا.
9. استرداد بعد دفع المالك.
10. فترة مقفلة وقيد تعديل لاحق.
11. Versioning للاتفاقيات.
12. وحدة `master_lease` المستقلة.

---

## ترتيب التنفيذ

```text
1. عزل الشركات ومنع التسوية المزدوجة والكتابة المباشرة
2. نواة GL ودقة OMR والفترات
3. property_management حسب الحقوق المعتمدة
4. المصروفات والتأمينات والعمولات
5. master_lease في مسار مستقل
6. التقارير والمصالحات
7. تحليل التاريخ
8. Backfill موثق فقط بعد الاعتماد
9. إطلاق تدريجي
```
