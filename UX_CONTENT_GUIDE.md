# MALEK UX Content Guide

> **Version:** 1.0 — 2026-08-19  
> **Scope:** All user-facing Arabic and English text across the MALEK application.  
> **Authority:** This guide governs terminology, voice, labels, states, and trust communication.  
> **Enforcement:** Review all UI copy against this guide before committing. Automated contract tests verify key glossary terms.

## Table of Contents

1. [Product & Users](#1-product--users)
2. [Voice Principles](#2-voice-principles)
3. [Canonical Glossary](#3-canonical-glossary)
4. [Capitalization & Punctuation](#4-capitalization--punctuation)
5. [Action Label Rules](#5-action-label-rules)
6. [State Message Patterns](#6-state-message-patterns)
7. [Destructive Actions](#7-destructive-actions)
8. [Privacy & Security](#8-privacy--security)
9. [Payments & Money](#9-payments--money)
10. [Trust Communication](#10-trust-communication)
11. [Arabic & English Consistency](#11-arabic--english-consistency)
12. [Examples from the Project](#12-examples-from-the-project)
13. [Review Checklist](#13-review-checklist)

---

## 1. Product & Users

### Product
MALEK is a **property management platform** for **Arabic-speaking real estate offices** in the Gulf region. It runs entirely in the browser (Progressive Web App) with an Arabic-first, RTL interface.

### Users
| User | Role | Primary goal |
|------|------|-------------|
| ADMIN | Office owner or general manager | Full financial and operational oversight, configure system |
| MANAGER | Department or portfolio lead | Daily operations, reporting, approvals |
| USER | Property accountant or agent | Enter data, collect payments, submit requests |

### Domain
Real estate leasing: properties, units, contracts, invoices, receipts, expenses, maintenance, commissions, owner settlements, bank reconciliation.

### Risk Level
**Medium–High.** The app handles financial transactions, lease agreements, personally identifiable information (PII), and owner money. Destructive actions (receipt void, contract termination, data archive) must be deliberate, explained, and reversible where possible.

### Voice
**Professional, direct, and respectful.**  
- No jargon, no marketing fluff, no urgency tricks.  
- Messages state what happened, why, and what the user can do next.  
- Trust is earned through clarity—never through testimonials, guarantees, or savings claims.  
- Errors take responsibility; they never blame the user or the system passively.

---

## 2. Voice Principles

### Principle 1: Say what happened and what comes next
```
❌ "حدث خطأ غير متوقع"
✅ "تعذر تحميل الفواتير. تحقق من الاتصال ثم أعد المحاولة."
```

### Principle 2: Prefer active, not passive
```
❌ "تم إرسال الطلب"
✅ "أرسلنا طلبك إلى مدير النظام."
```

### Principle 3: Name the thing, not the action type
```
❌ [button] "تأكيد"
✅ [button] "حذف العقد"  (or)  "تسجيل الدفع"
```

### Principle 4: Every empty state is a guide, not a dead end
```
❌ "لا توجد بيانات"
✅ "لا توجد عقود بعد. أنشئ أول عقد من زر «عقد جديد» في الأعلى."
```

### Principle 5: Proportionate trust — never over-reassure
```
❌ "بياناتك آمنة تماماً مع تقنيات التشفير المتطورة"
✅ "نستخدم صلاحيات أدوار دقيقة وسجل تدقيق لحماية بيانات مكتبك."
```

### Principle 6: Errors are honest, not alarming
```
❌ "فشل النظام!"
✅ "تعذر حفظ التغيير. حاول مرة أخرى."
```

### Principle 7: Mobile-first — front-load the key information
```
❌ [mobile card] "عقد رقم 1023 / أحمد علي / 2026-01-01 / 500 OMR / نشط"
✅ [mobile card] "أحمد علي" (identity) → "500 OMR" (primary datum)
```

---

## 3. Canonical Glossary

### Entity Names (Arabic — canonical forms)

| English | Canonical Arabic | Acceptable | Avoid |
|---------|-----------------|------------|-------|
| Property | عقار | — | مبنى، أملاك (for a single property) |
| Properties | العقارات | — | الأملاك |
| Unit | وحدة | — | شقة (only if it is an apartment) |
| Contract | عقد | — | اتفاقية (use for owner agreements only) |
| Invoice | فاتورة | — | — |
| Receipt | إيصال | — | سند قبض |
| Payment | دفعة / دفع | — | — |
| Expense | مصروف | — | مصاريف (plural: المصروفات) |
| Owner | مالك | — | صاحب العقار |
| Tenant | مستأجر | جمع: مستأجرون | مستأجرين (avoid genitive in headings) |
| Person | جهة تعامل | شخص | فرد |
| People | جهات التعامل | الأشخاص | أفراد |
| Lead | عميل محتمل | — | عميل (before contracting) |
| Commission | عمولة | — | — |
| Maintenance | صيانة | — | — |
| Provider | مزود خدمة | — | مقاول |
| Utility | مرافق | — | خدمات (ambiguous) |
| Automation | أتمتة | — | — |
| Audit Log | سجل التدقيق | — | — |
| System | النظام | إدارة النظام | — |
| Report | تقرير | كشف حساب (statement) | — |
| Dashboard | لوحة التحكم | — | — |
| Settings | الإعدادات | — | — |
| Company | المكتب / الشركة | — | — |
| Deposit | تأمين | جمع: تأمينات | — |
| Arrears | متأخرات | — | — |
| Settlement | تسوية | جمع: تسويات | — |
| Bank Reconciliation | مطابقة بنكية | — | — |

### Action Names (Arabic)

| English | Canonical Arabic | Context |
|---------|-----------------|---------|
| Create / Add | إضافة / إنشاء | إضافة عقار، إنشاء عقد |
| Edit | تعديل | تعديل العقد |
| Save | حفظ | حفظ التغييرات |
| Delete | حذف | حذف مؤقت (soft-delete by default) |
| Archive | أرشفة | — |
| Cancel | إلغاء | إلغاء العملية |
| Confirm | تأكيد | — |
| Approve | اعتماد | maker-checker approvals |
| Reject | رفض | — |
| Void | إلغاء | إلغاء إيصال (with maker-checker) |
| Terminate | إنهاء | إنهاء عقد |
| Renew | تجديد | تجديد عقد |
| Pay | دفع / تحصيل | — |
| Export | تصدير | تصدير CSV |
| Print | طباعة | — |
| Retry | إعادة المحاولة | — |
| Search | بحث | — |
| Filter | فلتر / تصفية | — |
| Clear | مسح | مسح الفلاتر |

### UI & Navigation

| English | Canonical Arabic |
|---------|-----------------|
| Quick create | إنشاء سريع |
| Notifications | الإشعارات |
| Log out | تسجيل الخروج |
| Skip to content | تخطي إلى المحتوى الرئيسي |
| Open menu | فتح القائمة |
| Close menu | إغلاق القائمة |
| Collapse menu | طي القائمة |
| Toggle theme | تبديل الوضع |
| Current page | الصفحة الحالية |
| No results | لا توجد نتائج مطابقة |
| Unsaved changes | تغييرات غير محفوظة |

---

## 4. Capitalization & Punctuation

### Arabic
- **No all-caps.** Arabic script never uses capitals; avoid `text-transform: uppercase` in Arabic mode.
- **Quotes:** Use guillemets or curly quotes «» for emphasis; never for product names.
- **Ellipsis:** Use Arabic ellipsis (…) not three dots (...).
- **Numbers:** Always use Latin (Hindu-Arabic) numerals in data surfaces (tables, KPIs, amounts).  
  Exception: formal Arabic text in landing/legal pages uses Arabic numerals where appropriate.
- **Punctuation outside quotes:** Place full stops and commas outside quotation marks.

### English
- **Sentence case** for headings, labels, buttons.  
  Exception: proper nouns (MALEK, Supabase).
- **Title case** only for product names and proper nouns.
- **No trailing colons** after labels inside forms (the input boundary makes them redundant).

---

## 5. Action Label Rules

### Rule 5.1: Describe the outcome, not the action
```
❌ "تأكيد"
✅ "حذف العقار"  /  "حفظ التغييرات"  /  "إرسال الطلب"
```

### Rule 5.2: Use the verb form (مصدر or فعل) consistently
- For **primary actions** (buttons in forms): verb in command form — "احفظ", "أضف العقار", "أرسل"
- For **dialog confirmations**: infinitive — "حذف", "إلغاء الإيصال"
- Exception: the ConfirmDialog's confirm label names **what will happen**.

### Rule 5.3: Never label a button with only an icon without an adjacent text label or aria-label
All icon-only buttons must have `aria-label` that describes the outcome.

### Rule 5.4: Distinguish "save" from "create"
- "حفظ" = updating an existing record.
- "إضافة" / "إنشاء" = creating a new record.

### Rule 5.5: Cancel buttons always say "إلغاء"
Except when the action is a multi-step flow; then use "رجوع" (back) for the first step.

---

## 6. State Message Patterns

### Loading States
```
Pattern: "جارٍ تحميل {what}..."
```
```
Examples:
- "جارٍ تحميل الفواتير..."
- "جارٍ تحميل حركات البنك..."
```

### Empty States
```
Pattern: "لا {entity} بعد. {next step}"
```
```
Examples:
- "لا توجد عقود بعد. أنشئ أول عقد من زر «عقد جديد»."
- "لا توجد فواتير ضمن الفلاتر الحالية. غيّر الفلاتر أو امسحها."
- "لا توجد إشعارات حالياً."
```

### Success States (Toast)
```
Pattern: "تم {action} بنجاح" or "{Arabic action message}"
```
```
Examples:
- "تم تسجيل الدخول بنجاح"
- "تم حفظ التغييرات"
- "أرسلنا طلبك إلى مدير النظام."
```

### Error States
```
Pattern: "تعذر {action}. {why} {next step}"
```
```
Examples:
- "تعذر تحميل البيانات. تحقق من الاتصال والصلاحيات ثم أعد المحاولة."
- "تعذر حفظ التغيير. حاول مرة أخرى."
- "تعذر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور ثم حاول مرة أخرى."
```

### Write Error
```
Pattern: "لم يتم حفظ التغيير. {reason}"
```
```
The component title should be "لم يتم حفظ التغيير" (avoid "فشل").
```

### Permission Denied
```
Pattern (lock screen): "ليس لديك صلاحية. {what you need}."
Pattern (denied route): "لا يمكنك الوصول إلى هذا القسم."
```

### Offline State
```
Title: "لا يوجد اتصال بالشبكة"
Description: "يمكنك مراجعة البيانات الظاهرة، لكن الحفظ والتحديث قد يفشلان حتى يعود الاتصال."
```

---

## 7. Destructive Actions

### Principles
1. **Name the consequence** — "حذف العقد" not "تأكيد"
2. **Explain what happens to related data** — "يُحتفظ بسجل الفواتير المرتبطة"
3. **Offer reversal path** — "يمكنك التراجع عن الحذف من سجل التدقيق"
4. **Never use "هل أنت متأكد؟" as the only question** — Say what the user is confirming

### Approval Required (maker-checker)
For receipts void, contract termination, and significant financial reversals, the destructive action only creates a *request*. The dialog must state:
- "سيُرسل طلب إلغاء إلى مدير النظام للمراجعة والاعتماد."
- After request: "أرسلنا طلب الإلغاء. سيعتمد بمجرد مراجعة مدير النظام."

### ConfirmDialog Default Override
The default `description` in ConfirmDialog should be replaced per-use-case:
```
❌ Generic: "تأكيد الإجراء المطلوب. يتم الاحتفاظ بالسجلات المحاسبية والتاريخية في الأرشيف لحماية سلامة البيانات."
✅ Specific: "سَيُحذف هذا العقار من القائمة، لكن تبقى فواتيره وسجل عقوده محفوظة."
```

---

## 8. Privacy & Security

### Data collection messages
- **Login:** Collects email and password only. No pre-checked consent boxes.
- Never ask for national ID, bank account numbers, or other sensitive PII in the browser without server-authorised encryption.
- Support contacts are shown on-demand (collapsed panel).

### Accessibility of security claims
- Never promise "military-grade encryption" or "100% security".
- State actual controls: role-based permissions, audit log, row-level security.

### Session & authentication
- "جلسة آمنة" = Secure session. Show session timeout warning if the session is about to expire.
- Password change: require current password before new password.

---

## 9. Payments & Money

### Currency display
- Always use the company's configured currency symbol (OMR, SAR, AED…).
- Arabic amounts use Arabic numeral characters with Latin digits (0-9).
- Three decimal places for OMR, two for most other currencies.
- Never show amounts as blank or `—` when the value is `0` — show `0` (or the formatted equivalent).

### Payment actions
- "تسجيل دفعة" — record a payment
- "تأكيد الدفع" — confirm a receipt
- Avoid "قبض" (colloquial); prefer "تحصيل" (formal).

### Financial errors
- A failed payment must not show as "no payments".
- Bank reconciliation errors: show ErrorState, never an empty table.
- Invoice/receipt not found: show Arabic explicit message, not raw PostgREST error.

---

## 10. Trust Communication

### What we never write
- ❌ "انضم إلى أكثر من 1000 عميل" — fictitious social proof
- ❌ "وفر 50% من وقتك" — unsubstantiated savings claim
- ❌ "مضمون 100%" — no guarantee claim without legal backing
- ❌ "عرض محدود" — fake urgency
- ❌ "آمن تماماً" — absolute security claim

### What we write instead
- ✅ "منصة عربية لإدارة العقارات الإيجارية"
- ✅ "صلاحيات أدوار دقيقة وسجل تدقيق لكل حركة"
- ✅ "يعمل من المتصفح مباشرة — لا تثبيت"
- ✅ "اطلب عرضاً تجريبياً"

### Support
- "تحتاج مساعدة؟ تواصل معنا"
- Show contact options on user request — never auto-dial or auto-redirect.

---

## 11. Arabic & English Consistency

### Arabic grammatical notes
1. **Nominative in headings:** Use المستأجرون (nominative) not المستأجرين (accusative/genitive) in section headings and navigation labels.
2. **إضافة vs إنشاء:** Use "إضافة" for entities (عقار, وحدة, شخص) and "إنشاء" for documents (عقد, فاتورة).
3. **المصروفات** (not المصاريف) for operational expenses.
4. **التأمينات** (not الودائع or الخصم) for security deposits.
5. **جهات التعامل** (not الأشخاص) for the people directory as the canonical product name.

### Arabic writing conventions
- Use formal فصحى, not colloquial (عامية).
- Avoid Egyptian or Gulf dialect terms (e.g. "أكتر", "عايز", "اللي" — use "أكثر", "تريد", "التي").
- Prefer "جارٍ" over "جاري" for ongoing actions (جارٍ التحميل).
- Use "رسوم" for fees, not "مصاريف".

### RTL-aware patterns
- Icons before text in RTL (cognitively "after" text in LTR).
- Loading spinners are on the right side of buttons in RTL.
- Directional icons (arrows, chevrons) must have `rtl:rotate-180` class.

### English fallback
- The current shell is Arabic-first. English labels exist in `i18n.ts` but are secondary.
- Navigation must never fall back to English; a missing Arabic label is a defect.
- Error messages shown to the user must always be Arabic regardless of the `lang` attribute.

---

## 12. Examples from the Project

### ✅ Good examples

**Login page:**
- "مرحبًا بعودتك" — warm but professional
- "سجّل الدخول إلى مساحة عملك في MALEK" — clear purpose
- Caps Lock warning: non-judgemental, actionable
- Support: expandable, never forced

**Permission request:**
- "ليس لديك صلاحية" — direct, not accusatory
- "الوصول إلى «{label}» يحتاج إلى صلاحية إضافية." — explains why
- Status labels for PENDING/APPROVED/REJECTED — transparent workflow

**Offline banner:**
- "لا يوجد اتصال بالشبكة"
- "يمكنك مراجعة البيانات الظاهرة، لكن الحفظ والتحديث قد يفشلان حتى يعود الاتصال." — honest, not alarming

**Write Error:**
- "لم يتم حفظ التغيير" — avoids "فشل", describes the outcome

**Empty states in registers:**
- "لا توجد عقود بعد. أنشئ أول عقد من زر «عقد جديد» في الأعلى."
- "لا توجد فواتير ضمن الفلاتر الحالية." + action hint

**Error state:**
- "تعذر تحميل البيانات. تحقق من الاتصال والصلاحيات ثم أعد المحاولة."
- "إعادة المحاولة" button — clear action

**Bank reconciliation error fix:**
- Hides KPI grid when data fails to load → prevents zero-KPI deception
- Shows ErrorState with retry → user knows it failed

### ❌ Anti-patterns (do not repeat)

**Inconsistent plural:**
- `i18n.ts` uses "المستأجرين" (genitive) while `terminology-registry.ts` uses "المستأجرون" (nominative)

**Inconsistent term:**
- `i18n.ts` uses "المصاريف" while `terminology-registry.ts` uses "المصروفات"

**Inconsistent AI label:**
- `i18n.ts` uses "مساعد الذكاء" while `terminology-registry.ts` uses "المساعد الذكي"

**Generic confirm label:**
- `ConfirmDialog` default confirmLabel = "تأكيد" — doesn't name the outcome

**Passive construction in confirm default:**
- "يتم الاحتفاظ بالسجلات المحاسبية والتاريخية في الأرشيف" — passive, hard to parse

**Blameful language avoided ✅ but could still appear in error.message chains**

---

## 13. Review Checklist

Use this checklist before committing any UI text change:

- [ ] Does every label use a canonical glossary term?
- [ ] Is the Arabic in nominative case for headings (المستأجرون not المستأجرين)?
- [ ] Are action buttons labelled with the outcome, not the action type?
- [ ] Does the confirm dialog name the specific action?
- [ ] Is the error message in Arabic, with what happened + what to do next?
- [ ] Is the empty state a guide with a next step?
- [ ] Are there no testimonials, fake urgency, or unsubstantiated claims?
- [ ] Are all icon-only buttons accessible via `aria-label`?
- [ ] Are directional icons correctly mirrored in RTL?
- [ ] Does the message work on mobile (front-loaded key info)?
- [ ] Does the message parse correctly in a screen reader (role="alert" / aria-live)?
- [ ] Does the English fallback match the Arabic meaning?

---

> **Maintenance:** This document is a living guide. When adding new features, expand Section 12 with before/after examples. When renaming a glossary term, update all entries and run `grep -r` across the codebase for old terms.