# MOBILE_EXPERIENCE_STANDARD

> المعيار القانوني الوحيد لتجربة الموبايل واللمس في MALEK.
> أي سطح جديد أو معدّل يلتزم بهذا المعيار. أي انحراف يعتبر عيب موبايل.

---

## 1. نقاط التوقف (Breakpoints) — مبنية على المحتوى لا على أجهزة

| النطاق | الحد | نمط المحتوى |
|---|---|---|
| **هاتف صغير** | < 360px | بطاقات عمودية، تقليص الحشوة (entity-card 0.75rem)، زر عائم Menu+Search |
| **هاتف** | 360–639px | بطاقات/أوراق، Bottom Sheet للقوائم والفلاتر، جدول → بطاقات موبايل |
| **هاتف كبير / iPad عمودي** | 640–767px | نفس أنماط الهاتف مع هوامش أوسع |
| **iPad / تابلت** | 768–1023px | جدول مدمج، هامبرغر في الهيدر، بحث ظاهر في الهيدر |
| **لاب توب** | 1024px+ | جدول كامل، Sidebar مفتوح، قوائم مضمّنة |
| **ديسكتوب عريض** | 1280px+ | max-w-7xl افتراضي، 96rem للصفحات العريضة |

> القاعدة: **التصميم مرة واحدة** لكل سطح، وليس نسخة لكل جهاز. الجدول الواحد ينقلب لبطاقات على الموبايل، والدوسيه الواحد يُعرض مرة واحدة لكل المقاسات.

---

## 2. قواعد اللمس والتباعد

| القاعدة | القيمة |
|---|---|
| **حد اللمس الأدنى** | 44px (`min-h-11`/`min-w-11`) لكل عنصر تفاعلي — ممنوع أي `min-h-8/9/10` أو `h-9/10` على أزرار |
| **الحقول** | `min-h-12` على الموبايل، `sm:min-h-11` |
| **حلقة التركيز** | موحّدة `focus:ring-4 focus:ring-primary/10` |
| **منع زوم iOS** | خط 16px على الحقول (`text-base sm:text-sm`) |
| **كشف اللمس ضد hover العالق** | `@media (hover: none) and (pointer: coarse)` يُبطل حالات hover الشبحية |

---

## 3. أنماط الاستجابة المسؤولة (Responsive Patterns)

| المحتوى | النمط |
|---|---|
| جدول كثيف | **بطاقات موبايل** (`data-entity-table-mobile`) على <768px، وجدول على ≥768px |
| قوائم/فلاتر معقدة | **Bottom Sheet** (`BottomSheet`) — تحفظ الـ safe-area وتبقى داخل الـ viewport |
| أزرار إجراءات كتيرة | **Overflow menu** في `page-header-actions` ينفتح Bottom Sheet على الموبايل |
| شبكات KPI | **Reflow** إلى عمودين ثم عمود (`responsive-card-grid`) |
| دوسيه تفصيلي | **Disclosure** — تبويب/أقسام قابلة للطي، لا إخفاء بيانات مهمة |
| جدول عريض اضطراري | **احتواء أفقي** `mobile-scroll-x` + `overscroll-x-contain` فقط عند الضرورة |

---

## 4. لوحة المفاتيح والـ viewport

- `__root.tsx` يقرأ `window.visualViewport` ويضبط متغيرات `--visual-viewport-*` عند أي `resize`/`orientationchange`.
- الحوارات والأوراق والنماذج تستهلك هذه المتغيرات (`top`/`max-h`/`center-y`) فتظل فوق لوحة المفاتيح ولا تُغطّى.
- حقول الإدخال `scroll-mb-16` حتى لا تُغطّى بخلوص الأزرار اللاصقة.

---

## 5. الحالات وviewport (State Matrix)

| الحالة | الهاتف | التابلت | الديسكتوب |
|---|---|---|---|
| تحميل | skeleton بطاقات | skeleton جدول | skeleton جدول |
| فارغ | `EmptyState` (إرشاد بلا اختلاق بيانات) | نفسه | نفسه |
| خطأ | `ErrorState` + إعادة محاولة | نفسه | نفسه |
| انقطاع | شريط «قد يفشل الحفظ» في `app-shell` | نفسه | نفسه |
| منتهية الجلسة | إعادة توجيه تسجيل الدخول | نفسه | نفسه |
| أفقي (landscape) | إعادة حساب viewport عبر `orientationchange` | جدول كامل | — |

---

## 6. إمكانية الوصول على الموبايل

1. كل عنصر تفاعلي ≥44px (حارس ثابت `touch-target-floor.test.ts`).
2. قوائم الموبايل Bottom Sheet تستعيد التركيز عند الإغلاق (`mobile-drawer-focus-restoration`).
3. `aria-label`/`role` لكل سطح (نفس معايير الديسكتوب).
4. لا نص عربي بتباعد أحرف (`tracking`) ولا `uppercase` — **تباعد الحروف يكسر اتصال الحروف العربية**. يُسمح بهما فقط للشعار اللاتيني «MALEK».

---

## 7. اختبارات القبول

| الاختبار | ما يضمنه |
|---|---|
| `touch-target-floor.test.ts` | صفر زر تحت 44px |
| `cross-device-design-contract.test.ts` | هامبرغر الهاتف/التابلت، بحث الهيدر، clearances الهاتف فقط |
| `ux-foundation.test.ts` | متغيرات الخلوص العائم، حالات الضغط، منع زوم iOS، توهج الفلاتر |
| `entity-table.mobile-datum-visibility.test.tsx` | البطاقة الموبايل تعرض المعلومة الأساسية أولاً |
| `browser-ux-acceptance.test.tsx` / e2e Playwright | إكمال لوحة مفاتيح، قارئ شاشة، زوم، دوران، شبكة ضعيفة، RTL، safe-area |

---

## 8. التغيير المنفّذ في هذه الدورة

أزلت `uppercase` عديم المعنى و`tracking` (تباعد الأحرف) من **النص العربي** في 5 أسطح، لأنه يكسر اتصال الحروف في الخط المتصل ويقلل القراءة على الموبايل:

1. `components/ui/typography.tsx` — variants `label` و `overline`.
2. `features/properties/property-detail-page.tsx` — عناوين فئات الدوسيه.
3. `features/reports/components/report-section-primitives.tsx` — eyebrow لوحات التقارير.
4. `features/reports/components/ReportsWorkspace.tsx` — «لوحة القرار».

**المحتفظ به** (صحيح): الشعار اللاتيني «MALEK» (`dir="ltr"` + خط Sora) يبقي `uppercase tracking-[0.16em]` — صحيح للاتيني.
