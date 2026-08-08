# نظام تصميم Malik Pro - ملخص المشروع

## نظرة عامة

تم بناء نظام تصميم UI/UX متكامل لـ **مالك برو Malik Pro** مطابق للتصاميم المرفقة والمواصفات المطلوبة.

---

## الملفات المُنشأة

### 1. نظام التصميم (Design Tokens)
- `/src/styles/malik-pro-tokens.css` - ملف التوكنات الرئيسي
- `/src/styles/malik-pro.css` - ملف الأنماط الموسع

### 2. مكونات UI الأساسية (Components)

#### الأزرار (Buttons)
- `/src/components/malik-pro/malik-button.tsx`
- **المتغيرات**: `primary`, `secondary`, `dark`, `outline`, `ghost`, `soft`, `success`, `danger`
- **الأحجام**: `sm`, `md`, `lg`, `icon`

#### النوافذ المنبثقة (Modals)
- `/src/components/malik-pro/malik-modal.tsx`
- رأس داكن (Navy) مع زر إغلاق دائري
- هيكل RTL متجاوب

#### البطاقات (Cards)
- `/src/components/malik-pro/malik-card.tsx`
- **المتغيرات**: `default`, `flat`, `elevated`, `interactive`
- **الحواف**: 12px - 16px

#### حقول الإدخال (Form Inputs)
- `/src/components/malik-pro/malik-input.tsx`
- `MalikInput` - حقل نص
- `MalikSelect` - قائمة منسدلة
- `MalikTextarea` - حقل نص طويل
- `MalikCheckbox` - خانة اختيار
- `MalikRadioGroup` - أزرار اختيار دائرية

#### الشارات (Badges)
- `/src/components/malik-pro/malik-badge.tsx`
- `MalikBadge` - شارة عامة
- `MalikStatusBadge` - شارة حالة ذكية
- `MalikContractStatusBadge` - شارة حالة العقد
- `MalikPaymentStatusBadge` - شارة حالة الدفع

#### التبويبات (Tabs)
- `/src/components/malik-pro/malik-tabs.tsx`
- `MalikTabs` - تبويبات عامة
- `MalikFilterTabs` - تبويبات فلترة

#### الجداول (Tables)
- `/src/components/malik-pro/malik-table.tsx`
- `MalikTable` - جدول ذكي
- `MalikSimpleTable` - جدول بسيط
- `MalikTablePagination` - ترقيم صفحات

#### التنبيهات (Alerts)
- `/src/components/malik-pro/malik-alert.tsx`
- `MalikAlert` - تنبيه عام
- `MalikSuccessAlert` - تنبيه نجاح
- `MalikErrorAlert` - تنبيه خطأ
- `MalikLoadingAlert` - مؤشر تحميل

#### حالات التحميل والفارغة
- `/src/components/malik-pro/malik-states.tsx`
- `MalikLoadingState` - حالة التحميل
- `MalikEmptyState` - الحالة الفارغة
- `MalikErrorState` - حالة الخطأ
- `MalikSkeleton` - هيكل تحميل

---

### 3. واجهات الميزات (Feature Components)

#### نافذة عقد الإيجار
- `/src/features/malik-pro/contract-form-modal.tsx`
- **الحقول**:
  - العقار والوحدة (Dropdown)
  - اسم المستأجر الثلاثي
  - رقم الهاتف
  - الرقم المدني/السجل التجاري
  - دورية السداد (شهري/ربع سنوي/نصف سنوي/سنوي)
  - تاريخ بداية ونهاية العقد
  - قيمة الإيجار المستحق (ر.ع)
  - مبلغ التأمين المالي (ر.ع)
  - خيار التجديد التلقائي (Checkbox)

#### نافذة سداد الفاتورة وإصدار السند
- `/src/features/malik-pro/payment-receipt-modal.tsx`
- **المدخلات**:
  - مبلغ الدفعة الحالية (ر.ع)
  - طريقة السداد (تحويل بنكي/نقداً/بطاقة)
  - رقم المرجع/العملية
- **سند القبض المعتمد**:
  - رقم السند (RCP-YYYY-XXX)
  - بطاقة المبلغ باللون الأخضر
  - وسم "مسدد وموثق"
  - زر طباعة السند

#### نافذة طلب الصيانة
- `/src/features/malik-pro/maintenance-request-modal.tsx`
- **الحقول**:
  - العقار والوحدة
  - اسم المشتكي/المستأجر
  - نوع الصيانة (تكييف/سباكة/كهرباء/...)
  - عنوان المشكلة
  - وصف العطل
  - درجة الأهمية (عاجلة/عالية/متوسطة/منخفضة)
  - التكلفة المتوقعة (ر.ع)
- **الجهة المسؤولة** (Radio Cards):
  - المستأجر (فاتورة)
  - المالك (خصم تسوية)
  - الشركة (مصاريف)

#### قائمة طلبات الصيانة
- `/src/features/malik-pro/maintenance-list-section.tsx`
- تبويبات الحالة (جميعها/جديدة/قيد التنفيذ/المكتملة)
- بطاقات الطلبات مع:
  - رقم الطلب (MNT-YYYY-XXX)
  - وسوم ملونة للحالة والدرجة
  - وسوم نوع الصيانة
  - العقار والمستأجر
  - التكلفة التقديرية (ر.ع)

#### جدول الفواتير والمستقبوضات
- `/src/features/malik-pro/invoices-receipts-section.tsx`
- تبويبات رئيسية (الفواتير/سندات المقبوضات)
- فلترة فرعية (الكل/المتأخرة/المستحقة)
- جدول منسق مع:
  - رقم الفاتورة/السند
  - المستأجر والوحدة
  - العقار
  - المبلغ (ر.ع)
  - تاريخ الاستحقاق
  - الحالة
  - إجراءات (تحصيل/طباعة/تصدير)

---

### 4. أدوات التنسيق
- `/src/lib/malik-formatters.ts`
- `formatCurrency()` - تنسيق العملة (ر.ع)
- `formatCurrencyCompact()` - تنسيق عملة مضغوط
- `formatArabicDate()` - تنسيق التاريخ العربي
- `generateContractNumber()` - رقم العقد
- `generateInvoiceNumber()` - رقم الفاتورة
- `generateReceiptNumber()` - رقم السند
- `generateMaintenanceNumber()` - رقم الطلب

---

## الهوية البصرية

### الألوان
| الاستخدام | اللون | الكود |
|----------|-------|-------|
| الرئيسي (أزرار/مكتمل) | أخضر | `#3B8A64` / `#2D7A53` |
| الثانوي (تقارير/إجراءات) | أزرق | `#3B82F6` / `#2563EB` |
| الداكن (تنبيهات) | كحلي | `#111827` / `#1F2937` |
| الخلفيات | رمادي فاتح | `#F9FAFB` / `#F3F4F6` |

### الأبعاد
- **الحواف الدائرية**: 12px - 16px
- **ظل البطاقات**: `shadow-card` ناعم
- **ظل المرتفع**: `shadow-elevated` للـ Modals

### العملة
- **الرمز**: ر.ع
- **التنسيق**: دائمًا قبل الرقم
- **الكسور**: 3 خانات عشرية

### اتجاه النص
- **RTL**: مضبوط افتراضياً
- **الأرقام**: `tabular-nums` للاتساق

---

## كيفية الاستخدام

```tsx
import {
  MalikButton,
  MalikModal,
  MalikCard,
  MalikInput,
  MalikStatusBadge,
  MalikTabs,
} from '@/components/malik-pro';

import {
  ContractFormModal,
  PaymentReceiptModal,
  MaintenanceRequestModal,
  MaintenanceListSection,
  InvoicesReceiptsSection,
} from '@/features/malik-pro';
```

---

## المتغيرات البيئية

```css
[data-malik-pro] {
  --malik-primary: hsl(160 84% 29%);
  --malik-secondary: hsl(217 91% 60%);
  --malik-dark: hsl(222 47% 11%);
  --malik-success: hsl(152 66% 26%);
  --malik-warning: hsl(34 82% 31%);
  --malik-danger: hsl(350 76% 42%);
}
```

---

## جاهزية الدمج

 جميع المكونات:
- ✓ متوافقة مع React 18
- ✓ تستخدم TypeScript
- ✓ تدعم RTL
- ✓ تدعم الوضع الداكن (Dark Mode)
- ✓ متوافقة مع Accessibility
- ✓ تتوافق مع نظام التصميم الموجود

---

**مالك برو Malik Pro** - نظام إدارة عقارية متكامل
