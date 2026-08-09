# ADR-0010 — المرجع المحاسبي والقانوني لنظام مالك

**Status:** ACCEPTED — NORMATIVE  
**Date:** 2026-08-09  
**Authors:** Malik Engineering (via automated implementation)  
**Supersedes:** N/A  
**Companion locked sources:**
- `governance/canonical-business-rules.json`
- `docs/decisions/0011-final-business-accounting-and-operating-policies.md`

---

## بوابة الاعتماد الخارجية (APPROVAL GATE)

> **لا يبدأ ترحيل GL أو Backfill أو قيود مالية نهائية قبل اعتماد محاسب مسؤول ومراجعة العقود والسياسة الضريبية المحلية.**
>
> هذا ADR يثبّت القرارات المرجعية ويوثق البوابات المطلوبة. التنفيذ التقني لـ migrations وRPCs يمكن أن يستمر وفق الحدود الموضوعة هنا، لكن الترحيل إلى الإنتاج ودخول قيود مالية ذات أثر يستلزم:
>
> 1. **اعتماد محاسب مسؤول مرخص** — على الهيكل المحاسبي ودليل الحسابات وقواعد التسوية.
> 2. **مراجعة العقود** — التحقق من أن collection_role المستخدم مدعوم بحق قانوني فعلي.
> 3. **مراجعة السياسة الضريبية المحلية** — تحديد الحالات التي تنطبق فيها VAT وآلية تسجيلها.

---

## القرار 1: property_management = AGENT_NET

```
operating_model: OWNER_AGENCY
office_role: AGENT
presentation: NET
```

**المقتضيات الحرفية الملزمة:**

1. **المكتب وكيل** عن المالك في إدارة العقار — ليس أصيلاً تجاه المستأجر في هذا النموذج.
2. **كامل الإيجار المحصّل ليس إيراداً للمكتب** — الإيجار المقبوض يُسجَّل كالتزام تجاه المالك (Owner Funds Payable)، ولا يعبر قائمة الدخل كإيراد خام للمكتب.
3. **إيراد المكتب الوحيد** في هذا النموذج هو العمولة أو رسم الإدارة المستحق له بموجب الاتفاقية (Management Fee Revenue / account 4100).
4. القيود المالية تعكس هذا التمييز — أي تسجيل لإيجار خام في حساب إيرادات المكتب يُعدّ خطأً محاسبياً يجب تصحيحه بقيد عكسي.

---

## القرار 2: master_lease = PRINCIPAL

```
operating_model: MASTER_LEASE
office_role: PRINCIPAL
presentation: GROSS
```

**المقتضيات الحرفية الملزمة:**

1. **منفصل كلياً عن property_management** — الوحدات المستأجرة بموجب master_lease تُدار في نظام محاسبي مستقل عن نظام إدارة أملاك الغير.
2. **لا يستخدم Owner Funds Payable** — master_lease لا يمر بدورة تسوية المالك لأن المكتب يلتزم مباشرةً تجاه المالك باعتباره مستأجراً رئيسياً.
3. **لا يوصف كـIFRS 16 كامل** حتى اكتمال وحدة الإيجار الرئيسي المستقلة، والتي تشمل: Right-of-Use Asset، Lease Liability، ROU Depreciation، Lease Interest Expense.
4. الحسابات المخصصة لـmaster_lease (1600، 2500، 6200، 6300، 4000) لا تُستخدم في owner_agency.

---

## القرار 3: collection_role داخل اتفاقية الإدارة

```
default: OWNER_IS_CREDITOR
exception: OFFICE_IS_CREDITOR (بشرط صريح)
```

**التعريفات الملزمة:**

### OWNER_IS_CREDITOR (الافتراضي)
- المستأجر مدين للمالك بالإيجار.
- المكتب يحصّل نيابةً عن المالك.
- عند التحصيل: Dr Cash/Bank — Cr Owner Funds Payable.
- لا تُفتح ذمة على المستأجر في دفاتر المكتب بوصفه دائناً.

### OFFICE_IS_CREDITOR (استثناء بحق قانوني)
- **يُطبَّق فقط عند وجود حق قانوني مباشر صريح للمكتب ضد المستأجر** بموجب الاتفاقية والعقد.
- المستأجر مدين للمكتب — يُفتح Tenant Receivable في دفاتر المكتب.
- عند الفاتورة: Dr Tenant Receivable — Cr Owner Funds Payable.
- عند التحصيل: Dr Cash/Bank — Cr Tenant Receivable.

**قاعدة الإلزام:** عدم وجود نص صريح في الاتفاقية يعني OWNER_IS_CREDITOR. الشك لصالح المالك.

---

## القرار 4: commission_recognition_basis

```
RATE         → ON_COLLECTION
FIXED_MONTHLY → DAILY_ACCRUAL
```

**الآليات:**

### RATE / ON_COLLECTION
- العمولة تُستحق وتُسجَّل لحظة التحصيل.
- المبلغ = (الإيجار المحصَّل × معدل العمولة) مقرَّباً إلى 3 خانات عشرية.
- القيد عند التحصيل: Dr Owner Funds Payable — Cr Management Fee Revenue [— Cr VAT Payable].

### FIXED_MONTHLY / DAILY_ACCRUAL
- العمولة تستحق يومياً بصرف النظر عن التحصيل.
- الاستحقاق اليومي = commission_value / أيام الشهر، خادمياً.
- قيد الاستحقاق: Dr Due from Owner (1300) — Cr Management Fee Revenue (4100) [— Cr VAT Payable (2100)].
- المقاصة مشروطة بحق قانوني موثق (انظر القرار 5).

---

## القرار 5: السياسات الإلزامية

### 5.1 المقاصة (Netting/Offset)
- **المقاصة ليست افتراضية**.
- تتم فقط عند توافر شرطين معاً:
  1. **حق قانوني نافذ** بين المبالغ المتقاصة، موثّق في العقد أو الاتفاقية.
  2. **توثيقها داخل سجل التسوية** مع reference إلى المستند القانوني.

### 5.2 VAT Policy
- قابلة للضبط على مستوى الشركة (`company_settings.vat_enabled`).
- تنطبق على المعاملات التي يُحدد النظام أنها خاضعة للضريبة.
- **مراجعة السياسة الضريبية المحلية واجبة** قبل تفعيل VAT في الإنتاج (انظر بوابة الاعتماد).

### 5.3 الفترات المحاسبية
```
OPEN        → الترحيل المعتاد، متاح لكل القيود
SOFT_CLOSED → القيد المتأخر يُرحَّل إلى أول فترة OPEN مع حفظ effective_date الأصلي ووسم late_posting = true
HARD_CLOSED → الترحيل محظور تماماً، الرفض على مستوى قاعدة البيانات
```

### 5.4 OMR — الدقة العشرية
- **3 خانات عشرية** في كل من: التخزين (DB)، الـRPCs، القيود، العرض للمستخدم.
- وحدة التقريب: 0.001 OMR.
- التقريب يحدث مرة واحدة خادمياً عند نقطة الإدخال — لا تقريب في المتصفح.
- نوع البيانات: `numeric(18,3)` في كل حقل مالي.

### 5.5 تعديل الاتفاقيات
- تعديل الاتفاقية لا يُعيد كتابة التاريخ.
- كل تعديل جوهري ينشئ version جديداً (`owner_agreement_versions`).
- يُحفظ سجل تدقيق كامل لكل تغيير.

### 5.6 الإلغاء والاسترداد
- إلغاء المعاملات المالية المرحَّلة يتم بـ**قيد عكسي** فقط (Reversal Batch).
- **يُحظر حذف القيود المرحَّلة** — append-only بعد POSTED.
- الاسترداد = قيد عكسي + قيد جديد صحيح.

---

## خريطة الحسابات المرجعية (دليل الحسابات الأولي)

| رقم   | الاسم                     | النوع    | Normal Balance | الاستخدام                        |
|-------|---------------------------|----------|----------------|----------------------------------|
| 1111  | Cash                      | asset    | debit          | نقد في الصندوق                    |
| 1120  | Bank                      | asset    | debit          | أرصدة بنكية                       |
| 1201  | Tenant Receivable         | asset    | debit          | ذمم مستأجرين (OFFICE_IS_CREDITOR) |
| 1300  | Due from Owners           | asset    | debit          | مستحق من الملاك (FIXED_MONTHLY)   |
| 1600  | Right-of-Use Asset        | asset    | debit          | أصل حق الاستخدام (master_lease)   |
| 2000  | Owner Funds Payable       | liability| credit         | أموال الملاك المحصَّلة             |
| 2100  | VAT Payable               | liability| credit         | ضريبة القيمة المضافة المستحقة      |
| 2200  | Tenant Deposits Payable   | liability| credit         | تأمينات المستأجرين                 |
| 2300  | Broker Commissions Payable| liability| credit         | عمولات وسطاء مستحقة               |
| 2500  | Lease Liability           | liability| credit         | التزام الإيجار (master_lease)      |
| 4000  | Sublease Rental Revenue   | revenue  | credit         | إيراد الإيجار الفرعي (master_lease)|
| 4100  | Management Fee Revenue    | revenue  | credit         | إيراد رسوم الإدارة (AGENT_NET)     |
| 4200  | Brokerage Revenue         | revenue  | credit         | إيراد السمسرة                      |
| 4300  | Damage Compensation Revenue| revenue | credit         | إيراد تعويضات الأضرار              |
| 6100  | Company Operating Expense | expense  | debit          | مصروفات تشغيلية للمكتب             |
| 6110  | Broker Commission Expense | expense  | debit          | مصروف عمولة الوسيط                 |
| 6200  | ROU Depreciation          | expense  | debit          | إهلاك أصل حق الاستخدام            |
| 6300  | Lease Interest Expense    | expense  | debit          | فوائد التزام الإيجار               |

---

## مصفوفة القيود المرجعية (property_management = AGENT_NET)

### OWNER_IS_CREDITOR — عند التحصيل
```
Dr  1120 Bank / 1111 Cash         [amount]
  Cr  2000 Owner Funds Payable    [amount]
```

### OWNER_IS_CREDITOR — عمولة RATE (ON_COLLECTION)
```
Dr  2000 Owner Funds Payable      [commission]
  Cr  4100 Management Fee Revenue [commission_net]
  Cr  2100 VAT Payable            [vat_amount]     ← إذا انطبق
```

### OWNER_IS_CREDITOR — عمولة FIXED_MONTHLY (DAILY_ACCRUAL)
```
Dr  1300 Due from Owners          [accrual]
  Cr  4100 Management Fee Revenue [accrual_net]
  Cr  2100 VAT Payable            [vat_amount]     ← إذا انطبق
```

### OWNER_IS_CREDITOR — دفع المالك
```
Dr  2000 Owner Funds Payable      [net_payout]
  Cr  1120 Bank / 1111 Cash       [net_payout]
```

### OFFICE_IS_CREDITOR — عند الفاتورة
```
Dr  1201 Tenant Receivable        [invoice_amount]
  Cr  2000 Owner Funds Payable    [invoice_amount]
```

### OFFICE_IS_CREDITOR — عند التحصيل
```
Dr  1120 Bank / 1111 Cash         [collected]
  Cr  1201 Tenant Receivable      [collected]
```
ثم فصل العمولة بنفس نموذج OWNER_IS_CREDITOR.

---

## العلاقة بالمصادر الملزمة الأخرى

هذا ADR **إضافي** — لا يعدّل ولا يلغي:
- `governance/canonical-business-rules.json` (القانون الأعلى)
- `docs/decisions/0011-final-business-accounting-and-operating-policies.md`

في حالة أي تعارض بين هذا ADR وبين المصدرين أعلاه، يُحسم لصالح المصدرين.

---

*هذا ADR موثَّق ومرجعي. القيود المالية الفعلية لن تُرحَّل إلى الإنتاج حتى استيفاء بوابة الاعتماد الخارجية المذكورة أعلاه.*
