# خريطة أثر التنفيذ المستقبلية — بدون تنفيذ الآن

**الحالة:** توثيقي فقط. تحدد فقط الجداول والدوال والتقارير المتوقع تأثرها، وترتيب التنفيذ المقترح — لا SQL تنفيذي هنا.

---

## أولًا: الحقول المطلوبة مستقبلًا

| الحقل | الجدول المتوقع | النوع | القيم المسموحة | الافتراضي | يحتاج Backfill؟ | خطر Default خاطئ |
|---|---|---|---|---|---|---|
| `agreement_type` | `owner_agreements` | موجود بالفعل (`property_management` \| `master_lease`) | — | — | لا (موجود) | لا ينطبق |
| `principal_agent_role` | `owner_agreements` | `text` | `AGENT` \| `PRINCIPAL` | **لا يوجد افتراضي آمن** — يتطلب مراجعة عقد فعلي لكل اتفاقية قائمة | نعم — لكل اتفاقية موجودة حاليًا | **عالٍ جدًا** — Default خاطئ يُصنّف علاقة قانونية بأثر رجعي دون سند؛ يُترك NULL إلزاميًا حتى المراجعة اليدوية |
| `collection_role` | `owner_agreements` | `text` | `OWNER_IS_CREDITOR` \| `OFFICE_IS_CREDITOR` | **لا يوجد افتراضي آمن للبيانات القديمة** — الترجيح التحليلي (OWNER_IS_CREDITOR) ليس دليلاً قانونيًا كافيًا للـBackfill الصامت | نعم | **عالٍ** — يغيّر توقيت الاعتراف بالإيراد في GL بأثر رجعي لو أُخطئ |
| `commission_recognition_basis` | `owner_agreements` | `text` | `ON_COLLECTION` \| `ON_ACCRUAL` | `ON_COLLECTION` (متسق مع 0001 الحالي) | لا — القيمة الحالية الفعلية للنظام هي `ON_COLLECTION` بالفعل، فهذا توثيق للسلوك القائم وليس تغييرًا | منخفض — يوثّق سلوكًا قائمًا بالفعل |
| `fixed_fee_proration_method` | `owner_agreements` | `text` | `FULL_MONTH` \| `DAILY_PRORATED` | `FULL_MONTH` (معتمد فعليًا في ADR 0004) | لا | منخفض — الافتراضي موثق ومعتمد مسبقًا |
| `effective_from` | `owner_agreements` (أو جدول نسخ منفصل) | `date` | — | تاريخ الإنشاء الحالي كنقطة بداية | نعم للسجلات القائمة | متوسط |
| `effective_to` | نفس الجدول | `date` \| `null` | — | `null` (ساري حتى إشعار آخر) | نعم | متوسط |
| `supersedes_agreement_id` | `owner_agreements` | `uuid` \| `null`، مرجع ذاتي | — | `null` | لا (حقل إضافي فقط للاتفاقيات الجديدة) | منخفض |
| `legal_offset_allowed` | `owner_agreements` | `boolean` | — | **لا يوجد افتراضي آمن** — يتطلب سند تعاقدي صريح لكل حالة (راجع A.12 في مصفوفة الحقوق) | نعم، لكن **يجب أن يبدأ بـ `false` وليس `true`** لتفادي افتراض حق مقاصة غير مثبت | **عالٍ** — لو `true` افتراضيًا يُنشئ حق قانوني مُفترض بلا سند |
| `owner_expense_recovery_method` | `owner_agreements` | `text` | `IMMEDIATE_OFFSET` \| `ON_SETTLEMENT_APPROVAL` | `ON_SETTLEMENT_APPROVAL` (متسق مع C3 المعتمد) | لا | منخفض |
| `deposit_damage_beneficiary` | `tenant_deposits` أو `deposit_transactions` (على مستوى كل معاملة خصم، وليس الاتفاقية) | `text` | `OWNER` \| `OFFICE` | **لا يوجد افتراضي آمن** — يجب إدخاله يدويًا لكل معاملة خصم مستقبلية، بدون Backfill للمعاملات القديمة | لا Backfill (تاريخي)، لكن **إلزامي مستقبلاً بدون افتراضي** | عالٍ لو افتُرضت قيمة واحدة لكل الحالات |
| `vat_treatment` | `owner_agreements` أو `company_settings` | `text`/`jsonb` | حسب تصميم لاحق | معطّل (متسق مع 0001) | لا | منخفض — يوثّق سلوكًا قائمًا |
| `currency_code` | `company_settings` أو مستوى شركة | `text` | `OMR` (حاليًا فقط — لا دعم متعدد عملات، `DOMAIN.md`) | `OMR` | لا | منخفض حاليًا (أحادي العملة) |
| `currency_precision` | إعداد نظام عام | `integer` | 3 (لـ OMR) | 3 | لا | **متوسط** — يتعارض حاليًا مع "rounding tolerance of 0.01" في ADR 0003 (خانتان)؛ يجب حسم التعارض أولاً (C7) |
| `accounting_effective_date` | `journal_entries` أو ما يعادله | `date` | — | تاريخ الحدث الفعلي | يحتاج فحص schema حي للتأكد إن كان موجودًا بالفعل | متوسط |
| `posting_date` | `journal_entries` | `date` | — | تاريخ الترحيل الفعلي (قد يختلف عن `accounting_effective_date`) | نفس الملاحظة أعلاه | متوسط |
| `accounting_period_id` | جدول جديد بالكامل `accounting_periods` + عمود مرجعي على `journal_entries` | `uuid` | — | لا يوجد — الجدول نفسه غير موجود (C6) | يحتاج تصميم مرحلة كاملة منفصلة (C6 محجوب بالكامل) | **الأعلى في كل القائمة** — بدونه لا يمكن إقفال أي فترة مطلقًا |

**ملاحظة صريحة (كما يطلب النطاق):** لم توضع أي قيمة افتراضية قانونية حساسة على كل البيانات القديمة بدون دليل. الحقول عالية الخطورة (`principal_agent_role`, `collection_role`, `legal_offset_allowed`, `deposit_damage_beneficiary`) تبقى **بلا افتراضي آمن** وتتطلب مراجعة يدوية لكل سجل قائم، وليس Backfill جماعيًا.

---

## ثانيًا: الجداول المتوقع تعديلها لاحقًا

| الجدول | نوع التعديل المتوقع | يعتمد على قرار |
|---|---|---|
| `owner_agreements` | إضافة أعمدة (`collection_role`, `principal_agent_role`, `commission_recognition_basis`, `legal_offset_allowed`, `owner_expense_recovery_method`, `billing_basis` — الأخير معتمد فعليًا في ADR 0004) | C1, C2, C3, مصفوفة الحقوق A |
| `owner_agreements` (أو جدول جديد `owner_agreement_versions`) | نظام Versioning كامل (`effective_from`, `effective_to`, `supersedes_agreement_id`) | C11 |
| `tenant_deposits` / `deposit_transactions` | إضافة `deposit_damage_beneficiary` على مستوى المعاملة | C9 |
| **جدول جديد** `accounting_periods` | إنشاء كامل — لا يوجد اليوم | C6 |
| `journal_entries` | إضافة/تأكيد `accounting_period_id`, تمييز `accounting_effective_date` عن `posting_date` إن لم يكن موجودًا | C6 |
| **جدول جديد** `master_lease_agreements` (أو توسيع `owner_agreements` بحقول مخصصة) | إنشاء كامل لتخزين مدة العقد، خيارات التجديد، الزيادات السنوية، التأمينات، شروط الإنهاء | C5 |
| **جداول جديدة محتملة** `right_of_use_assets`, `lease_liabilities` | إنشاء كامل فقط إذا حُسم أن Master Lease يتطلب معالجة تمويلية كاملة | C5 |
| `commissions` | إعادة تصميم كامل من "tracking view" إلى وحدة محاسبية حقيقية مرتبطة بـ `journal_entries`/`expenses` | C2 (عمولة وساطة), القسم C في مصفوفة الحقوق |
| `expenses` | توسيع `responsibility` enum ليشمل `tenant` (حاليًا `owner`\|`office`\|`shared` فقط) | حدث 7 في مواصفة الأحداث |

---

## ثالثًا: الدوال (RPCs) المتوقع استبدالها أو إضافتها

| الدالة | الحالة | السبب |
|---|---|---|
| `generate_invoices_from_active_contracts()` | تعديل محتمل | لدعم `billing_basis` (FULL_MONTH/DAILY_PRORATED) عند تفعيله فعليًا |
| `calculate_owner_net_payout()` | تعديل محتمل | لدعم `collection_role` وفصل Due from Owner كبند مستقل بدل دمجه صافيًا (C8, C10) |
| `post_receipt_atomic` | تعديل محتمل | لدعم قيد GL شرطي حسب `collection_role` (بدلاً من قاعدة موحّدة) عند حسم C1 نهائيًا |
| **دالة جديدة** لخصم التأمين مع تحديث حالة الفاتورة ذريًا | إضافة | حدث 10 (C9) — القيد الإلزامي بربط الخصم بفاتورة حقيقية |
| **دالة جديدة** لإقفال/فتح فترة محاسبية | إضافة كاملة | C6 |
| **دالة جديدة** Catch-up Adjustment لتعديل نسبة عمولة بأثر رجعي | إضافة | C11، سيناريو 11 |
| `pay_commission_atomic` | مراجعة كاملة أو استبدال | القسم C في مصفوفة الحقوق — الوحدة الحالية موصوفة كـ placeholder |

**لا يُكتب أي SQL فعلي لهذه الدوال في هذه المرحلة** — هذا جرد فقط لما ستحتاجه المرحلة التالية.

---

## رابعًا: التقارير المتأثرة

| التقرير | الأثر المتوقع |
|---|---|
| كشف المالك (`rpt_owner_statement`) | يحتاج بند منفصل صريح لـ "Due from Owner" غير مدموج صافيًا (C8, C10) |
| قائمة الدخل | لا تغيير في المبدأ (C10 محسوم بالفعل ومطبَّق) — لكن يحتاج تأكيد أن كل مسار جديد (Master Lease، عمولات وسيط) يلتزم بنفس الفصل Net/Gross عند تفعيله |
| Rent Roll | يبقى مؤشرًا تشغيليًا Gross منفصلاً — لا تغيير مبدئي |
| ميزان المراجعة / المركز المالي | يحتاج حسابات جديدة إذا فُعّلت معالجة Master Lease الكاملة (Right-of-Use Asset, Lease Liability) |
| تقرير مصالحة Subledger↔GL | يحتاج شرطًا جديدًا: "Tenant Receivable reconciliation إلزامية فقط عند OFFICE_IS_CREDITOR" (موثق في القسم سابعًا بالمواصفة الأصلية) |

---

## خامسًا: الاختبارات المطلوبة (على مستوى الفئة، وليس تفصيلاً)

1. اختبار يثبت عدم إنشاء قيد GL عند إصدار فاتورة (حتى التحصيل) — لحماية C1.
2. اختبار عكس تلقائي للعمولة عند VOID/عكس الدفعة الأصلية — لحماية 0001.
3. اختبار Pro-rata لكلا القاعدتين (`FULL_MONTH` و`DAILY_PRORATED`) بمجرد إضافة `billing_basis` — لحماية C4/ADR 0004.
4. اختبار خصم تأمين لمتأخرات يحدّث حالة الفاتورة المرتبطة ذريًا ضمن نفس المعاملة — لحماية C9.
5. اختبار Due from Owner يظهر كبند منفصل في كشف المالك وليس مدمجًا صافيًا — لحماية C8/C10.
6. اختبار مصالحة (`Owner Funds Subledger = GL Owner Funds Payable`) على بيانات اختبارية متعددة السيناريوهات (سيناريوهات 1-11 أعلاه كأساس).

---

## سادسًا: ترتيب التنفيذ المقترح (لا يُنفَّذ الآن — للمرحلة القادمة فقط)

1. **حسم C6 (الفترات المحاسبية) أولاً** — لأن أي قيد جديد بدون `accounting_period_id` يُبنى على أساس ناقص سيحتاج إعادة هيكلة لاحقًا.
2. **حسم C1/collection_role لكل اتفاقية قائمة يدويًا** (لا Backfill آلي) قبل أي تعديل على `post_receipt_atomic`.
3. تفعيل `billing_basis` (C4) — الأقل خطورة لأنه معتمد ومحدد الحدود مسبقًا (ADR 0004).
4. تصميم `deposit_damage_beneficiary` وربط خصم التأمين بالفواتير ذريًا (C9).
5. إعادة تصميم وحدة عمولات الوساطة من الصفر كوحدة محاسبية حقيقية (القسم C).
6. **تأجيل Master Lease الكامل (C5) لمرحلة منفصلة تمامًا** تتطلب مراجعة محاسب معتمد خارجي — أعلى قرارات هذه المرحلة خطورة وأقلها جاهزية.
7. نظام Versioning للاتفاقيات (C11) — يمكن أن يتوازى مع الخطوة 2 لأنهما مترابطان منطقيًا.

هذا الترتيب توجيهي فقط ولا يُلزم بأي جدول زمني؛ صاحب النظام يقرر الأولوية الفعلية بعد اعتماد هذه المرحلة.
