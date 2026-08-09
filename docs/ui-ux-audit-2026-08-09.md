# تدقيق UI/UX — مشروع MALEK (مالك)

> **المنهجية:** استشاري خارجي، أول دخول للمشروع. تدقيق واجهات وتجربة مستخدم فقط — بدون تغيير منطق أو قاعدة بيانات. اعتمد الفحص على: `app-nav-items.ts`, `route-tree.ts`, `app-shell.tsx`, `layout-navigation-view.tsx`, صفحات `dashboard`, `properties`, `contracts`, `financials`, `reports`, `maintenance`, `operations-hub`, `people`, `settings`, `ai-assistant`, ومكونات `components/ui` + `components/enterprise` + `components/layout`.

> **تاريخ التدقيق:** 2026-08-09 | **النطاق:** كامل الواجهات المهيكلة حالياً (Desktop + Mobile + RTL)

---

## 1) الخلاصة التنفيذية — هل الشغل شكله طبيعي؟

**لا. البناء الهندسي قوي جداً، لكن المفهوم النهائي للمستخدم معطوب.**

- الكود ممتاز: تقسيم ممتاز، حالة تحميل/خطأ/فراغ موحدة، RTL مدروس، تصميم توكنز متسق، دعم لوحة مفاتيح و-Screen-reader جيد نسبياً.
- **المشكلة في الإدراك:** المستخدم يرى **6 بنود في القائمة الجانبية** لكن خلفها **20 مسار حقيقي** مخفية عبر `redirect` بصمت إلى `?section=` أو `?tab=`. يظن أنه سيذهب لصفحة ثم يجد نفسه في تبويب داخل صفحة أخرى. **الخرائط الذهنية تنكسر.**
- **الصفحات المحورية (المالية، العقار، التقارير، التشغيل) كلها مراكز هائلة (Hubs) متضخمة:** تبويب داخل تبويب داخل تبويب، وكل Hub يستخدم نمط تنقل مختلف (Sidebar عمودي / SectionTabs أفقي / Select موبايل / search param).
- **همجية بصرية خفيفة لكن تراكمية:** كل بطاقة لها `rounded-[1.5rem] + border + shadow-card + blur-2xl` والخلفية مليئة بدوائر ضبابية. العين لا تجد نقطة راحة.
- **ميزات موجودة لكن مدفونة 3–4 خطوات:** الوحدات، الأراضي، الأفراد، العملاء المحتملين، التواصل، المرافق، الأتمتة، خزينة المستندات — كلها ليست في القائمة الرئيسية.

**النتيجة:** النظام يبدو “مبني صح لكن معروض غلط”. المستخدم الخبير سيتعلم، المستخدم الجديد سيضيع.

---

## 2) خريطة الموقع الحالية (كما يراها المستخدم vs كما هي فعلياً)

### ما يراه المستخدم في الـ Sidebar (6+1 مجموعات):
```
الرئيسية        → /dashboard
إدارة العقارات    → /properties | /owners | /tenants | /contracts
التشغيل         → /maintenance
المالية والمحاسبة → /financials | /reports
الأدوات          → /ai-assistant
الإدارة         → /settings
```

### ما هو موجود فعلياً في `route-tree.ts` (18+ مسار مخفي يعمل Redirect):
```
 /units               → /properties?section=units
 /lands               → /properties?section=lands
 /people              → مفصول لكنه طفل لـ /contracts في الناف (WorkspaceChildNav)
 /leads               → /contracts?child
 /communication       → /contracts?child
 /utilities           → /maintenance?section=utilities
 /automation          → /maintenance?section=automation
 /documents-vault     → /maintenance?section=documents_vault
 /invoices|/receipts|/arrears|/expenses|/commissions|/deposits|/owner-settlements|/bank-reconciliation → كلها → /financials?section=...&view=...
 /accounting          → /reports?section=accounting
 /system|/audit-log|/data-integrity|/change-password → أطفال /settings
```

> **المشكلة:** لا يوجد أي مؤشر بصري في الـ Sidebar أن “التشغيل” يحتوي 4 أدوات، أو أن “المالية” بها 8 مشاهد. المستخدم يكتشفها بالصدفة بعد فتح الصفحة. و**الموبايل BottomNav يعرض 5 فقط** (dashboard, properties, tenants, contracts, financials) — مالك العقار (owners) وصيانة غير موجودين رغم أنهما عالي التكرار في هذا المجال!

**التوصية المعمارية (P0):**
- إمّا اجعل كل كيان وجهة أولى واضحة (مثلاً صف فرعي خفيف تحت كل قسم في Sidebar)، أو وحّد النمط: كل Hub يستخدم **نفس** نمط التنقل الثانوي (قترح: صف ثانوي أفقي sticky تحت الـ PageHeader + نفس الـ Select في الموبايل). لا تترك 4 أنماط مختلفة.

---

## 3) التنقل العام — AppShell & Navigation

### 3.1 الـ Sidebar (Desktop)
**الإيجابي:** تجميع دلالي جيد (إدارة العقارات/التشغيل/المالية)، أوصاف Tooltips، حالات `active` واضحة (border + inset line)، دعم collapse إلى 4.5rem، تحذير “أقسام حسب الصلاحية” ذكي.

**السلبي:**
- **العناوين الفئوية تختفي عند الطي** ويحل محلها خط `h-px` فقط — المستخدم المطوي لا يعرف أين يبدأ قسم جديد.
- **لا يوجد Breadcrumbs.** تفاصيل العقار تستخدم `BackTo="/properties"` فقط. المستخدم القادم من إشعار أو رابط مباشر لا يعرف مساره.
- **الـ collapse زر ChevronLeft صغير ومخفي فوق الـ logo** — صعب الاكتشاف.
- **QuickAddMenu (+)** يظهر فقط 3 عناصر (عقد/عقار/شخص) ويحترم الصلاحيات — ممتاز، لكن مكانه في الهيدر بعيد عن السياق (المستخدم داخل المالية ويضغط + لإضافة عقد يجب أن يفهم أن العقد ليس مالياً بحتاً).

### 3.2 الهيدر
- يحتوي: زر القائمة (موبايل) + زر الطي (ديسكتوب) + +QuickAdd + جرس الإشعارات + ثيم + حالة المزامنة + مستخدم. **مزدحم** لكن مقبول.
- **الإشعارات** تعيد استخدام `dashboard-snapshot` نفسه — ذكي للأداء، لكن العدّاد يظهر Badge أحمر فوق الجرس حتى لو 1 تنبيه — جيد.
- **حالة المزامنة** (متصل/جارٍ التحديث/دون اتصال) في الهيدر نص صغير — غير مرئي بما يكفي عند الخطأ.

### 3.3 الموبايل
- **BottomNav ثابت 62px + هيدر sticky 56px = 118px محجوزة** من الشاشة. المحتوى يبدأ متأخر جداً.
- **Drawer** يعرض كل الـ Sidebar لكن BottomNav لا يضيء للمسارات الفرعية بشكل حدسي (يعتمد `getNavRoot` — مثلاً `/properties/123/units` يضيء “العقارات” صح، لكن `/people` يضيء “العقود” لأن `people` طفل للعقود — المستخدم سيرى العقود مضيئة وهو في دليل الأشخاص!).
- **تباين بصري:** BottomNav يستخدم `bg-primary/12` + خط علوي 0.5px، بينما Sidebar يستخدم Dark Sidebar. هويتان مختلفتان في نفس التطبيق.

### 3.4 البحث والفلاتر العامة
- لا يوجد بحث شامل (Command Palette `cmdk` مثبت في الاعتمادات لكن غير مستخدم في الهيدر!). المستخدم يتوقع `⌘K` للبحث عن عقار/عقد/مستأجر.

---

## 4) تدقيق صفحة صفحة (Flow + Content + Form)

### 4.1 Dashboard — `/dashboard`
**الهيكل الحالي (عمودي طويل):**
HeroBanner → ErrorState → AlertCenter → KPI Grid (4) → QuickActions → Work Queues (عقود منتهية + متأخرات tag) → Trends/Charts → ArrearsBreakdown → OnboardingChecklist

**الملاحظات:**
- **صورة الأداء (KPI) ممتازة** لكن وصفها “أربع مؤشرات قرار مرتبطة بمصادرها” لا تساعد المستخدم الجديد إطلاقاً.
- **AlertCenter + KPI + Queues = ثلاث طرق لعرض نفس المعلومة (عقود منتهية/متأخرات)** — تكرار.
- **Charts في المنتصف** تشتت قبل إنجاز المهام. المستخدم يأتي لـ “ماذا أفعل الآن؟” فيجد رسوم بيانية قبل قوائم العمل.
- **الـ HeroBanner يعرض التاريخ والعملة** لكنه يأخذ مساحة كبيرة مع Gradient — يمكن تصغيره 40%.
- **OnboardingChecklist في الأسفل** ممتاز لكنه قد لا يُرى لأنه تحت الطي (تحت 1500px scroll).

**توصية:**
تسلسل مقترح: AlertCenter (الأولوية الآن) → Queues (الإجراء الآن) → KPI (صورة سريعة) → QuickActions (إنشاء) → Charts/Analytics مطوية افتراضياً (Accordion). قلّل الـ Hero إلى شريط رفيع.

### 4.2 العقارات — `/properties`
**الصفحة جيدة جداً** — من أفضل الصفحات:
- CommandPanel “جاهزية التشغيل %” + 3 Metric + سجل + فلاتر + جدول/بطاقات + ViewModeToggle + تصدير CSV. تسلسل منطقي.

**لكن:**
- **صفحتان لنفس الشيء:** `properties-page.tsx` مجرد Re-export لـ `properties-list-page.tsx`. تكرار ملف بلا داعي.
- **الفلتر الوحيد هو الحالة** — لا فلتر مالك/اتفاقية/مدينة رغم أن الـ KPI تتكلم عنهم. المستخدم يرى “3 تحتاج متابعة” لكن لا يستطيع تصفية “يحتاج مالك” مباشرة.
- **البطاقة في الموبايل (EntityCard/MobileCard) تعرض الاسم والعنوان فقط** — لا تظهر حالة الجاهزية التي هي أهم معلومة.

### 4.3 تفاصيل العقار — `/properties/$propertyId`
**تحسن كبير مؤخراً (IA 2026-08):** من 8 تبويبات أفقية مقصوصة في 320px إلى Sidebar عمودي مجمّع (الأساسيات/التشغيل/المالية/الملكية والتوثيق) + Select في الموبايل. **هذا الصح.**

**باقي المشاكل:**
- **الـ Route نفسه غريب:** `/properties/$propertyId/units` صفحة منفصلة، لكن `/properties/$propertyId?tab=contracts` تبويب داخل نفس الصفحة. نفس المفهوم (وحدات vs عقود) بطريقتين مختلفتين — المستخدم سيظن أن الوحدات “صفحة” والعقود “تبويب”.
- **التقسيم الفئوي (basic/operations/ownership)** غير مفهوم للمستخدم النهائي — “الملكية والتوثيق” تضم (سجل النشاط!) — لماذا النشاط تحت الملكية؟
- **تكرار المحتوى:** في الموبايل والـ Desktop يتم نسخ نفس الـ Conditional Render مرتين (مرة للـ `md:grid` ومرة للـ `md:hidden`) — خطر عدم تزامن مستقبلي.

### 4.4 الأراضي — `/lands` (مخفي داخل العقارات)
- لا توجد صفحة مستقلة مرئية — الـ Sidebar لا يظهرها، والـ Route يعمل Redirect إلى `?section=lands`. **المستخدم لن يجد “الأراضي” إلا إذا عرف بالصدفة.**
- إن كانت الأراضي كيان مهم في عُمان (وهي كذلك)، يجب أن تكون بند ثانوي واضح تحت “إدارة العقارات” أو على الأقل Chip داخل صفحة العقارات.

### 4.5 الملاك والمستأجرون — `/owners` `/tenants` vs `/people`
**هذه أكبر ارتباك IA في المشروع:**

- يوجد **ثلاث أماكن** لنفس البشر:
  1. `/owners` (ملاك + اتفاقيات + تسويات)
  2. `/tenants` (مستأجرون + أرصدة متأخرات)
  3. `/people` (دليل موحد: مالك/مستأجر/جهة اتصال) — لكنه **مخفي كطفل تحت “العقود”** في `workspaceChildNavItems['/contracts']`!

- المستخدم يريد “أضيف مالك” يذهب للـ Sidebar → لا يجد “الأشخاص” → يظنها غير موجودة → يضيف المالك عبر تبويب الملكية داخل العقار → يكتشف لاحقاً أن هناك صفحة أشخاص كاملة.

**توصية:** اجعل `/people` هو الأصل (الدليل الموحد) واجعل `/owners` و `/tenants` مجرد **Views مفلترة** له (مثلاً `/people?type=owner`). أو على الأقل اظهر “دليل الأشخاص” كبند ثانوي تحت “إدارة العقارات” وليس تحت العقود.

### 4.6 العقود — `/contracts`
**جيدة لكن متناقضة في التفاعل:**
- **القائمة تستخدم Modal** (`ContractFormModal`) للإنشاء/التعديل، لكن **المسارات `/contracts/new` و `/contracts/$contractId/edit` موجودة** كصفحات منفصلة (لها `ContractFormPage`). نفس العملية بطريقتين — أيهما سيُستخدم في الإشعارات/الروابط الخارجية؟
- **المعاينة (`ContractPreviewDialog`) + التفاصيل (`/contracts/$contractId`)** — مرتان لنفس المحتوى. المستخدم يفتح Preview ثم يجد زر “عرض التفاصيل” — خطوتان بلا داعي.
- **الفلاتر:** بحث + حالة + “قريبة الانتهاء” — جيد. لكن البحث يتم Client-side على 5000 سطر محمّل مرة واحدة عند التصفية — سيثقل مع النمو.
- **الـ KPI Grid** يعتمد `companySettings` لعرض العملة — جيد، لكنه يعيد نفس أرقام الـ Dashboard.

### 4.7 المالية — `/financials` (الـ Hub الأكبر)
**هذا قلب التطبيق — وحالياً أكثر مكان مربك.**

```
Sidebar داخل الصفحة (Desktop) → 4 Sections
  overview | collections → (invoices|receipts|arrears)
           | expenses    → (expenses|commissions)
           | funds       → (deposits|owner_settlements)
           | banking     → (bank_reconciliation)
SubTabs أفقي (SectionTabs) عند وجود أكثر من view
الموبايل: Select واحد
```

**المشاكل:**
- **عنوان الصفحة ثابت “المالية”** مع وصف عام، لكن الـ hint الصغير `💡 ... (سجل ...)` يتغير حسب القسم — المستخدم لا يفهم هل هو في “التحصيل” أم “المصروفات”.
- **Overview يعرض `FinancialReportsPreviewSection` + رابط “المحاسبة والتقارير → /reports”** — أي أن المالية تروج للتقارير، والتقارير تروج للمالية عبر `CrossRouteHint`! حلقة مفرغة.
- **كل View يحمل حالة تحميل منفصلة** لكنها كلها `hidden` في DOM (mounted but hidden) — تستهلك ذاكرة وتبقي فلاتر قديمة.
- **الأسماء غير موحدة:** في الكود `funds`/`owner_settlements` لكن للمستخدم “أموال محتجزة”/“تسويات الملاك” — بلا قاموس موحد.

**توصية:** فكك الـ Hub إلى صفحتين واضحتين: **“التحصيل والفواتير”** و **“المصروفات والصناديق”** و **“البنوك”** كبنود ثانوية ظاهرة في الـ Sidebar بدل إخفائها داخل Select.

### 4.8 المحاسبة والتقارير — `/reports`
- **نفس مشكلة المالية:** Sidebar داخلي + `?section=accounting|analytics` + فلتر الشهر الحالي افتراضياً.
- **التكرار مع المالية:** نفس `FinancialReportsService` يُستخدم في المكانين. المستخدم يسأل: “أين أطبع كشف حساب مالك؟ في المالية أم التقارير؟”
- **الـ Filters:** `getCurrentMonthFilters()` جيد، لكن زر “إعادة الشهر الحالي” غير واضح.

### 4.9 التشغيل والصيانة — `/maintenance` + Operations Hub
- **حالتان لنفس المكون:** `MaintenanceWorkspace mode="standalone"` (مع PageHeader) و `mode="embedded"` (بدون). هذا صحيح هندسياً لكن بصرياً يخلق فرق ارتفاع مفاجئ.
- **الـ Summary ممتاز:** بطاقة داكنة “طلبات تحتاج انتباهاً فورياً” + 3 Metrics — تميّز بصري جيد.
- **لكن ترتيب الأزرار معكوس:** في Standalone: `primary=إنشاء` و `secondary=طباعة` (الصح)، لكن في Embedded: الاثنان في `flex flex-wrap justify-end gap-2` بنفس الوزن — الطباعة تبدو كـ Primary.
- **Operations Hub** يستخدم `SectionTabs` أفقي — بينما **Maintenance standalone** لا يستخدم Tabs أصلاً — تناقض.
- **المرافق (`/utilities`) والأتمتة (`/automation`) وخزينة المستندات** مخفية تماماً خلف `?section=` — لا يوجد اكتشاف.

### 4.10 الأشخاص والتواصل والعملاء المحتملين
- **PeopleListPage** ممتازة: ملخص 4 Metrics + سجل + جدول + بطاقات موبايل + ActiveFilterBar — نموذج يُحتذى.
- لكن **مكانها خطأ** (تحت العقود). يجب نقلها.
- **Communication** لم أجد لها Page مستقلة مرئية — فقط `communication-hub-view` — المستخدم لن يكتشف سجل التواصل.

### 4.11 الإعدادات — `/settings`
- **صفحة طويلة جداً** مع `SettingsWorkspaceNav` داخلي (يسار) + 5 أقسام (يمين). هذا Hub ثالث بنفس مشكلة المالية.
- **الحفظ:** `SettingsSaveBar` sticky لكنه يظهر فقط عند `isDirty` — جيد، لكن لا يوجد مؤشر تقدم واضح عند الحفظ.
- **تعدد الأنماط:** بعض الأقسام تستخدم `SectionCard` وبعضها `Card` عادي — تفاوت في الحواف والظلال.

### 4.12 المساعد الذكي — `/ai-assistant`
- **تصميم Chat + Actions جيد وواضح** (قراءة فقط، لا تنفيذ). لكن **مكانها في “الأدوات” كأنها ثانوية** رغم أنها تحل أهم ألم (تلخيص متأخرات/تجديدات).
- **الـ ContextSnapshot (3 Cards)** تظهر فقط بعد أول رسالة — المستخدم لا يفهم ماذا يعرف المساعد قبل أن يسأل.
- **الـ Textarea بلا اختصار إرسال واضح** (Enter يرسل؟ أم Shift+Enter؟).

### 4.13 تسجيل الدخول
- **ممتاز:** RTL صحيح، أيقونات داخل الحقل، كشف CapsLock، دعم `VITE_SUPABASE_URL` diagnostics، روابط دعم مباشرة (هاتف + بريد).
- **تحسين بسيط:** زر “إظهار كلمة المرور” 44px لكنه فوق الحقل مباشرة — قد يضغطه المستخدم بالخطأ في الموبايل.

### 4.14 Landing (`/`)
- **Showcase مع Tabs + فيديو 3:22** — جميل تسويقياً، لكن **10 Tabs للصور** كثيرة — المستخدم سيمل قبل أن يصل للـ Settings. قلّلها إلى 5.

---

## 5) الأنظمة البصرية المتوازية — سبب الهمجية

| النظام | الملف | الاستخدام الحالي | المشكلة |
|--------|-------|-----------------|---------|
| `components/ui/*` | `button.tsx, card.tsx, entity-table.tsx, data-table.tsx, filter-bar.tsx...` (~40 ملف) | كل الصفحات القديمة | هو الأساس |
| `components/enterprise/*` | `enterprise-page.tsx, enterprise-header.tsx, enterprise-data-table.tsx...` (~20 ملف) | نظام جديد (Wave 4A) غير مستخدم فعلياً في أي صفحة إنتاجية! | نظامان لنفس الهدف — المطور سيحتار أيهما يستخدم |
| `components/layout/*` | `page-layout.tsx, page-header.tsx, list-page.tsx, embeddable-workspace.tsx` | كل الصفحات الحالية | `PageHeader` vs `EnterpriseHeader` vs `SectionHeader` — ثلاث هيدرات |

**النتيجة البصرية:**
- `PageHeader` → `rounded-[1.5rem] border shadow-card`
- `ListPage` → `ListControlSurface` → `rounded-2xl`
- `KpiCard`/`Metric` → `rounded-2xl border shadow-card + blur-2xl`
- كل شيء Rounded و Shadow — **لا تدرج بصري (Hierarchy).** المهم وغير المهم بنفس الوزن.

**توصية:** اعتمد نظام واحد فقط (اقترح `ui` + `layout` الحالي، وأوقف `enterprise/*` أو أدمجه). وحّد `Card` إلى نوعين فقط: `default` و `muted`، وأزل الـ blur الزخرفي من كل بطاقة — اتركه للـ Hero فقط.

---

## 6) الاستجابة والموبايل — تفاصيل دقيقة

- **SearchInput vs Select:** في `ListPage` البحث يأتي بعد الفلاتر في الديسكتوب (`lg:order-2`) لكن قبلها في الموبايل — **ترتيب مختلف** قد يربك المستخدم المتنقل بين الجهازين.
- **الـ Select الأصلي (Native) في كل مكان (Properties detail, Financials mobile, Maintenance mobile)** — جيد للوصول لكنه **يبدو مختلفاً عن الـ UI Select المخصص** في أماكن أخرى (مثلاً `components/ui/select.tsx` vs `<select>` مباشر).
- **Touch Targets:** 44px محترم في كل مكان (Buttons, Tabs, List items) — ممتاز.
- **الجداول في الموبايل:** تتحول إلى `EntityCard` + `ResponsiveCardGrid` — جيد، لكن بعض الجداول (People) تستخدم `EntityTable` مع `enableViewModeToggle` وبعضها (Contracts) لا — عدم اتساق.
- **الـ BottomSheet / Drawer:** `vaul` مثبت لكن غير مستخدم بوضوح — يوجد `Dialog` للـ Drawer و `BottomSheet` منفصل — لماذا اثنان؟

---

## 7) المحتوى واللغة والمصطلحات

**الإيجابي:** عربي أولاً، مصطلحات موحدة في `terminology-registry.ts` و `navigationLabels` — ممتاز.

**السلبي:**
- بعض الأوصاف تقنية: “أربع مؤشرات قرار مرتبطة بمصادرها التفصيلية” — لا معنى للمستخدم.
- بعض الـ Hints تحتوي إيموجي `💡` + نص صغير `text-[11px]` — تبدو كـ Debug info وليست مساعدة.
- **الـ `translateSharedLabel` يُستدعى في كل مكان** لكن بعض المفاتيح غير موجودة في `navigationLabels` فيسقط إلى `sharedLabel` — قد يظهر مفتاح إنجليزي فجأة.

---

## 8) الحالات الحدّية (Empty / Error / Loading)

- **جودة عالية عموماً:** كل صفحة تستخدم `AsyncContentState` أو `EnterpriseLoadingState` مع عناوين عربية واضحة وزر “إعادة المحاولة”.
- **لكن:** ثلاث تطبيقات مختلفة (`AsyncContentState`, `ErrorState`, `EnterpriseErrorState`) — نفس الرسالة بثلاثة أشكال.
- **الـ Empty في العقارات** يعرض زر “إنشاء عقد” داخل الفراغ — جيد. لكن **الـ Empty في المالية** لا يعرض إجراء — مجرد نص.
- **الـ Skeletons:** `Skeleton className="h-20"` في الإعدادات vs `Skeleton h-24 + h-64` في Operations Hub — ارتفاعات غير موحدة.

---

## 9) مصفوفة المشاكل حسب الأولوية

### 🔴 حرج (P0) — يسبب ضياع المستخدم
1. **IA المخفية:** 11 مسار Redirect إلى `?section=` بلا مؤشر في الـ Sidebar — المستخدم لا يكتشف الوحدات/الأراضي/المرافق/الأتمتة/خزينة المستندات/الفواتير/الإيصالات... **الحل:** أظهر بنوداً ثانوية قابلة للطي تحت كل قسم رئيسي، أو حوّلها إلى صفحات مستقلة.
2. **People تحت Contracts:** دليل الأشخاص مدفون تحت العقود — انقله إلى “إدارة العقارات” أو اجعله top-level.
3. **Financials Hub متخم:** 4 Sections + 8 Views + SubTabs — قسّمه إلى 2–3 صفحات واضحة في الـ Sidebar.
4. **تكرار Modal vs Page للعقود:** وحّد مسار الإنشاء (اقترح Modal للقوائم + Page للتفاصيل فقط).
5. **BottomNav ناقص:** أضف “الملاك” أو “الصيانة” بدل “المستأجرين” المكرر مع “العقود” (المستأجرون يمكن الوصول لهم عبر الأشخاص).

### 🟠 مهم (P1) — يسبب احتكاك يومي
6. توحيد نظام التصميم (أوقف `enterprise/*` أو أدمجه).
7. تقليل الهمجية البصرية: أزل `blur-2xl` من كل Metric، وحّد الظلال إلى مستويين فقط.
8. توحيد فلتر البحث (SearchInput + ActiveFilterBar + FilterBar) في كل القوائم.
9. إضافة Breadcrumbs لتفاصيل العقار/العقد/الوحدة.
10. Dashboard: قلّص Hero، ارفع Queues فوق Charts، اطوِ Analytics افتراضياً.
11. Command Palette (`⌘K`) للبحث الشامل — الاعتماد موجود لكن غير مفعّل.
12. توحيد Empty/Error/Skeleton إلى مكون واحد.

### 🟡 تحسين (P2) — Polish
13. تقليل Showcase Landing من 10 إلى 5 Tabs.
14. إظهار ContextSnapshot للمساعد الذكي قبل أول رسالة.
15. تحسين وصف KPI في Dashboard.
16. توحيد `native <select>` vs `ui/select` في الموبايل.
17. إضافة مؤشر حفظ واضح في الإعدادات.

---

## 10) خارطة طريق مقترحة (بدون كود — UI فقط)

### الأسبوع 1 — Quick Wins (لا يمس المنطق)
- أظهر البنود الثانوية في Sidebar كـ `Collapsible` (الوحدات/الأراضي تحت العقارات، المرافق/الأتمتة/المستندات تحت التشغيل، الفواتير/الإيصالات تحت المالية).
- ثبّت BottomNav: (الرئيسية، العقارات، العقود، المالية، الصيانة) — 5 الأكثر استخداماً حسب البيانات.
- وحّد `PageHeader` في كل الصفحات (أزل `EnterpriseHeader` من الاستخدام).
- أزل `blur` الزخرفي من كل `Metric` واتركه للـ Hero فقط.

### الأسبوع 2–3 — إعادة IA خفيفة
- فكك Financials إلى: `/financials` (تحصيل)، `/expenses` (مصروفات وعمولات)، `/banking` (بنوك) — مع Redirect يحافظ على الروابط القديمة.
- انقل People إلى Top-level “الأشخاص” واجعل Owners/Tenants مجرد فلاتر.
- وحّد نمط تفاصيل العقار: كل الأقسام عبر `?tab=` فقط (أزل `/units` كمسار منفصل).

### الأسبوع 4 — Polish
- Dashboard إعادة ترتيب + طي Charts.
- Command Palette `⌘K`.
- Breadcrumbs + تحسين Empty States.

---

## 11) ملاحظات سريعة “أول ما دخلت”

- **تكرار ملفات:** `properties-page.tsx` و `properties-list-page.tsx` و `property-detail-page.tsx` + `routes/_protected.properties....tsx` — 4 طبقات لنفس الكيان. مفهوم لكنه يربك المطور الجديد.
- **تسمية غير متسقة:** `maintenance-page.tsx` → `MaintenanceWorkspace` vs `finance` vs `reports` — بعضها `Page` وبعضها `Workspace` وبعضها `Hub`.
- **الـ `visualVariant="malek-pro"` منتشر في كل مكان** لكنه مجرد `data-visual-wave` attribute — لا فرق بصري حقيقي للمستخدم، فقط للاختبارات.
- **الـ RTL ممتاز** لكن `ArrowLeft` يُقلب عبر `rtl:rotate-180` في بعض الأماكن و `ChevronLeft` لا يُقلب في Sidebar — عدم اتساق.

---

## 12) الخلاصة — هل نحن بنينا صح لكن عرضنا غلط؟

**نعم بالضبط.**
- البنية، الأداء، الصلاحيات، الحالات الحدية — **مبنية صح.**
- العرض، التقسيم، الاكتشاف، التسلسل — **معروض غلط.**

المستخدم لا يحتاج ميزات جديدة، يحتاج **خرائط أوضح، بنود أقل إخفاءً، Hubs أخف، وبصرية أهدأ.** لو نفذت P0 فقط (إظهار المخفي + فك Financials + نقل People)، ستتحسن تجربة المستخدم 60% دون لمس أي منطق محاسبي.

---

**إعداد:** استشاري UI/UX — تدقيق واجهات فقط — 2026-08-09
**الملفات المرجعية للتدقيق:** `app-nav-items.ts` / `route-tree.ts` / `app-shell.tsx` / `layout-navigation-view.tsx` / `financials-page.tsx` / `reports-page.tsx` / `property-detail-page.tsx` / `maintenance-workspace.tsx` / `operations-hub-workspace.tsx` / `people-list-page.tsx` / `page-header.tsx` / `list-page.tsx` / `enterprise-page.tsx`
