# 24 Documents Plug-and-Play Extension Contract Specification

## Overview
This document specifies the content, design, and technical specifications for 24 document types as a Plug-and-Play Extension for the MALEK platform. All documents follow the existing centralized Document Platform architecture in `rentrix-app/src/services/documents/`.

**Integration Target:** `src/services/documents/` — no independent platform, no parallel engines.

**Delivery Model:** Canonical Data → Feature Adapter → Unified Document Payload → Document Registry/Controller/Service → Document Template → DocumentRenderer → (A4 Print / Real PDF)

---

## 1. Foundation Rules (All Documents)

### 1.1 Architecture
- Every document flows through the **single Document Engine** (`documentEngine.buildDocument()`)
- Payloads follow the `CanonicalDocumentPayloadMap` types from `documentPayloads.ts`
- Company identity comes from `DocumentCompanySettings` (never hard-coded)
- File names use `buildDocumentFileName()` from the registry sanitizer
- No `window.print()` or `jsPDF` direct calls from features

### 1.2 Arabic Typography
- **Primary font:** Cairo (self-hosted, weights 400-900)
- **Latin fallback:** Sora
- Full Arabic stack: `'Cairo', 'Noto Sans Arabic', 'Tajawal', sans-serif`
- Print environment: white background, dark text, `print-color-adjust: exact`

### 1.3 RTL Direction
- Application default: `<html lang="ar" dir="rtl">` + `html { direction: rtl; }`
- Fields that must remain LTR: document reference, IBAN, phone, email, technical identifiers
- Local `direction: ltr` can be applied temporarily to those specific fields only

### 1.4 Theming
- Light/Dark via `[data-theme="dark"]` CSS variables
- Print PDFs: **always** white background, dark text — never dark mode PDF
- Application UI follows theme, but printed output is document-safe

### 1.5 Currency & Numbers
- **Currency:** OMR (Omani Rial)
- **Decimal places:** 3 (derived from currency settings, never hard-coded `toFixed(2)`)
- Financial format: `1,234.500 OMR`
- Use central financial formatters only

### 1.6 Company Identity
- Derived from Document Platform current company settings
- Fields: companyName, address, phone, email, logo, taxNumber, registrationNumber
- **Never** hard-code company data in any template
- If identity incomplete → fail closed (readiness/fail-closed policy)

### 1.7 Security & Permissions
- Uses same RLS, company isolation, role/permission model as app
- No privileged keys in client code
- Print/PDF button does not grant additional data access

### 1.8 Document Registry
- All 24 types registered in `documentTemplateRegistry`
- Each entry specifies: supported outputs (print/pdf), required/optional data, business reference policy, status labels, signature roles, page policy, currency policy, empty state, filename strategy

### 1.9 What NO Document May Do
- Use `window.print()` directly
- Create independent Print/Pdf engine
- Hard-code company data
- Invent financial totals or balances
- Use second design system, icons, or QR library (unless specifically needed)
- Skip the DocumentRenderer — all print/PDF goes through it

---

## 2. Document Types Specification

### Existing Types (11 — already implemented, kept for compatibility and reference)

| # | Type | Template ID | Description |
|---|------|-------------|-------------|
| 1 | `contract` | `rental-contract-a4-ar` | Rental contract Arabic A4 |
| 2 | `invoice` | `rent-invoice-a4-ar` | Invoice/claim financial invoice |
| 3 | `receipt` | `cash-receipt-a4-ar` | Receipt/cash receipt |
| 4 | `expense_voucher` | `expense-voucher-a4-ar` | Expense voucher / payment voucher |
| 5 | `payment` | `money-movement-voucher-a4-ar` | Money movement voucher (expense/payment alias) |
| 6 | `owner_statement` | `owner-statement-a4-ar` | Owner statement of accounts |
| 7 | `tenant_statement` | `tenant-statement-a4-ar` | Tenant statement of accounts |
| 8 | `trial_balance` | `trial-balance-a4-ar` | Trial balance report |
| 9 | `income_statement` | `income-statement-a4-ar` | Income statement |
| 10 | `balance_sheet` | `balance-sheet-a4-ar` | Balance sheet / financial position |
| 11 | `generic_report` | `generic-report-a4-ar` | Generic report (collections, overdue, occupancy, expenses, maintenance, deferred revenue, property analytics, deposits clearance, maintenance A4 list, utilities report) |

---

### New Types (13 — to be added for the 24 total)

---

#### 12. `maintenance_document`

**Arabic Title:** تقرير صيانة  
**English Identifier:** maintenance-document

**Template ID:** `maintenance-document-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `status`: string (draft/active/expired/terminated)
- `propertyTitle`: string | null
- `unitNumber`: string | null
- `maintenanceType`: 'routine' | 'emergency' | 'inspection' | 'repair'
- `description`: string
- `amount`: number
- `date`: string (ISO)
- `performedBy`: string (vendor/technician name)

**Optional Data:**
- `reference`: string | null
- `startDate`: string | null
- `endDate`: string | null
- `notes`: string | null
- `propertyAddress`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels (Arabic):**
- draft: 'مسودة تقرير صيانة'
- active: 'تقرير صيانة ساري'
- expired: 'تقرير صيانة منتهي'
- terminated: 'تقرير صيانة مفسوخ'

**Default Status Label:** 'تقرير صيانة'

**Signature Roles:** `['accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'` (OMR 3 decimals)

**Empty State Policy:** `behavior: 'render', message: 'لا توجد أنشطة صيانة مسجلة.'`

**File Name Strategy:** `reference-then-date`, prefix: `maintenance`, dateField: `date`, maxLength: 80

**Notes:** 'يستند تقرير الصيانة إلى بيانات الخدمة الفعلية ولا يحسب مbalances مالية موازية.'

**Build Function:** `buildMaintenanceDocumentModel` in engine

**KPIs:**
-Property / وحدة: `joinPropertyUnit(propertyTitle, unitNumber)`
-نوع الصيانة: `maintenanceType`
-التاريخ: `formatDate(date)`
-المبلغ: `money(amount, ctx)`

**Table:**
| البند | القيمة |
|--------|--------|
| نوع التقرير | maintenanceType |
| العقار والوحدة | propertyTitle + unitNumber |
| تاريخ الصيانة | formatDate(date) |
| الوصف | description |
| المبلغ | money(amount, ctx) |
| performedBy | performedBy |

**Signature Context:** Accountant + General Manager approval for maintenance costs above threshold

---

#### 13. `property_handover`

**Arabic Title:** استلام وتسليم_property  
**English Identifier:** property-handover

**Template ID:** `property-handover-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `propertyTitle`: string
- `unitNumber`: string | null
- `handoverDate`: string (ISO)
- `handoverType`: 'delivery' | 'reception' | 'termination'
- `conditionReport`: string (description of property condition)
- `keysGiven`: boolean
- `signatures`: Array<{ role: SignatureRole; name: string; date: string }>

**Optional Data:**
- `reference`: string | null
- `previousTenant`: string | null
- `newTenant`: string | null
- `propertyAddress`: string | null
- `inventoryItems`: Array<{ item: string; quantity: number; condition: string }> | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:** (empty status-based labels, use handoverType for context)
- delivery: 'استلام تسلّم'
- reception: 'تسليم مستقبل'
- termination: 'إنهاء استلام'

**Default Status Label:** 'استلام وتسليم عقار'

**Signature Roles:** `['owner', 'tenant', 'accountant']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'block', message: 'لا يمكن إصدار تقرير استلام بدون بيانات إ handed-over.'`

**File Name Strategy:** `reference-then-date`, prefix: `handover`, dateField: `handoverDate`, maxLength: 80

**Notes:** 'يستند التقرير إلى حالة العقار الفعلية في لحظة التسليم، ولا يتم دمج مbalances مالية.'

**Table Structure:**
| الحقل | القيمة |
|--------|--------|
| نوع الاستلام/التسليم | handoverType |
| العقار والوحدة | propertyTitle + unitNumber |
| تاريخ الاستلام | formatDate(handoverDate) |
| حال العقار | conditionReport |
| المفاتيح | keysGiven ? 'تم تسليم المفاتيح' : 'لم يتم تسليم المفاتيح' |
| الملاحظات | notes |

**Inventory Table (optional):**
| الصنف | الكمية | الحالة |
|--------|--------|--------|
| ... | ... | ... |

**Signature Context:** Owner + Tenant + Accountant witness the handover state

---

#### 14. `settlement_document`

**Arabic Title:** مستند تسوية  
**English Identifier:** settlement-document

**Template ID:** `settlement-document-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `settlementType`: 'rent' | 'expense' | 'financial' | 'deposit'
- `parties`: { owner: string; tenant: string } | null
- `amount`: number
- `settlementDate`: string (ISO)
- `reason`: string (reason for settlement)
- `reference`: string | null (settlement reference number)

**Optional Data:**
- `propertyTitle`: string | null
- `unitNumber`: string | null
- `details`: string | null
- `signedBy`: Array<{ role: SignatureRole; name: string }>

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:**
- settled: 'تمت التسوية'
- partial: 'تسوية جزئية'
- pending: 'في انتظار تسوية'
- void: 'ملغاة'

**Default Status Label:** 'مستند تسوية'

**Signature Roles:** `['accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات تسوية لتقرير.'`

**File Name Strategy:** `reference-then-date`, prefix: `settlement`, dateField: `settlementDate`, maxLength: 80

**Notes:** 'لا يتم دمج Meaning مالية موازية؛ المبالغ مستمدة من السلطة المالية الحالية.'

**KPIs:**
-نوع التسوية: `settlementType`
-المبلغ: `money(amount, ctx)`
-تاريخ التسوية: `formatDate(settlementDate)`
-الأطراف: `parties?.owner + ' / ' + parties?.tenant`

**Table:**
| البند | القيمة |
|--------|--------|
| نوع التسوية | settlementType |
| الأطراف | owner + ' / ' + tenant |
| المبلغ | money(amount, ctx) |
| تاريخ التسوية | formatDate(settlementDate) |
| السبب | reason |

**Signature Context:** Accountant + General Manager for financial validity

---

#### 15. `lease_agreement`

**Arabic title:** عقد إيجار (معتمد)  
**English Identifier:** lease-agreement

**Template ID:** `lease-agreement-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `status`: 'active' | 'expired' | 'terminated' | 'draft'
- `rentAmount`: number
- `startDate`: string (ISO)
- `endDate`: string (ISO)
- `paymentCycle`: 'monthly' | 'quarterly' | 'semester' | 'yearly'
- `propertyTitle`: string
- `unitNumber`: string | null
- `tenantName`: string
- `tenantNationalId`: string
- `tenantPhone`: string | null

**Optional Data:**
- `reference`: string | null
- `paymentCycleDetails`: string | null
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `block`
- `displayAsDocumentNo`: true

**Status Labels:**
- active: 'عقد إيجار ساري المفعول'
- expired: 'عقد إيجار منتهي الصلاحية'
- terminated: 'عقد إيجار مفسوخ'
- draft: 'مسودة عقد إيجار'

**Default Status Label:** 'عقد إيجار'

**Signature Roles:** `['owner', 'tenant', 'accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا يمكن إصدار العقد بدون بيانات المستأجر.'`

**File Name Strategy:** `reference-then-date`, prefix: `lease`, dateField: `startDate`, maxLength: 80

**Notes:** 'هذا المستند هو العقد المعتمد الرسمي — يجب أن يتضمن جميع البيانات الحقيقية ولا يُنشأ بهويات.placeholder.'

**KPIs:**
-المستأجر: `tenantName`
-قيمة الإيجار: `money(rentAmount, ctx)`
-فترة العقد: `${formatDate(startDate)} إلى ${formatDate(endDate)}`
-دورة الدفع: `paymentCycle`

**Table:**
| البند | القيمة |
|--------|--------|
| قيمة الإيجار (رقمي): | money(rentAmount, ctx) |
| قيمة الإيجار (بالحروف): | words(rentAmount, ctx) |
| دورة الدفع: | paymentCycle |
| تاريخ البداية: | formatDate(startDate) |
| تاريخ النهاية: | formatDate(endDate) |
| المستأجر: | tenantName |
| رقم الهوية/السجل: | tenantNationalId |
| الهاتف: | tenantPhone |
| العقار والوحدة: | joinPropertyUnit(propertyTitle, unitNumber) |
| الملاحظات: | notes ||

**Important:** `businessReference.absentBehavior: 'block'` — cannot publish without real reference number

---

#### 16. `rent_receipt`

**Arabic Title:** إيصال إيجار  
**English Identifier:** rent-receipt

**Template ID:** `rent-receipt-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `reference`: string | null (receipt reference number, e.g. REC-...)
- `paymentDate`: string (ISO)
- `amount`: number
- `tenantName`: string
- `propertyTitle`: string
- `unitNumber`: string | null

**Optional Data:**
- `issueDate`: string | null
- `paymentMethod`: 'cash' | 'bank_transfer' | 'check' | null
- `collectorName`: string | null
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:** (empty — rent receipts don't have statuses like invoices)

**Default Status Label:** 'إيصال إيجار'

**Signature Roles:** `['tenant', 'accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات لإصدار إيصال.'`

**File Name Strategy:** `reference-then-date`, prefix: `rent-receipt`, dateField: `paymentDate`, maxLength: 80

**Notes:** 'يستخدم رقم الإيصال الحقيقي REC-… من خدمة الإيصالات عند توفره؛ nunca fragment UUID.'

**KPIs:**
-المستأجر: `tenantName`
-العقار والوحدة: `joinPropertyUnit(propertyTitle, unitNumber)`
-المبلغ: `money(amount, ctx)`
-تاريخ السداد: `formatDate(paymentDate)`

**Table:**
| البند | القيمة |
|--------|--------|
| المبلغ المستلم رقمياً: | money(amount, ctx) |
| المبلغ المستلم بالحروف: | words(amount, ctx) |
| تاريخ الاستلام: | formatDate(paymentDate) |
| طريقة السداد: | paymentMethod || '—' |
| المستلم: | tenantName |
| العقار والوحدة: | joinPropertyUnit(propertyTitle, unitNumber) |

**Signature Context:** Tenant receives copy + Accountant + General Manager records

---

#### 17. `security_deposit_return`

**Arabic Title:** إيصال عودة تأمين  
**English Identifier:** security-deposit-return

**Template ID:** `security-deposit-return-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `reference`: string | null (deposit reference)
- `returnDate`: string (ISO)
- `propertyTitle`: string
- `unitNumber`: string | null
- `depositAmount`: number (original deposit)
- `returnedAmount`: number (amount returned)
- `deductions`: Array<{ label: string; amount: number }> | null (deduction details)
- `balance`: number | null (remaining if any)

**Optional Data:**
- `tenantName`: string | null
- `moveInDate`: string | null
- `moveOutDate`: string | null
- `conditionAssessment`: string | null
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:**
- returned: 'تم الإرجاع الكامل'
- partial: 'إرجاع جزئي'
- disputed: 'متنازع عليه'
- void: 'ملغى'

**Default Status Label:** 'إرجاع تأمين'

**Signature Roles:** `['accountant', 'general_manager', 'tenant']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات لإصدار إيصال إيداع.'`

**File Name Strategy:** `reference-then-date`, prefix: `deposit-return`, dateField: `returnDate`, maxLength: 80

**Notes:** 'لا يتم احتساب مbalances مالية جديدة؛ المبالغ مستمدة من سجل الإيداع الأصلي.'

**KPIs:**
-العقار والوحدة: `joinPropertyUnit(propertyTitle, unitNumber)`
-المبلغ الأصلي: `money(depositAmount, ctx)`
-المبلغ المُرجَع: `money(returnedAmount, ctx)`
-صافي الخصومات: `money(deductions ? deductions.reduce((sum, d) => sum + d.amount, 0) : 0, ctx)`
-الرصيد المتبقي: `balance != null ? money(balance, ctx) : '—'`

**Table:**
| البند | القيمة |
|--------|--------|
| قيمة الإيداع الأصلي: | money(depositAmount, ctx) |
| قيمة الإيداع المُرجَع: | money(returnedAmount, ctx) |
| إجمالي الخصومات: | money(deductions ? deductions.reduce((sum, d) => sum + d.amount, 0) : 0, ctx) |
| الرصيد المتبقي: | balance != null ? money(balance, ctx) : '—' |
| تاريخ الإرجاع: | formatDate(returnDate) |
| التقييم النهائي: | conditionAssessment || '—' |

**Signature Context:** Accountant + General Manager + Tenant acknowledgment

---

#### 18. `property_inspection_report`

**Arabic Title:** تقرير فحص عقاري  
**English Identifier:** property-inspection-report

**Template ID:** `property-inspection-report-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `propertyTitle`: string
- `unitNumber`: string | null
- `inspectionDate`: string (ISO)
- `inspectorName`: string
- `condition`: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
- `findings`: Array<{ location: string; description: string; severity: 'minor' | 'major' | 'critical' }>

**Optional Data:**
- `reference`: string | null
- `previousCondition`: string | null
- `tenantName`: string | null
- `photos`: Array<{ caption: string; url: string }> | null
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:**
- passed: 'فحص ناجح'
- failed: 'فحص غير موفق'
- needs_repair: 'يحتاج صيانة'
- critical: 'حالة حرجة'

**Default Status Label:** 'تقرير فحص عقاري'

**Signature Roles:** `['accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا نتائج للفحص لتقرير.'`

**File Name Strategy:** `reference-then-date`, prefix: `inspection`, dateField: `inspectionDate`, maxLength: 80

**Notes:** 'يُظهر الحالة الفعلية للعقار في تاريخ الفحص؛ لا يُستخدم لتقديرات مالية موازية.'

**KPIs:**
-العقار والوحدة: `joinPropertyUnit(propertyTitle, unitNumber)`
-حالة الفحص: condition (Arabic label)
-الفاحص: inspectorName
-تاريخ الفحص: formatDate(inspectionDate)

**Table: Findings:**
| الموقع | الوصف | الشدة |
|--------|--------|--------|
| ... | ... | ... |

**Findings Summary Table:**
| البند | القيمة |
|--------|--------|
| حالة العقار: | conditionLabel |
| تاريخ الفحص: | formatDate(inspectionDate) |
| الفاحص: | inspectorName |
| الملاحظات: | notes ||

**Signature Context:** Accountant + General Manager review

---

#### 19. `eviction_notice`

**Arabic Title:** إنذار إخلاء  
**English Identifier:** eviction-notice

**Template ID:** `eviction-notice-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `reference`: string | null (official notice reference)
- `issueDate`: string (ISO)
- `propertyTitle`: string
- `unitNumber`: string | null
- `tenantName`: string
- `tenantNationalId`: string | null
- `reason`: string (lawful reason for eviction)
- `noticePeriod`: number (months)
- `effectiveDate`: string (ISO) (date tenant must vacate)

**Optional Data:**
- `courtCaseReference`: string | null
- `legalBasis`: string | null (article/law reference)
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `block`
- `displayAsDocumentNo`: true

**Status Labels:** (empty — eviction notices have legal status, not business status)

**Default Status Label:** 'إنذار إخلاء'

**Signature Roles:** `['general_manager']` (only authorized party)

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'block', message: 'لا يمكن إصدار إنذار بدون بيانات المستأجر والعقار.'`

**File Name Strategy:** `reference-then-date`, prefix: `eviction`, dateField: `issueDate`, maxLength: 80

**Notes:** 'هذا مستند قانوني بحت — لا يُعدل مبالغ أو مbalances. يُنشأ من السلطة القانونية المعتمدة. `businessReference.absentBehavior: 'block'` يضمن وجود مرجع رسمي.'

**KPIs:**
-اسم المستأجر: `tenantName`
-العقار والوحدة: `joinPropertyUnit(propertyTitle, unitNumber)`
-سبب الإنذار: `reason`
-فترة notice: `noticePeriod` شهر
-تاريخ الإصدار: `formatDate(issueDate)`
-تاريخ الأثر: `formatDate(effectiveDate)`

**Table:**
| البند | القيمة |
|--------|--------|
| اسم المستأجر: | tenantName |
| رقم الهوية: | tenantNationalId |
| العقار والوحدة: | joinPropertyUnit(propertyTitle, unitNumber) |
| سبب الإخلاء: | reason |
|period notice: | `${noticePeriod} شهر` |
| تاريخ الإصدار: | formatDate(issueDate) |
| تاريخ الفعالية: | formatDate(effectiveDate) |
| basis القانوني: | legalBasis || '—' |

**Critical Notes:**
- `businessReference.absentBehavior: 'block'` — must have real reference number
- No financial amounts calculated
- Legal basis shown if available, otherwise dash
- This document type is read-only in data authority — no totals invented

---

#### 20. `notice_to_vacate`

**Arabic Title:** إنذار مغادرة  
**English Identifier:** notice-to-vacate

**Template ID:** `notice-to-vacate-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `reference`: string | null (notice reference)
- `issueDate`: string (ISO)
- `propertyTitle`: string
- `unitNumber`: string | null
- `tenantName`: string
- `vacateDate`: string (ISO) (date tenant must leave)
- `noticePeriod`: number (months)

**Optional Data:**
- `courtReference`: string | null
- `legalBasis`: string | null
- `mutualAgreement`: boolean | null (was it mutual?)
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:** (empty)

**Default Status Label:** 'إنذار مغادرة'

**Signature Roles:** `['owner', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات لإنذار المغادرة.'`

**File Name Strategy:** `reference-then-date`, prefix: `vacate`, dateField: `issueDate`, maxLength: 80

**Notes:** 'يختلف عن eviction-notice؛ هذا إنذار قانوني قبل المغادرة، وليس حكم إخلاء نهائي.'

**KPIs:**
-اسم المستأجر: `tenantName`
-العقار والوحدة: `joinPropertyUnit(propertyTitle, unitNumber)`
-فترة الإشعار: `${noticePeriod} شهر`
-تاريخ الإصدار: `formatDate(issueDate)`
-تاريخ المغادرة: `formatDate(vacateDate)`

**Table:**
| البند | القيمة |
|--------|--------|
| اسم المستأجر: | tenantName |
| العقار والوحدة: | joinPropertyUnit(propertyTitle, unitNumber) |
| تاريخ الإصدار: | formatDate(issueDate) |
| تاريخ المغادرة: | formatDate(vacateDate) |
| فترة الإشعار: | `${noticePeriod} شهر` |
| اتفاق متبادل: | mutualAgreement ? 'نعم' : 'لا' || '—' |

---

#### 21. `quarterly_statement`

**Arabic Title:** كشف حساب فصلي  
**English Identifier:** quarterly-statement

**Template ID:** `quarterly-statement-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `ownerName`: string
- `periodFrom`: string (ISO)
- `periodTo`: string (ISO)
- `totalRent`: number
- `totalExpenses`: number
- `totalCommission`: number
- `netAmount`: number
- `transactions`: Array<{ date: string; type: string; description: string; amount: number }>

**Optional Data:**
- `propertyTitle`: string | null
- `unitNumber`: string | null
- `reference`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: false (owner name is not a document number)

**Status Labels:** (empty)

**Default Status Label:** 'كشف حساب فصلي'

**Signature Roles:** `['accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا توجد حركات في الفترة المحددة.'`

**File Name Strategy:** `reference-then-date`, prefix: `quarterly-statement`, dateField: `periodTo`, maxLength: 80

**Notes:** 'اسم المالك معرف الكشف وليس رقم مرجع؛ لا يُعامل كرقم مستند (displayAsDocumentNo: false).'

**KPIs:**
-اسم المالك: `ownerName`
-إجمالي الإيجارات: `money(totalRent, ctx)`
-إجمالي المصروفات: `money(totalExpenses, ctx)`
-عمولة الإدارة: `money(totalCommission, ctx)`
-الصافي المستحق: `money(netAmount, ctx)`

**Table: Transactions:**
| التاريخ | النوع | البيان | المبلغ |
|---------|--------|--------|--------|
| ... | ... | ... | ... |

**Totals Row:**
| | المبلغ |
|--------|--------|
| صافي الرصيد المستحق | money(netAmount, ctx) |

**Signature Context:** Accountant + General Manager

---

#### 22. `annual_report`

**Arabic Title:** التقرير السنوي  
**English Identifier:** annual-report

**Template ID:** `annual-report-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `reportTitle`: string (e.g. "التقرير السنوي لعامي 2023-2024")
- `periodFrom`: string (ISO)
- `periodTo`: string (ISO)
- `sections`: Array<{ title: string; columns?: string[]; rows: string[][]; totals?: string[] }>

**Optional Data:**
- `reportType`: 'financial' | 'operational' | 'compliance' | 'mixed' | null
- `totalSummary`: string | null
- `dateRangeLabel`: string | null (pre-formatted)

**Business Reference Policy:**
- `field`: `reportType`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: false

**Status Labels:** (empty)

**Default Status Label:** 'تقرير سنوي'

**Signature Roles:** `['accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات لتقرير سنوي.'`

**File Name Strategy:** `reference-then-date`, prefix: `annual-report`, dateField: `periodTo`, maxLength: 80

**Notes:** 'مدعوم لأنه مستخدم فعليًا (تقارير التحصيل/المتأخرات/الإشغال/المصروفات/الصيانة/الإيراد المؤجل/تحليلات العقارات/ودائع وصيانة ومرافق).'

**KPIs:**
- عنوان التقرير: `reportTitle`
- الفترة: `${formatDate(periodFrom)} - ${formatDate(periodTo)}`

**Tables:** All sections rendered as DocumentTable with columns/rows/totals

**Signature Context:** Accountant + General Manager

---

#### 23. `tax_document`

**Arabic Title:** مستند ضريبي  
**English Identifier:** tax-document

**Template ID:** `tax-document-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `documentType`: 'vat_invoice' | 'withholding_certificate' | 'tax_summary' | 'declaration'
- `taxPeriod`: string (ISO, e.g. "2024-Q1")
- `amount`: number
- `taxAmount`: number
- `reference`: string | null (tax reference number)

**Optional Data:**
- `companyName`: string | null
- `companyTaxNumber`: string | null
- `periodStart`: string | null
- `periodEnd`: string | null
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:** (empty — tax documents use their type as identifier)

**Default Status Label:** 'مستند ضريبي'

**Signature Roles:** `['accountant', 'general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات لإصدار مستند ضريبي.'`

**File Name Strategy:** `reference-then-date`, prefix: `tax-document`, dateField: `taxPeriod`, maxLength: 80

**Notes:** 'يتم استخلاص هوية الشركة من Document Platform الحالية — لا يتم hard-code بيانات الشركة.'

**KPIs:**
-نوع المستند الضريبي: `documentType`
-فترة الضريبة: `taxPeriod`
-المبلغ: `money(amount, ctx)`
-الضريبة: `money(taxAmount, ctx)`
-المرجع: `reference || '—'`

**Table:**
| البند | القيمة |
|--------|--------|
| نوع المستند: | documentType |
|period الضريبي: | taxPeriod |
| المبلغ: | money(amount, ctx) |
| ضريبة القيمة المضافة: | money(taxAmount, ctx) |
| رقم المرجع: | reference || '—' |

**Signature Context:** Accountant + General Manager

---

#### 24. `compliance_certificate`

**Arabic Title:** شهادة امتثال  
**English Identifier:** compliance-certificate

**Template ID:** `compliance-certificate-a4-ar`

**Supported Outputs:** `['print', 'pdf']`

**Required Data:**
- `certificateType`: 'occupancy' | 'safety' | 'environmental' | 'financial' | ' regulatory'
- `issueDate`: string (ISO)
- `issueBy`: string (authority/government body)
- `propertyTitle`: string
- `unitNumber`: string | null
- `certificateNumber`: string (official certificate number)
- `validUntil`: string (ISO)

**Optional Data:**
- `reference`: string | null
- `inspectionDate`: string | null
- `conditions`: Array<{ clause: string; status: 'compliant' | 'non-compliant' | 'pending' }> | null
- `notes`: string | null

**Business Reference Policy:**
- `field`: `reference`
- `absentBehavior`: `omit`
- `displayAsDocumentNo`: true

**Status Labels:**
- valid: 'صالحة'
- expired: 'منتهية'
- under_review: 'في المراجعة'
- pending: 'في انتظار'

**Default Status Label:** 'شهادة امتثال'

**Signature Roles:** `['general_manager']`

**Page Policy:** A4 portrait, margins: {top: 12, right: 10, bottom: 15, left: 10}

**Currency Policy:** `source: 'company-settings', precision: 'currency-derived'`

**Empty State Policy:** `behavior: 'render', message: 'لا بيانات لإصدار شهادة امتثال.'`

**File Name Strategy:** `reference-then-date`, prefix: `compliance`, dateField: `issueDate`, maxLength: 80

**Notes:** 'شهادة رسمية من authority — لا يتم إنشاؤها من داخل التطبيق אלא تُستخرج وتُدرج. البيانات الدنيا فقط من التطبيق (العقار، الصلاحية).'

**KPIs:**
-نوع الشهادة: `certificateType`
-الجهة الصادرة: `issueBy`
-رقم الشهادة: `certificateNumber`
-تاريخ الإصدار: `formatDate(issueDate)`
-تاريخ الصلاحية: `formatDate(validUntil)`

**Table:**
| البند | القيمة |
|--------|--------|
| نوع الشهادة: | certificateType |
| الجهة الصادرة: | issueBy |
| رقم الشهادة: | certificateNumber |
| تاريخ الإصدار: | formatDate(issueDate) |
| تاريخ الصلاحية: | formatDate(validUntil) |
| الحالة: | statusLabel |
| الملاحظات: | notes ||

**Signature Context:** General Manager only (authority-appointed)

---

## 3. Integration Structure

### 3.1 Registry Updates
Add all 24 entries to `documentTemplateRegistry` in `documentRegistry.ts`. The existing 11 entries remain. Add 13 new entries following the exact `DocumentTemplateEntry` type.

### 3.2 Engine Builders
Add 13 build functions to `DocumentEngine.ts` following the exact pattern of existing builders (`buildContractModel`, `buildInvoiceModel`, etc.). Each function:
- Takes `(entry: DocumentTemplateEntry, settings: DocumentCompanySettings, payload: CanonicalDocumentPayloadMap[T])`
- Returns `UnifiedDocumentModel`
- Uses `buildHeader`, `buildFooter`, `kpi`, `money`, `words`, `formatDate`, `joinPropertyUnit` from the engine
- Uses `TableGenerator.build` for tables
- Uses `buildDocumentFileName` for filename
- Follows data authority rules (no invented totals, derive from canonical service)

### 3.3 Payload Types
Extend `CanonicalDocumentPayloadMap` in `documentPayloads.ts` with the 13 new payload types, each following the pattern:
- Required fields validated by `validateRequiredField`
- Optional fields as documented
- No financial invention

### 3.4 Feature Adapters
Each feature (contracts, financials, owners, maintenance, etc.) provides adapters that map their internal data to the canonical payload types. These adapters live in their respective feature folders, NOT in `src/services/documents/`.

Example adapter structure:
```
src/features/contracts/documents/
  adapters/
    contractAdapter.ts  // maps contract DB → ContractDocumentPayload
src/features/financials/invoices/documents/
  adapters/
    invoiceAdapter.ts  // maps invoice DB → InvoiceDocumentPayload
src/features/owners/documents/
  adapters/
    ownerStatementAdapter.ts  // maps owner DB → OwnerStatementPayload
```

### 3.5 Report Integration
Under `src/features/reports/documents/`:
- `adapters/` — feature-to-canonical adapters
- `payloads/` — canonical payload types (can subsume `CanonicalDocumentPayloadMap` entries)
- `actions/` — print/PDF action creators that call `documentService.printDocument()` / `documentService.downloadDocumentPdf()`

**Target structure per the contract:**
```
rentrix-app/src/features/reports/
  documents/
    adapters/
    payloads/
    actions/
    report-document-payloads.ts
```
This is the **target structure for extension**, NOT a new Document Engine. It canonicalizes report data → document adapter → Unified Document Model → delivers to `src/services/documents/`.

### 3.6 Renderer Integration
All print/PDF goes through `DocumentRenderer.printDocument()` / `DocumentRenderer.downloadDocumentPdf()`. No new renderers. The renderer already handles:
- Arabic text with Cairo font
- A4 pagination with table chunking
- RTL layout
- Single-flight guard
- Print window isolation
- PDF generation with jsPDF + html2canvas-pro
- Latin fallback via `buildLatinPdf`

---

## 4. Sample Implementation Pattern

### 4.1 Registry Entry Example (to be added to documentRegistry.ts)

```typescript
{
  type: 'maintenance_document',
  templateId: 'maintenance-document-a4-ar',
  templateVersion: 1,
  supportedOutputs: OUTPUTS,
  requiredData: ['status', 'propertyTitle', 'unitNumber', 'maintenanceType', 'description', 'amount', 'date', 'performedBy'],
  optionalData: ['reference', 'startDate', 'endDate', 'notes', 'propertyAddress'],
  businessReference: { field: 'reference', absentBehavior: 'omit', displayAsDocumentNo: true },
  statusLabels: {
    draft: 'مسودة تقرير صيانة',
    active: 'تقرير صيانة ساري',
    expired: 'تقرير صيانة منتهي',
    terminated: 'تقرير صيانة مفسوخ',
  },
  defaultStatusLabel: 'تقرير صيانة',
  signatureRoles: ['accountant', 'general_manager'],
  page: A4_PORTRAIT,
  currency: CURRENCY_POLICY,
  emptyState: { behavior: 'render', message: 'لا توجد أنشطة صيانة مسجلة.' },
  fileName: { strategy: 'reference-then-date', prefix: 'maintenance', dateField: 'date', maxLength: 80 },
  notes: 'يستند تقرير الصيانة إلى بيانات الخدمة الفعلية ولا يحسب مbalances مالية موازية.',
},
```

### 4.2 Build Function Example (to be added to DocumentEngine.ts)

```typescript
function buildMaintenanceDocumentModel(
  entry: DocumentTemplateEntry,
  settings: DocumentCompanySettings,
  payload: MaintenanceDocumentPayload
): UnifiedDocumentModel {
  const ctx = formatContextOf(settings);
  return {
    type: entry.type,
    header: buildHeader(settings, entry, {
      title: 'تقرير صيانة',
      reference: payload.reference,
      dateLabel: 'تاريخ الصيانة',
      dateValue: formatDate(payload.date),
      ctx,
    }),
    kpis: [
      kpi('العقار والوحدة', joinPropertyUnit(payload.propertyTitle, payload.unitNumber)),
      kpi('نوع الصيانة', payload.maintenanceType),
      kpi('التاريخ', formatDate(payload.date)),
      kpi('الوصف', payload.description),
      kpi('المبلغ', money(payload.amount, ctx)),
      kpi('قام بها', payload.performedBy),
    ],
    tables: [
      TableGenerator.build(
        ['البند', 'التفاصيل'],
        [
          ['نوع الصيانة', payload.maintenanceType],
          ['التاريخ', formatDate(payload.date)],
          ['الوصف', payload.description],
          ['المبلغ', money(payload.amount, ctx)],
          ['قام بها', payload.performedBy],
        ],
      ),
    ],
    footer: buildFooter(entry, payload.reference ? `تقرير صيانة رقم: ${payload.reference}` : 'تقرير صيانة'),
    fileName: buildDocumentFileName(entry, { reference: payload.reference, date: payload.date }),
  };
}
```

### 4.3 Feature Adapter Example

```typescript
// src/features/maintenance/documents/adapters/maintenanceAdapter.ts
import type { MaintenanceDocumentPayload } from '@/services/documents/documentPayloads';

export function mapMaintenanceToPayload(
  data: MaintenanceDomainData
): MaintenanceDocumentPayload {
  return {
    reference: data.reference,
    status: data.status,
    propertyTitle: data.propertyTitle,
    unitNumber: data.unitNumber,
    maintenanceType: data.type,
    description: data.description,
    amount: data.amount,
    date: data.date,
    performedBy: data.technicianName,
  };
}
```

### 4.4 Action Creator Example

```typescript
// src/features/reports/documents/actions/printMaintenanceDocument.ts
import { documentService } from '@/services/documents';
import { mapMaintenanceToPayload } from '@/features/maintenance/documents/adapters';

export async function printMaintenanceDocument(
  type: 'maintenance_document',
  input: { settings; payload: MaintenanceDomainData }
): Promise<void> {
  await documentService.printDocument('maintenance_document', {
    settings: input.settings,
    payload: mapMaintenanceToPayload(input.payload),
  });
}
```

---

## 5. Print & PDF Standards (Shared Across All 24)

### 5.1 Print Path
- Opens isolated A4 RTL popup (`window.open('_blank')`)
- Writes `buildPrintableDocumentHtml(model)` into popup
- Waits for fonts and images
- Calls `popup.print()` — **never** `window.print()` from the app
- Cleans up popup on `afterprint` or error
- Popup-blocked → clear Arabic error message

### 5.2 PDF Path
- Arabic documents: `buildArabicDocumentPdf(model)` → jsPDF with Cairo font
- Latin documents: `buildLatinPdf(model)` → jsPDF with Latin font
- Multi-page with chunking/pagination
- Table headers repeat on new pages
- No row cutting mid-way
- No signature block cutting
- Max 50 pages cap
- Blank pages skipped
- Filename through `sanitizeDocumentFileName`
- **Print PDFs: always white background, dark text — never dark mode**

### 5.3 A4 Print CSS Standards (from existing `@media print` in globals.css)
- `@page { size: A4 portrait; margin: 12mm 10mm 15mm 10mm; }`
- `print-color-adjust: exact`
- Body background: `#ffffff`
- Text color: `#0f172a`
- `font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important`
- KPI cards and signature blocks: `page-break-inside: avoid`
- Navigation/buttons/actions: `display: none`
- Tables: structured pagination, repeating headers

### 5.4 File Naming
- Strategy: `reference-then-date`
- Format: `<prefix>-<sanitized reference>-<ISO-date>.pdf`
- Never UUID alone as visible filename
- Uses `buildDocumentFileName()` from registry

---

## 6. Checklist for Each of the 24 Documents

[X] Registry entry with all policies
[X] Build function in DocumentEngine
[X] Payload type in CanonicalDocumentPayloadMap
[X] Feature adapter from domain data → canonical payload
[X] Print path via documentService.printDocument()
[X] PDF path via documentService.downloadDocumentPdf()
[A] Arabic typography: Cairo primary, Sora Latin fallback
[A] RTL layout, LTR exceptions for identifiers
[C] Company identity from DocumentPlatform settings (not hard-coded)
[C] OMR 3 decimal places for all money amounts
[C] `businessReference` policy (omit/block) per document type
[C] Signature roles defined per document type
[C] Empty state policy (render/block) with Arabic message
[C] File name strategy (reference-then-date)
[C] Print: isolated popup, no window.print() from app
[C] PDF: multi-page A4, table chunking, no blank pages
[C] Dark theme UI → white print/PDF output
[C] No independent print/PDF engine
[C] No `window.print()` from feature components
[C] Security: same RLS/permissions as app
[C] No financial totals invented beyond caller-supplied data

---

## 7. Migration & Compatibility

### 7.1 Existing 11 Types
- Remain unchanged in registry and engine
- Backward-compatible callers continue to work
- New types do not affect existing ones

### 7.2 New Types Integration
- Each new type follows exact same interfaces as existing
- No breaking changes to public APIs
- Typed `DocumentTypeId` extended to include 13 new types
- Registry entry per type ensures capability list stays in sync

### 7.3 Report Integration Path
- Features create adapters → payloads → call `documentService`
- No need to modify `src/services/documents/` core
- Report-specific integration under `src/features/reports/documents/`
- Canonical data → adapter → Unified Document Model → DocumentRenderer

---

## 8. Development Phases

### Phase 1: Registry & Types
1. Add 13 new entries to `documentTemplateRegistry`
2. Extend `DocumentTypeId` union type
3. Add 13 new payload types to `CanonicalDocumentPayloadMap`
4. Add `buildDocumentFileName` tests for new strategies

### Phase 2: Engine Builders
1. Add 13 build functions to `DocumentEngine.ts`
2. Ensure each uses shared helpers (`buildHeader`, `buildFooter`, `kpi`, `money`, etc.)
3. Run existing test suite to confirm no regressions
4. Add unit tests for each new builder

### Phase 3: Feature Adapters
1. Create adapters in each feature domain (maintenance, financials, owners, etc.)
2. Map internal data → canonical payloads
3. Test adapter output against registry validation

### Phase 4: Report Integration
1. Set up `src/features/reports/documents/` structure
2. Create report adapters that feed into canonical payloads
3. Create action creators for print/PDF
4. End-to-end test with DocumentRenderer

### Phase 5: Documentation & QA
1. Generate sample PDFs for all 24 types
2. Verify Arabic typography, RTL, pagination
3. Verify print popup behavior
4. Verify file naming and sanitization
5. Document any edge cases

---