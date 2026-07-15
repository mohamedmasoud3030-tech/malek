# Rentrix Financial Presentation Specification v2.0

**Date:** 2026-07-15
**Status:** Active
**Rule:** Financial amounts are the most important content on any screen they appear on.

---

## Amount Display Rules

### Currency Formatting

```
Currency: Omani Rial (ر.ع.)
Locale: ar-OM
Format: Arabic numerals, 3 decimal places
Example: ١٬٢٥٠٫٥٠٠ ر.ع.
```

### Typography

| Context | Size | Weight | Family Feature |
|---------|------|--------|---------------|
| KPI value | 28px | 700 | tabular-nums |
| Table amount | 14px | 500 | tabular-nums |
| Detail amount | 24px | 700 | tabular-nums |
| Invoice total | 20px | 700 | tabular-nums |
| Receipt amount | 20px | 700 | tabular-nums |
| Balance due | 18px | 700 | tabular-nums |
| Subtotal | 14px | 500 | tabular-nums |

**All financial amounts use `dir="ltr"`** to keep number rendering consistent, wrapped in an inline element.

### Color Rules

| Condition | Amount Color | Background |
|-----------|-------------|------------|
| Positive (inflow, paid) | success text | none |
| Negative (outflow, expense) | danger text | none |
| Zero | text-muted | none |
| Overdue balance | danger text | danger bg subtle (2% opacity) |
| Normal balance | text-primary | none |

---

## Invoice Presentation

### Status → Visual Mapping

| Status | Badge | Row Treatment | Amount Treatment |
|--------|-------|---------------|------------------|
| Draft | info tone | Normal | Muted amount |
| Posted | success tone | Normal | Normal amount |
| Paid | success tone | Green left-border | Success amount |
| Partial | warning tone | Amber left-border | Warning amount |
| Overdue | danger tone | Red left-border + bold | Danger amount + bold |
| Void | neutral tone | Strikethrough text | Muted + strikethrough |

### Invoice Detail

```
┌─────────────────────────────────────────────────┐
│  فاتورة #INV-2026-0012         ◐ مدفوعة جزئيًا  │
│                                                 │
│  المبلغ:          ١٬٢٥٠٫٠٠٠ ر.ع.               │
│  المدفوع:           ٥٠٠٫٠٠٠ ر.ع.               │
│  المتبقي:           ٧٥٠٫٠٠٠ ر.ع.  ← warning     │
│                                                 │
│  العقار: برج السلام - الطابق ٣                   │
│  المستأجر: شركة النور                           │
│  التاريخ: ٢٠٢٦-٠٧-٠١                             │
│  الاستحقاق: ٢٠٢٦-٠٧-١٥                           │
└─────────────────────────────────────────────────┘
```

---

## Receipt Presentation

### Status → Visual Mapping

| Status | Badge | Row Treatment |
|--------|-------|---------------|
| Active | success tone | Normal |
| Void | neutral tone | Strikethrough, muted |
| Allocated | success tone | Normal |

### Receipt → Invoice Allocation

When a receipt is allocated to invoices, show:
- Receipt total: bold
- Allocated amounts: listed below, each with invoice reference
- Unallocated remainder: highlighted

```
┌─────────────────────────────────────────────────┐
│  سند قبض #RCT-2026-0045                         │
│  المبلغ: ١٬٠٠٠٫٠٠٠ ر.ع. ✓ نشط                   │
│                                                 │
│  التخصيصات:                                     │
│  ├── INV-2026-0012:  ٥٠٠٫٠٠٠ ر.ع.              │
│  └── INV-2026-0015:  ٣٠٠٫٠٠٠ ر.ع.              │
│  المتبقي غير مخصص:   ٢٠٠٫٠٠٠ ر.ع.               │
└─────────────────────────────────────────────────┘
```

---

## Expense Presentation

### Category → Visual Mapping

| Category | Icon | Default Treatment |
|----------|------|-------------------|
| Maintenance | Wrench | Normal |
| Utilities | Zap | Normal |
| Salary | Users | Normal |
| Government | Building | Normal |
| Other | FileText | Normal |

### Amount Rule

All expenses shown as negative outflow:
- Color: danger text
- Prefix: minus sign (−)
- No red background unless warning threshold exceeded

---

## Dashboard Financial Summary

### KPI Grid

```
┌──────────┬──────────┬──────────┬──────────┐
│  ❶       │  ❷       │  ❸       │  ❹       │
│  الإيرادات│ المصروفات │ الصافي    │ المستحقات │
│  12,500  │  -4,200  │  8,300   │  3,750   │
│  ر.ع.    │  ر.ع.    │  ر.ع.    │  ر.ع.    │
│  ↑ 12%   │  ↓ 5%    │  ↑ 18%   │  ⚠ 3 متأخر│
└──────────┴──────────┴──────────┴──────────┘
```

### Color Coding

- Revenue: no special color (positive is default)
- Expenses: danger text (negative is important)
- Net: success text if positive, danger text if negative
- Outstanding: warning/danger based on age

---

## Arrears Presentation

### Aging Buckets

| Bucket | Label | Tone | Visual Treatment |
|--------|-------|------|------------------|
| Current | الحالية | success | Normal |
| 1-30 days | ١-٣٠ يوم | warning | Amber left-border |
| 31-60 days | ٣١-٦٠ يوم | danger (mild) | Orange left-border |
| 61-90 days | ٦١-٩٠ يوم | danger | Red left-border |
| 90+ days | +٩٠ يوم | danger (severe) | Red background tint + bold |

### Arrears Summary Card

```
┌─────────────────────────────────────────────────┐
│  ⚠ المتأخرات                                    │
│                                                 │
│  إجمالي المستحقات:  ١٥٬٧٥٠٫٠٠٠ ر.ع.            │
│                                                 │
│  ✓ حالي:          ٨٬٠٠٠ (٥١٪)                   │
│  ◐ ١-٣٠ يوم:      ٣٬٢٥٠ (٢١٪)                   │
│  ⚠ ٣١-٦٠ يوم:     ٢٬٥٠٠ (١٦٪)                   │
│  ⊗ ٦١-٩٠ يوم:     ١٬٢٥٠ (٨٪)                    │
│  ⊗ +٩٠ يوم:         ٧٥٠ (٥٪)                    │
│                                                 │
│  عدد العقود المتأخرة: ٨                          │
└─────────────────────────────────────────────────┘
```

---

## Bank Reconciliation Presentation

### Transaction Matching States

| State | Badge | Visual |
|-------|-------|--------|
| Matched | success | Connected line, checkmark |
| Unmatched (system) | warning | Amber, "موجود في النظام فقط" |
| Unmatched (bank) | info | Blue, "موجود في كشف البنك فقط" |
| Difference | danger | Red, amount variance shown |

### Reconciliation Summary

```
┌─────────────────────────────────────────────────┐
│  تسوية بنكية — يوليو ٢٠٢٦                        │
│                                                 │
│  رصيد البنك:        ٥٠٬٠٠٠٫٠٠٠ ر.ع.             │
│  رصيد النظام:       ٤٨٬٧٥٠٫٠٠٠ ر.ع.             │
│  الفرق:              ١٬٢٥٠٫٠٠٠ ر.ع. ⚠           │
│                                                 │
│  ✓ متطابقة:  ٤٢ عملية                           │
│  ⚠ غير متطابقة:  ٣ عمليات                       │
└─────────────────────────────────────────────────┘
```

---

## Void / Cancellation Rules

### Visual Treatment

- Voided items: strikethrough text + muted color
- "VOID" badge: neutral tone
- Void reason: shown as small text below the voided amount
- Voided by + date: metadata in muted text

### Confirmation Required

Every void action shows a confirmation dialog:
- Title: "تأكيد الإلغاء"
- Description: explains consequences
- Reason input (optional but encouraged)
- Red "إلغاء" button
- Grey "تراجع" button

---

## Financial Safety Rules (Visual)

1. **No auto-save** on financial forms — explicit submit button always
2. **Calculated values** (balances, totals) visibly recalculate before submit
3. **Confirmation** on any amount > 0 that changes financial state
4. **Success toast** after every financial mutation
5. **Error toast** with specific message (not generic "حدث خطأ")
6. **Idempotency** — double-click protection on all financial submit buttons
