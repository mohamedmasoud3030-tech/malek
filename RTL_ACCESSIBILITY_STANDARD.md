# RTL_ACCESSIBILITY_STANDARD

> المعيار القانوني الوحيد لسلوك RTL (عربي) وإمكانية الوصول (WCAG 2.2 AA) في MALEK.
> أي سطح جديد أو معدّل يلتزم بهذا المعيار.

---

## 1. مصفوفة التغطية (Coverage Matrix)

| المجال | الحالة | الدليل |
|---|---|---|
| **اتجاه المستند** `dir="rtl"` + `lang="ar"` | ✅ مفروض | `index.html` `<html lang="ar" dir="rtl">` + `applyDocumentLanguageDirection()` |
| **خصائص CSS منطقية** | ✅ مطبق | `padding-inline` / `margin-inline` / `inset-inline` / `border-inline-start` عبر كل المكوّنات |
| **أيقونات اتجاهية** | ✅ معكوسة | أزرار الرجوع `rtl:rotate-180`، الـ SectionTabs بتبدّل ArrowLeft/Right حسب RTL |
| **أرقام/عملات/تواريخ** | ✅ معزولة | `dir="ltr"` + `tabular-nums` على كل المبالغ والتواريخ والهواتف |
| **عزل ثنائي الاتجاه** (bidi) | ✅ مطبق | `bdi`/`dir` على القيم الديناميكية المختلطة عربي/إنجليزي |
| **ترتيب العناوين** | ✅ متدرج | h1 (صفحة) → h2 (قسم) → h3 (كارت)، بدون قفزات |
| **أسماء وصولية** | ✅ كاملة | كل زر أيقونة له `aria-label` (337 موضع مفحوص) |
| **تركيز مرئي** | ✅ موحّد | `focus:ring-4 focus:ring-primary/10` عبر كل العناصر التفاعلية |
| **أهداف لمس 44px** | ✅ مضمونة | حارس `touch-target-floor.test.ts` يمنع أي زر تحت 44px |
| **إعلانات ديناميكية** | ✅ مطبقة | `role="status"` / `aria-live="polite"` للحالات، `role="alert"` للأخطاء |
| **إشارات غير لونية** | ✅ مطبقة | الـ StatusBadge بيستخدم نص + أيقونة + نقطة، مش اللون وحده |
| **حركة مخففة** | ✅ مدعومة | `motion-reduce:transition-none` + `prefers-reduced-motion` في globals.css |

---

## 2. قواعد المكوّنات (Component Rules)

### الاتجاه والأيقونات
- كل أيقونة **اتجاهية** (سهم، chevron) تعتمد `rtl:` variant صحيح — مش "قلب يدوي".
- الأيقونات **غير الاتجاهية** (إضافة، حذف، تحذير) لا تُعكس.

### الأرقام والعملات
- كل مبلغ/تاريخ/هاتف داخل `dir="ltr"` مع `tabular-nums` — حتى وسط النص العربي.
- العملة دايمًا OMR (من عقد إعدادات الشركة)، 3 خانات عشرية.

### الحالات والتنبيهات
- الأخطاء: `role="alert"` + رسالة "ما حدث + الخطوة التالية" — أبدًا بلا لوم.
- التحميل: `role="status"` + `aria-live="polite"` + نص "جارٍ…".

### الجداول والتبويبات
- الجداول الكثيفة تتحول لبطاقات على الموبايل (`data-entity-table-mobile`) مع الحفاظ على المعلومة الأساسية أولًا.
- التبويبات تتبع نمط ARIA tabs (Tab يدخل، أسهم تتنقل، RTL يبدّل الاتجاه).

---

## 3. تنسيق التعريب (Localization Formatting)

| النوع | التنسيق |
|---|---|
| العملة | OMR + 3 خانات عشرية + `ar-OM` locale |
| التاريخ | `YYYY-MM-DD` في البيانات، عرضه حسب locale الشركة |
| الأرقام | أرقام لاتينية (`tabular-nums`) مع فواصل آلاف |
| الهاتف/البريد | `dir="ltr"` + روابط `tel:` / `mailto:` |
| التوسّع النصي | `break-words` + `[overflow-wrap:anywhere]` لكل العناوين والقيم |

---

## 4. الاختبارات (Tests)

| الاختبار | ما يضمنه |
|---|---|
| `touch-target-floor.test.ts` | صفر زر تحت 44px |
| `ux-foundation.test.ts` | منع زوم iOS، حالات الضغط، توهج الفلاتر، خلوص الـ safe-area |
| `cross-device-design-contract.test.ts` | هامبرغر/بحث/هيدر موحّد عبر الأجهزة |
| `browser-ux-acceptance.test.tsx` | أسماء وصولية، حدود اللمس، كسر الكلمات، safe-area |
| `design-system-inventory.test.ts` | لا blur مفرط، لا أنماط ميتة، Headers موحدة |
| `dialog-modal-semantics.test.tsx` / `mobile-drawer-focus-restoration.test.tsx` | aria-modal + استعادة التركيز (WCAG 2.4.3) |

### التحقق اليدوي المتبقي (بعد استقرار القاعدة)
- قارئ شاشة فعلي (VoiceOver/NVDA) على رحلة "إضافة عقار → حفظ".
- اختبار WebKit حقيقي (iOS) لحقل الإدخال والـ virtual keyboard.
- تدقيق تباين axe كامل على الشاشات الحرجة.

---

## 5. التحقق الآلي المؤكد (هذه الجولة)

- **RTL**: كل الشاشات `dir=rtl` (login/dashboard/properties/contracts/financials/maintenance) — مؤكد بـ Chromium.
- **صفر overflow أفقي** على widths 360/390/430 لكل الشاشات الرئيسية.
- **16px** على حقول الإدخال (يمنع زوم iOS).
- **Tab order** صحيح (email → password)، **Enter** يُرسل بدون stuck.
- **focus** ثابت أثناء الكتابة (لا فقدان تركيز).

---

## 6. الحواجز الحرجة (Critical/High)

| الخطورة | الحاجز | الحالة |
|---|---|---|
| — | لا حواجز Critical مفتوحة | ✅ |
| High سابقًا | الهامبرغر المكرر في الهيدر | ✅ أُزيل (bottom control center هو المدخل الوحيد) |
| High سابقًا | `uppercase`/`tracking` على عربي (يكسر اتصال الحروف) | ✅ أُزيل |
| Medium سابقًا | ألوان status غير موحدة (legacy vs semantic) | ✅ وُحّدت |
