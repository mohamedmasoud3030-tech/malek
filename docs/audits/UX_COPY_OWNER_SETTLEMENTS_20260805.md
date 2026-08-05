# UX Copy Guide: Owner Settlement Lifecycle — August 2026
# دليل صياغة نصوص تجربة المستخدم (UX Copy) لدورة تسويات الملاك

**Date / التاريخ:** 2026-08-05  
**Feature / الميزة:** تسويات الملاك (Owner Settlements Flow)  
**Target Audience / شريحة المستخدمين:** موظفو المكاتب ومديرو العقارات (Property Office Managers)  
**Language / اللغة:** Arabic-First (RTL) / لغة عربية سليمة ومبسطة  
**Status / الحالة:** Completed & Documented (جاهز للمطابقة البرمجية)  

---

## 1. Overview / نظرة عامة

When managing financial transactions like **Owner Settlements** (تسويات الملاك), the user is often in a high-anxiety state. They are transferring actual funds, dealing with complex math, and closing accounting periods.

In an Arabic-first (RTL) enterprise system like **MALIK**, UX copy must be:
1. **واضح ومباشر (Clear):** No jargon, no ambiguity about financial actions.
2. **مطمئن ومسؤول (Reassuring):** Highlighting consequences of financial operations clearly.
3. **مكتوب بلغة حية (Human):** Avoiding robotic literal translations and adopting Gulf/Omani business terms.

---

## 2. Recommended UX Copy & Design Patterns

### 📭 2.1. Empty State (حالة خلو البيانات)
* **Context:** The Owner Settlements tab has no recorded data.
* **Objective:** Explain what settlements are, why none are visible, and how to create the first draft.

```markdown
## Recommended Copy / النص المقترح
عنوان رئيسي: "لا توجد تسويات معدة لهذا المالك حتى الآن"
عنوان فرعي: "تظهر هنا كشوفات حساب التصفية المالية والخصومات والمبالغ المستحقة المجهزة للصرف للمالك."
زر الإجراء (CTA): "إعداد كشف تسوية جديد"
```

#### Alternatives / بدائل الصياغة:
| Option | Copy / النص | Tone / النبرة | Best For / مناسب لـ |
| :---: | :--- | :--- | :--- |
| **A (Recommended)** | **لا توجد تسويات معدة لهذا المالك حتى الآن** | Reassuring & Actionable | Default Empty State. |
| **B (Informative)** | **لم يتم تسجيل أي تسوية مالية بعد** | Neutral / Professional | Summary view-only pages. |
| **C (Prompting)** | **ابدأ بإعداد أول تسوية مالية للمالك** | Active / High energy | Onboarding / Quick Wizards. |

---

### 🚀 2.2. Main Call-to-Actions (أزرار الإجراءات الرئيسية)
CTAs must start with strong verbs, mapping explicitly to the action's final consequence. Avoid vague labels like "موافق" or "إرسال".

```markdown
## Recommended Copy / النص المقترح
* زر إنشاء المسودة: "إعداد مسودة تسوية" (Draft Settlement)
* زر الاعتماد النهائي: "اعتماد كشف التسوية" (Approve Settlement)
* زر الصرف الفعلي: "صرف المبالغ المستحقة" (Disburse/Pay Settlement)
* زر الإلغاء أو التراجع: "إلغاء طلب التسوية" (Cancel / Reject)
```

---

### ⚠️ 2.3. Confirmation Dialogs (نوافذ التأكيد الحساسة)
* **Context:** Triggered before approving or paying a settlement.
* **Objective:** Make the financial consequences of the action absolute, clear, and non-destructive but irreversible.

```markdown
## Recommended Copy / النص المقترح
العنوان: "اعتماد وصرف كشف التسوية بمبلغ {amount} ر.ع.؟"
النص الوصفي: "سيؤدي هذا الإجراء إلى ترحيل القيود المحاسبية تلقائيًا إلى دفاتر اليومية العامة وتحديث رصيد الصندوق بنظام {account_no}. هذا الإجراء مالي ولا يمكن التراجع عنه."
زر التأكيد الفعلي: "نعم، صرف المبالغ المحددة"
زر التراجع: "تراجع، الاحتفاظ بمسودة"
```

#### Rationale / المبرر الفني:
* Standard buttons like "موافق" or "إلغاء" increase cognitive friction because "إلغاء" (Cancel) can mean both "Cancel the transaction" or "Cancel the dialog".
* Labeling buttons with specific actions (`صرف المبالغ` vs `تراجع، الاحتفاظ بمسودة`) removes ambiguity instantly.

---

### 🚨 2.4. Error States & Warnings (رسائل الخطأ وموانع الصرف)
* **Context:** A manager attempts to pay a settlement, but the cash account or bank fund has insufficient balance.

```markdown
## Recommended Copy / النص المقترح
العنوان: "تعذر إتمام عملية الصرف لعدم كفاية الرصيد"
النص التفصيلي: "الرصيد الحالي المتوفر في الصندوق {account_no} هو {current_balance} ر.ع. وهو غير كافٍ لتغطية كشف التسوية البالغ {amount} ر.ع. يرجى مراجعة الحساب البنكي أو إيداع مبالغ إضافية ثم إعادة المحاولة."
```

#### Rationale / المبرر الفني:
* **No Jargon:** Instead of displaying raw SQL execution codes (like `ERROR 42501` or `insufficient_balance`), the interface translates the exact business rule, giving the user immediate, clear instructions on *how to fix it*.

---

## 3. Localization & Culture Notes (توصيات التوطين والترجمة)

1. **Latin Numerals for Numbers / الأرقام اللاتينية الموحدة:**  
   Always output digits in standard Latin numerals (e.g., `1,250 OMR` / `1,250 ر.ع.`) rather than Eastern Arabic glyphs (`١٢٥٠`). This aligns with Omani/Gulf bank statement practices and prevents layout wrapping on narrow screens.
2. **Omani Rial Suffix / تفقيط العملة والريال العماني:**  
   Write currency codes consistently as `ر.ع.` or `ر.ع. عماني`. For formal reports, ensure proper Arabic text-to-speech numbering format (Tafqeet, e.g., `ألف ومائتان وخمسون ريالاً عمانيًا لا غير`).
3. **Standardize Action Labels / اتساق المصطلحات:**  
   Avoid confusing synonyms. Always stick to **"صرف"** for payouts, **"تحصيل"** for collections, and **"تسوية"** for settlements.
