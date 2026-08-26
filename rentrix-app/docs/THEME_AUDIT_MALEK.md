# تحليل نظام الألوان والـ Theme الحالي - MALEK

**تاريخ التحليل:** 2026-08-26  
**الهدف:** فهم كيف مبني نظام الألوان فعليًا قبل اختيار اتجاه جديد، بدون تغيير عشوائي

---

## 1. البنية المعمارية للـ Theme

### المصدر الوحيد الحقيقي
- **الملف المركزي:** `src/styles/tokens.css`
- يحتوي على جميع القيم كـ HSL channels (مثل `214 32% 98%` بدون `hsl()`)
- يتم تحويلها إلى Tailwind utilities عبر `@theme inline` في نفس الملف
- **Tailwind v4 لا يقرأ `tailwind.config.js`** - الجسر في `tokens.css` هو ما يولد `bg-primary`, `text-success`, `shadow-card` إلخ

### آلية التبديل Light/Dark
- ليس عبر `prefers-color-scheme` - بل عبر `document.documentElement.dataset.theme = 'light' | 'dark'`
- `@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *))` يربط فئات `dark:*` بهذا الـ dataset
- `index.html` يحتوي على سكريبت inline صغير يقرأ `localStorage rentrix-theme` قبل الـ render لمنع flash

### طبقات الـ CSS
1. `tokens.css` - المصدر الوحيد للألوان والظلال والنصف قطر والمسافات
2. `globals.css` - base layer + utilities + landing tokens + print styles
3. `malek-pro-visual-wave.css` - تصميم تشغيلي محمي بـ `[data-operational-route='true']`
4. `app-density-contract.css` - يمنع grids من 4-6 أعمدة للكروت
5. `design-system-foundation.css` - focus ring, tap highlight, table base
6. `ux-foundation.css` - gutters, scroll, touch targets, safe-area
7. `page-polish.css` - تحسينات صفحات عامة
8. `dashboard-v2.css` - تصميم الداشبورد فقط

---

## 2. ألوان Light Theme (القيم من tokens.css)

### الأسطح الأساسية
- `--color-bg`: `214 32% 98%` = `#F7F9FC` تقريبًا - خلفية التطبيق فاتحة جداً مزرقة
- `--color-card`: `0 0% 100%` = أبيض نقي - الكروت
- `--color-card-muted`: `214 28% 96%` = `#F2F5F9` - كروت ثانوية

### النصوص
- `--color-text-primary`: `215 28% 17%` = `#1E293B` تقريبًا - slate 800 داكن، للعناوين والمحتوى الأساسي
- `--color-text-secondary`: `215 16% 40%` = `#5B6B80` - للنصوص الثانوية
- `--color-text-muted`: `215 14% 46%` = `#6B7A8F` - للنصوص الباهتة، WCAG AA guard تم تعديله من 55% إلى 46% لتحقيق 4.85:1 على الأبيض

### الحدود
- `--color-border`: `214 24% 87%` = `#D6DEE8`
- `--color-border-light`: `214 24% 92%` = `#E4EAF1` - أفتح

### البراند
- `--color-primary`: `217 71% 45%` = `#1E5AA8` تقريبًا - أزرق متوسط مشبع، هو الأساس
- `--color-primary-fg`: أبيض
- `--accent`: `213 74% 52%` = `#2E7DE8` - أزرق أفتح قليلاً، يستخدم كـ accent عام
- `--secondary`: `210 20% 94%` = `#EEF2F6` - رمادي فاتح جداً

### السايدبار (داكن في كلا الثيمين)
- `--color-sidebar-bg`: `215 28% 12%` = `#151D2B` - navy داكن جداً
- `--color-sidebar-text`: `210 20% 85%` = `#D0D8E2` - نص فاتح
- `--color-sidebar-active-bg`: نفس الـ primary `217 71% 45%`
- `--color-sidebar-active-text`: أبيض
- `--color-sidebar-hover-bg`: `215 28% 18%` = `#1E2A3D` - hover أفتح قليلاً
- `--sidebar-border`: `215 20% 20%` = `#2A3447`

### حالات Status
- **Success**: text `152 66% 26%` = `#16764D` أخضر داكن، bg `152 62% 94%` = `#E6F7EE` أخضر فاتح جداً
- **Warning**: text `32 81% 32%` = `#945D0F` بني-أصفر داكن، bg `42 96% 92%` = `#FEF3C7` أصفر فاتح
- **Danger**: text `0 72% 42%` = `#B91C1C` أحمر داكن، bg `0 72% 95%` = `#FEE2E2` أحمر فاتح
- **Info**: text `199 74% 32%` = `#1375A0` أزرق داكن، bg `199 82% 94%` = `#E0F2FE` أزرق فاتح
- **Neutral**: text `215 16% 42%` = `#5A6B80`، bg `215 18% 92%` = `#E5EAF0`

### Product Accents (لـ KPI والـ Badges)
- **Emerald**: `154 67% 34%` / soft `153 56% 93%`
- **Amber**: `36 88% 42%` / soft `43 96% 91%`
- **Sky**: `199 83% 43%` / soft `198 85% 93%`
- **Rose**: `347 74% 48%` / soft `349 82% 94%`
- **Violet**: `263 69% 52%` / soft `263 78% 95%`
- **Slate**: `215 20% 42%` / soft `214 24% 93%`
- `--accent-foreground`: أبيض

### المالية
- Positive = Success, Negative = Danger, Neutral = Neutral (لا يعتمد على اللون وحده)

### أخرى
- Disabled bg `215 14% 86%`, fg `215 12% 58%`
- Overlay `215 30% 8%`
- Ring / Focus-ring = Primary
- Shadows: `shadow-card` = `0 1px 2px rgb(15 23 42 / 0.045), 0 10px 24px -22px rgb(15 23 42 / 0.22)` - ظل ناعم جداً

---

## 3. ألوان Dark Theme

### الأسطح
- `--color-bg`: `222 37% 8%` = `#0B1220` - خلفية داكنة جداً
- `--color-card`: `220 29% 12%` = `#151B2A` - كروت داكنة
- `--color-card-muted`: `220 25% 10%` = `#121827`
- `--surface-elevated`: `215 24% 16%` = `#1E293B` - أسطح مرتفعة أفتح قليلاً

### النصوص
- `--color-text-primary`: `210 20% 92%` = `#E2E8F0` - فاتح
- `--color-text-secondary`: `210 14% 68%` = `#9CA3AF`
- `--color-text-muted`: `210 10% 58%` = `#7D8590` - تم تعديله من 50% إلى 58% لتحقيق 4.05:1 على الكروت الداكنة

### الحدود
- `--color-border`: `218 22% 22%` = `#2A3447`
- `--color-border-light`: `218 18% 17%` = `#222C3B`

### البراند Dark
- `--color-primary`: `213 82% 64%` = `#5A9CF0` - أزرق فاتح مشرق للتباين على الداكن
- `--color-primary-fg`: `222 37% 8%` = نفس خلفية bg - نص داكن على primary فاتح
- `--accent`: `213 78% 68%` = `#6AA8F5` - أفتح من Light accent

### السايدبار Dark
- `--color-sidebar-bg`: `215 30% 7%` = `#0B121E` - أغمق من Light sidebar
- `--color-sidebar-text`: `210 20% 80%` = `#C2CDDA`
- `--color-sidebar-active-bg`: `213 82% 64%` = نفس primary dark
- `--color-sidebar-active-text`: `222 37% 8%` = داكن
- `--color-sidebar-hover-bg`: `215 28% 14%` = `#182234`

### Status Dark
- Success text `152 58% 62%` فاتح، bg `152 40% 16%` داكن
- Warning text `42 88% 64%` فاتح، bg `38 60% 16%` داكن
- Danger text `0 78% 70%` فاتح، bg `0 48% 18%` داكن
- Info text `199 82% 68%` فاتح، bg `199 46% 16%` داكن
- Neutral text `215 14% 55%`, bg `215 16% 18%`

### Product Accents Dark
نفس الـ hues لكن text فاتح (58-76% lightness) و bg داكن (16-19% lightness)

### Shadows Dark
- `shadow-card`: `0 1px 0 hsl(210 30% 96% / 0.035), 0 12px 28px -24px rgb(0 0 0 / 0.72)` - يستخدم أبيض شفاف 3.5% كـ highlight + أسود 72%
- `shadow-elevated`: `0 28px 64px -28px rgb(0 0 0 / 0.82), 0 0 0 1px hsl(210 20% 96% / 0.04)` - أسود 82% + حدود بيضاء 4%

---

## 4. ألوان Landing Page (منفصلة عن App)

في `globals.css` @theme:
- **Ink ramp** (للخلفيات الداكنة في اللاندنج):
  - `ink-950 #060d1a`, `ink-900 #0a1220`, `ink-850 #0e1930`, `ink-800 #12233f`, `ink-700 #1b3257`
- **Brand ramp** (أزرق اللاندنج):
  - `brand-50 #eef4ff` → `brand-700 #1d42d8` - تدرج من فاتح جداً إلى أزرق داكن مشبع

---

## 5. ألوان Critical Inline (index.html)

للـ FOUC prevention، نفس القيم تقريباً لكن مع اختلافات طفيفة:
- Light bg `224 20% 97%` بدل `214 32% 98%` في tokens.css - فرق hue 10 درجات
- Border `220 15% 90%` بدل `214 24% 87%`
- Text primary `222 35% 12%` بدل `215 28% 17%`
- Sidebar bg `222 48% 11%` بدل `215 28% 12%`
- **مشكلة:** هذه الاختلافات الطفيفة قد تسبب flash طفيف عند التحميل إذا لم تتطابق 100%

---

## 6. الحالات States

- **Hover**: 
  - Sidebar: `bg-sidebar-accent` = `sidebar-hover-bg` (18% lightness)
  - Cards: `shadow-card-hover` + `border` يصبح أغمق
  - Buttons: `bg-primary/90` (primary مع 90% opacity)
  - Table rows: `bg-muted/35` أو `bg-primary/0.045` في malek-pro wave
- **Active / Selected**:
  - Sidebar active: `bg-sidebar-active-bg` + `shadow-[inset_3px_0_0_0...]` indicator على الجانب المنطقي (RTL-aware)
  - Nav child active: نفس الخلفية
  - Table: لا يوجد selected state واضح
- **Focus**:
  - `focus-visible:ring-4 focus-visible:ring-primary/20` أو `ring-sidebar-accent/35`
  - Outline في design-system-foundation: `var(--focus-ring-width) solid hsl(var(--focus-ring) / 0.32)` 4px
- **Disabled**:
  - `opacity-50` + `bg-disabled` `215 14% 86%` / `215 16% 22%` dark

---

## 7. السايدبار والـ Toolbar والـ Bottom Navigation

### Sidebar
- خلفية داكنة ثابتة في كلا الثيمين (12% و 7% lightness) - هوية قوية
- نصوص `sidebar-foreground` 85% / 80% lightness - تباين جيد
- Active يستخدم Primary - واضح
- Hover يستخدم `sidebar-hover-bg` - فرق 6% lightness فقط، قد يكون غير واضح كفاية
- Border `sidebar-border` 20% / 16% - خافت

### Header (App Shell Header)
- `bg-card/95 backdrop-blur-md` مع `border-border/70` - شفاف مع blur
- Shadow: `0 1px 0 hsl(214 25% 87% / 0.7), 0 10px 28px -24px rgb(15 23 42 / 0.18)` light, و `0 1px 0 hsl(218 22% 21% / 0.9), 0 8px 24px -24px rgb(0 0 0 / 0.75)` dark
- يحتوي على Brand + Date + Theme toggle + User menu

### Mobile Bottom Navigation (MobileFloatingControl)
- `fixed bottom-0` مع `pb safe-area`
- Inner: `rounded-xl border border-border/70 bg-card p-1 gap-1 shadow` - كان `rounded-2xl` سابقاً، الآن أرفع
- Buttons: `size-10 rounded-lg border-transparent text-muted-foreground hover:bg-muted` - موحدة بعد إزالة تمييز AI
- كان AI مميز بـ `bg-primary rounded-full -translate-y-1.5` - تمت إزالته حسب الطلب

---

## 8. الجداول والكروت والنماذج والـ Dialogs

### Tables (`[data-entity-table]`)
- Header: `bg-muted/0.42` + `text-muted` 0.6875rem bold
- Body td: `text-[0.8125rem] border-border-light` + `text-primary` 44px min-height
- Hover: `bg-muted/0.35`
- في malek-pro wave: thead `bg-muted/0.72` أو `0.88` مع sticky, tbody even `bg-muted/0.14`, hover `bg-muted/0.45`

### Cards
- `border-border/65 bg-card p-3 shadow-card` + `hover:shadow-card-hover`
- KPI cards: `data-kpi-card` مع `::before` 2px top rule بلون الـ accent
- `kpi-card__icon`: `color: hsl(kpi-tone) bg: hsl(kpi-soft) inset shadow 0.18 opacity`

### Forms
- `input, select, textarea`: `min-height 44px border-radius 0.625rem bg-background` في operational route
- Focus: `border-primary/0.72 shadow 0 0 0 4px primary/0.11`
- Entity form surface dialog: `border-border radius 1.45rem shadow 34px 90px -36px 75% opacity`

### Dialogs / Popovers / Bottom Sheets
- `DialogContent`: خلفية `bg-card` + `border-border` + `shadow-elevated`
- Mobile drawer: `bg-sidebar text-sidebar-foreground border-white/10 shadow -12px 32px -16px 55% black`
- Notifications panel: `w-72 rounded-2xl border bg-card p-3 shadow-elevated` + mobile fixed bottom 4.75rem width 85vw

---

## 9. الـ Charts

- لا يوجد مكتبة Charts ثقيلة (Recharts تمت إزالتها أو استخدامها محدود)
- `dashboard-charts.tsx` يستخدم divs مع `bg-info, bg-success, bg-warning, bg-danger, bg-primary` كـ `dashboard-trend-bar__fill`
- هذه الألوان هي نفس Status colors، ليست palette مخصصة للـ Charts
- قد تحتاج palette منفصلة للـ Charts إذا تمت إضافة رسوم بيانية أكثر

---

## 10. ألوان Hard-coded خارج نظام الـ Theme

### في App UI (يجب تنظيفها):
- **Mobile nav sheet**: `bg-white/10`, `bg-white/[0.04]`, `bg-white/[0.06]`, `bg-white/[0.08]`, `bg-white/20`, `border-white/10`, `text-white` - كلها hard-coded أبيض مع opacity، بدل استخدام `sidebar-foreground` مع opacity
- **Landing**: `bg-grid-dark` يستخدم `rgba(148,163,184,0.07)` hard-coded
- **Login surface**: `radial-gradient(42rem... hsl(217 71% 45% / 0.12))` - يستخدم primary مباشرة مع opacity، مقبول لكنه hard-coded gradient
- **Print styles**: `#ffffff`, `#0f172a`, `#cbd5e1`, `#0F172A`, `#CBD5E1`, `#E2E8F0` إلخ - للطباعة فقط، مقبول
- **Documents renderer**: `documentHtml.ts` مليء بـ `#FFFFFF`, `#0F172A`, `#CBD5E1`, `#0284C7`, `#F8FAFC` إلخ - هذا للـ HTML الخاص بالطباعة/الـ PDF، منفصل عن App theme، مقبول لكن يمكن توحيده

### في Tokens نفسها:
- Shadows تستخدم `rgb(15 23 42 / ...)` و `rgb(0 0 0 / ...)` و `hsl(210 30% 96% / ...)` - هذه hard-coded لكنها للظلال فقط، مقبولة

### لا يوجد استخدام مباشر لـ Tailwind colors مثل `bg-blue-500` في App code (تم تنظيفه سابقاً) - جيد

---

## 11. الاختلافات وعدم الاتساق

1. **Inline tokens في index.html vs tokens.css**: اختلافات طفيفة في hue/lightness (مثلاً bg 224 20% 97% vs 214 32% 98%) - قد تسبب FOUC
2. **Sidebar hover**: فرق 6% فقط بين bg و hover-bg (12% → 18%) - قد لا يكون واضحاً كفاية للمستخدم
3. **Primary في Light vs Dark**: Light primary 45% lightness (داكن متوسط) و Dark primary 64% lightness (فاتح) - تباين جيد، لكن Accent في Light هو `213 74% 52%` أفتح من Primary، بينما في Dark Accent `213 78% 68%` أفتح أيضاً - قد يكون هناك تداخل في الاستخدام بين Primary و Accent
4. **استخدام Accent**: `--accent` معرف لكن استخدامه قليل - معظم الأزرار تستخدم Primary، وبعضها يستخدم `bg-accent` في button.tsx للـ hover - غير واضح متى نستخدم Primary ومتى Accent
5. **Success/Warning/Danger bg في Light**: 94%, 92%, 95% lightness - فاتحة جداً، قد تكون غير كافية للتباين مع النص الداكن في بعض الحالات
6. **Border opacity**: يستخدم `border-border/70`, `/80`, `/90`, `/65` بشكل غير متسق عبر المكونات - لا يوجد نظام موحد لشفافية الحدود
7. **Mobile nav sheet**: يستخدم أبيض hard-coded بدل tokens - في Dark mode قد لا يتناسق 100% مع باقي السايدبار
8. **Landing vs App**: Landing يستخدم `brand-500 #3b6ef6` بينما App primary هو `217 71% 45%` = `#1E5AA8` تقريباً - فرق واضح، اللاندنج أزرق أكثر إشراقاً من التطبيق

---

## 12. الاستخدام غير الصحيح للـ Primary / Accent

- **Primary** يستخدم بشكل صحيح للأزرار الأساسية والـ active states والـ links
- **Accent** معرف كـ `213 74% 52%` لكن استخدامه محدود - في `button.tsx` الـ outline variant يستخدم `hover:bg-accent hover:text-accent-foreground` بينما الـ primary variant يستخدم `bg-primary` - هذا قد يسبب ارتباك: هل الـ accent هو hover للـ outline؟
- في `filter-tabs.tsx` يستخدم `tone-amber` و `tone-sky` مباشرة بدل semantic - مقبول لأنه product accent
- في `dashboard-v2.css` يستخدم `color-primary` مباشرة في عدة أماكن - صحيح
- لا يوجد استخدام خاطئ واضح، لكن هناك **نقص في توثيق متى نستخدم Primary ومتى Accent**

---

## 13. CSS Variables / Tailwind Tokens

- **النظام الحالي مبني بشكل صحيح**: كل القيم في `:root` و `[data-theme='dark']` كـ channels، ثم جسر `@theme inline` يحولها إلى `hsl(var(--...))`
- **الميزة**: يمكن تغيير أي لون مركزياً من `tokens.css` فقط
- **المشكلة**: بعض المكونات تستخدم `bg-white/10` بدل `bg-sidebar-foreground/10` - هذه لا تستفيد من المركزية
- **المكونات التي تعتمد عليها**: تقريباً كل المكونات - `button`, `card`, `dialog`, `table`, `kpi-card`, `status-badge`, `sidebar`, `header`, `mobile dock`, `notifications`, `AI panel` إلخ - كلها تستخدم tokens

---

## 14. ملخص Color System الحالي

**الفلسفة**: Enterprise Minimalism + Swiss Clarity - ألوان هادئة، تباين عالي للنصوص، سايدبار داكن ثابت، primary أزرق متوسط للثقة، status ألوان تقليدية (أخضر، أصفر، أحمر، أزرق)، product accents غنية لـ KPI

**نقاط القوة**:
- نظام مركزي واحد في `tokens.css`
- تباين نصوص جيد (WCAG AA guards موثقة)
- سايدبار داكن يعطي هوية قوية ومختلفة عن المحتوى الفاتح
- Status colors واضحة ومتناسقة بين Light/Dark
- Shadows ناعمة ومتدرجة (card, hover, elevated)

**نقاط الضعف**:
- Primary أزرق تقليدي قد يكون ممل - لا يعكس هوية MALEK الفريدة
- Accent غير واضح الاستخدام
- Hard-coded أبيض في mobile nav
- اختلاف طفيف بين inline tokens و tokens.css
- Landing brand أزرق مختلف عن App primary

---

## 15. ما يمكن تغييره مركزياً vs ما هو Hard-coded

### يمكن تغييره مركزياً من tokens.css فقط:
- جميع ألوان Light/Dark: bg, card, text, border, primary, secondary, muted, sidebar, status, product accents, financial, disabled, overlay, ring, shadows, radius
- أي مكون يستخدم `bg-primary`, `text-foreground`, `border-border`, `bg-card`, `text-success` إلخ سيتغير تلقائياً

### Hard-coded ويحتاج تنظيف:
- `bg-white/10`, `bg-white/[0.04]` إلخ في `layout-navigation-view.tsx` (mobile nav sheet) - يجب تحويلها إلى `bg-sidebar-foreground/10` أو token
- `rgba(148,163,184,0.07)` في `bg-grid-dark`
- Gradients في login surface
- Print styles `#ffffff`, `#0f172a` - مقبولة للطباعة
- Document HTML renderer `#...` - للطباعة، يمكن إبقاؤها منفصلة

---

## 16. اقتراحات اتجاهات ألوان بديلة لـ MALEK

### الاتجاه 1: Deep Navy + Teal - Premium Trust (موثوقية عقارية)

**الفكرة**: يعكس الثقة والاحترافية العقارية، Navy عميق كـ primary بدل الأزرق المتوسط الحالي، Teal كـ accent عصري

- **Primary Light**: `222 70% 32%` = `#15305B` - navy عميق أغمق من الحالي، أكثر فخامة
- **Primary Dark**: `213 85% 68%` = `#6BB0FF` - أزرق فاتح مشرق للتباين
- **Accent Light**: `173 60% 40%` = `#2A9D8F` - teal أخضر-أزرق عصري، يذكر بالعقارات الفاخرة والاستدامة
- **Accent Dark**: `173 55% 55%` = `#5BC4B5` - teal فاتح
- **Background Light**: `40 20% 98%` = `#FCFBF9` - warm white دافئ بدل cool blue الحالي، أكثر راحة للعين العربية
- **Surface Light**: `0 0% 100%` أبيض
- **Background Dark**: `222 35% 9%` = `#0D1526` - navy داكن جداً
- **Surface Dark**: `222 28% 14%` = `#1A2335` - card داكن مزرق
- **Success**: يبقى أخضر لكن أكثر تشبع `152 70% 30%` / `152 45% 18%` dark
- **Warning**: amber دافئ `38 92% 50%` / `38 65% 18%` dark - ذهبي عقاري
- **Danger**: rose عميق `350 75% 45%` / `350 65% 65%` light text dark
- **Dark mode direction**: Navy أعمق، مع Teal كـ accent يضيء في Dark، خلفيات warm

**لماذا مناسب لـ MALEK**: Navy يعطي ثقة المؤسسات العقارية، Teal يضيف لمسة عصرية وإنسانية، Warm background يقلل إجهاد العين للمستخدم العربي الذي يقضي وقت طويل في النظام

---

### الاتجاه 2: Slate + Amber - Modern Warmth (دفء عربي عصري)

**الفكرة**: يعكس الضيافة العربية والحداثة، Slate داكن كـ primary محايد قوي، Amber ذهبي كـ accent دافئ

- **Primary Light**: `215 25% 27%` = `#333F4E` - slate داكن محايد، أقل برودة من الأزرق، أكثر حداثة
- **Primary Dark**: `215 20% 75%` = `#B0B8C5` - slate فاتح
- **Accent Light**: `38 92% 50%` = `#F59E0B` - amber ذهبي دافئ، يذكر بالصحراء والذهب والفخامة العربية
- **Accent Dark**: `38 85% 65%` = `#FBBF24` - amber فاتح مشرق
- **Background Light**: `30 15% 98%` = `#FCFAF8` - stone warm جداً، دافئ ومريح
- **Surface Light**: `0 0% 100%` أبيض
- **Background Dark**: `220 20% 10%` = `#14181F` - slate داكن محايد
- **Surface Dark**: `220 15% 16%` = `#22272F` - card داكن محايد
- **Success**: emerald `160 65% 35%`
- **Warning**: نفس الـ Accent Amber
- **Danger**: `0 75% 55%` أحمر دافئ
- **Dark mode direction**: محايد دافئ، Amber يبرز كـ CTA، أقل برودة من الحالي

**لماذا مناسب**: يعكس الهوية العربية (دفء، ضيافة، ذهب)، Slate محايد يترك المحتوى يبرز، Amber كـ accent يجذب الانتباه للأزرار المهمة بدون إزعاج، مناسب لسوق عمان والخليج

---

### الاتجاه 3: Ink + Electric Blue - Refined Current (تطوير الحالي)

**الفكرة**: يحافظ على هوية MALEK الحالية لكن يطورها - Primary أكثر تشبعاً وحيوية، مع نظام أوضح

- **Primary Light**: `217 80% 50%` = `#1A6ED8` - نفس hue الحالي 217 لكن أكثر تشبعاً (71%→80%) وأكثر إشراقاً (45%→50%) - أزرق أكثر حيوية وثقة
- **Primary Dark**: `213 90% 70%` = `#7AB8FF` - أزرق فاتح أكثر إشراقاً
- **Accent Light**: `199 90% 50%` = `#0EA5E9` - sky blue نقي، يستخدم للـ links والـ secondary actions بوضوح
- **Accent Dark**: `199 85% 70%` = `#38BDF8` - sky فاتح
- **Background Light**: `214 32% 98%` = نفس الحالي `#F7F9FC` - نحافظ عليه لأنه مريح
- **Surface Light**: `0 0% 100%`
- **Background Dark**: `222 37% 8%` = نفس الحالي - نحافظ
- **Surface Dark**: `220 29% 12%` = نفس الحالي
- **Success**: `142 76% 36%` = أخضر أكثر حيوية
- **Warning**: `38 92% 50%` amber
- **Danger**: `0 84% 60%` أحمر أكثر وضوحاً
- **Dark mode direction**: نفس البنية الحالية لكن Primary أكثر إشراقاً، مع توثيق واضح لاستخدام Accent

**لماذا مناسب**: أقل مخاطرة - يطور الحالي بدل تغييره، يحافظ على familiarity للمستخدمين الحاليين، لكن يجعل Primary أكثر تميزاً وثقة، ويوضح استخدام Accent

---

## 17. التوصية وعدم التطبيق الآن

**لا يتم تطبيق أي تغيير ألوان الآن** حسب الطلب - هذا الملف هو للتحليل والاقتراح فقط

**الخطوات التالية المقترحة**:
1. مراجعة هذا التحليل مع الفريق
2. اختيار اتجاه واحد من الثلاثة (أو دمج)
3. إنشاء `tokens.v2.css` أو branch جديد للتجربة
4. تحديث `tokens.css` مركزياً فقط (بدون تعديل مكونات)
5. تنظيف hard-coded `bg-white/*` إلى tokens
6. توحيد inline tokens في `index.html` مع `tokens.css`
7. اختبار التباين WCAG والـ visual regression

---

## 18. ملاحظات إضافية

- **الـ Charts**: تحتاج palette مخصصة إذا تمت إضافة رسوم أكثر - يمكن استخدام product accents كـ chart palette
- **الـ Sidebar**: هوية قوية، يفضل الحفاظ على كونه داكن في كلا الثيمين - هو differentiator جيد
- **الـ Bottom Navigation**: بعد التعديل الأخير أصبح `size-10` و `rounded-lg` - أرفع وموحد، لكن يجب التأكد من أنه لا يزال يحقق 44px touch target على الأجهزة الفعلية (يمكن استخدام padding إضافي غير مرئي)
- **الـ AI**: تم تنظيفه من "قراءة فقط" - الآن واجهة بوت مباشرة نظيفة
- **الإشعارات**: تم إصلاح العرض على الموبايل إلى `85vw` بدل `50vw` الضيق - مقروء ومريح داخل الشاشة
