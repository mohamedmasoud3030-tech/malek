# خطة إعادة تصميم Detail Presentation Architecture — MALEK / Rentrix

- الحالة: **مقترح للمراجعة — لم يبدأ التنفيذ**
- التاريخ: 2026-09-03
- النطاق: Frontend فقط (`rentrix-app/src`) — لا تغيير Backend/DB
- المرجع القيادي: `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md` ثم `.claude/rules/frontend-ui.md`

---

## 1. القرار الجوهري

المشكلة ليست "توحيد شكل الـ 11 Dialog" بل **قرار واحد مركزي**: المنطق الوظيفي للضغط على السجل.

- **Entity = ملف/Workspace (Page)** → الضغط الأساسي يفتح الصفحة الكاملة. لو احتجنا بحق Quick Peek فهو Action ثانوي باسم صريح «معاينة سريعة».
- **Entity = سجل transactional (Quick Preview)** → الضغط الأساسي يفتح معاينة موحدة داخل `EntityPreviewDialog` مباشرة. لا صفحات منفصلة ولا inline panels.
- القرار نفسه على الموبايل والكمبيوتر؛ الاختلاف في presentation فقط.
- ممنوع نفس الكيان يفتح Dialog من مكان وصفحة من مكان آخر بدون سبب صريح.

## 2. الوضع الحالي (audit)

### 2.1 سطوح المعاينة الحالية (11 نوع فعلياً كلها على `EntityPreviewDialog`)

| # | السطح | الملف | الحالة |
|---|-------|-------|--------|
| 1 | مالك | `features/owners/components/OwnerPreviewDialog.tsx` | Dialog ثقيل (dossier كامل) |
| 2 | مستأجر | `features/tenants/components/TenantPreviewDialog.tsx` | Dialog ثقيل + نفس الملف يخدم الـ Page عبر `TenantDetailPage` |
| 3 | شخص | `features/people/components/PersonDossier.tsx` | Dialog (غير مستخدم فعلياً) + Page |
| 4 | وحدة | `features/units/components/UnitPreviewDialog.tsx` | Dialog + Page |
| 5 | أرض | `features/lands/components/LandDossier.tsx` | Dialog + Page (نفس الملف) |
| 6 | فاتورة | `features/financials/components/invoice-workspace-section.tsx` | Dialog ✅ |
| 7 | إيصال | `features/financials/components/receipt-detail-card.tsx` | **Inline panel** + `ReceiptDetailPage` (print shell) ❌ |
| 8 | فاتورة مرافق | `features/utilities/components/utility-bill-detail-overlay.tsx` | Dialog ✅ |
| 9 | طلب صيانة | `features/maintenance/components/maintenance-detail-resolve-overlays.tsx` | Dialog ✅ |
| 10 | مستند | `components/documents/contextual-documents-panel.tsx` | Dialog ✅ |
| 11 | متأخرات | `features/reports/components/overdue/overdue-invoices-panel.tsx` | Dialog ✅ |
| + | متابعة تحصيل | `features/reports/components/FollowUpSection.tsx` | Dialog ✅ |

### 2.2 التناقضات الموجودة فعلياً (الفجوة بين الشكل والمنطق)

- **المالك**: الضغط على الصف يفتح `OwnerPreviewDialog` (ملف ثقيل داخل Popup). الصفحة الكاملة `/owners/$ownerId` موجودة لكن **غير قابلة للوصول من سجل الملاك أصلاً** (لا يوجد action «فتح الملف الكامل»).
- **المستأجر**: الضغط الأساسي Dialog، والتفاصيل الكاملة Action ثانوي — عكس القاعدة المطلوبة.
- **الوحدة**: نفس التناقض — الضغط الأساسي Dialog، والتفاصيل الكاملة ثانوي.
- **الأرض**: الصف يفتح الصفحة ✅، لكن route `/lands/$landId` في وضع Dialog يُظهر القائمة + Dialog (مزيج).
- **العقد**: الصف و«معاينة» يفتحان `ContractDetailPage` ✅ لكن التسمية «معاينة» مضللة (يجب «فتح الملف»).
- **الشخص / مزود الخدمة / العقار**: page-first بالفعل ✅.
- **الإيصال**: يوضع في `ReceiptDetailCard` inline أو يُرمى المستخدم في `ReceiptDetailPage` لمجرد العرض — يجب أن يكون `ReceiptPreviewDialog` موحداً. (هو بالضبط المثال الذي رصدته.)

## 3. التقسيم المستهدف

### Page (ملف/Workspace) — 7 كيانات

| الكيان | المسار الكانوني | الحالة الحالية | المطلوب |
|--------|-----------------|----------------|---------|
| المالك | `/owners/$ownerId` | موجود، غير مربوط بالسجل | ربط السجل بالصفحة كإجراء أساسي |
| المستأجر/الشخص | `/tenants/$tenantId`, `/people/$personId` | موجود | جعل الصفحة هي الأساس |
| العقار | `/properties/$propertyId` | موجود ✅ | لا تغيير |
| الوحدة | `/properties/$propertyId/units/$unitId` | موجود | جعل الصفحة هي الأساس |
| العقد | `/contracts/$contractId` | موجود ✅ | إعادة تسمية action فقط |
| مزود الخدمة | `/service-providers/$providerId` | موجود ✅ | لا تغيير |
| الأرض | `/lands/$landId` | موجود ✅ | إزالة وضع الـ Dialog من الـ primary |

### Quick Preview (Dialog) — 7 كيانات

| الكيان | الملف المقترح | الوضع الحالي | المطلوب |
|--------|---------------|--------------|---------|
| إيصال | `features/financials/receipts/ReceiptPreviewDialog.tsx` | Inline + Page | **Dialog موحد** (يحل مكان الاثنين في سياق العرض) |
| فاتورة | موجود (invoice-workspace-section) | Dialog ✅ | توحيد التسمية/الأفعال |
| فاتورة مرافق | موجود (utility-bill-detail-overlay) | Dialog ✅ | توحيد التسمية فقط |
| طلب صيانة | موجود (maintenance-detail-resolve-overlays) | Dialog ✅ | توحيد التسمية فقط |
| مستند | موجود (contextual-documents-panel) | Dialog ✅ | لا تغيير منطقي |
| متأخرات | موجود (overdue-invoices-panel) | Dialog ✅ | لا تغيير منطقي |
| متابعة تحصيل | موجود (FollowUpSection) | Dialog ✅ | لا تغيير منطقي |

أفعال مناسبة داخل `ReceiptPreviewDialog`: المبلغ، التاريخ، طريقة الدفع، المرجع، الفاتورة المرتبطة، المستأجر، العقار/الوحدة، الحالة، السياق + **طباعة A4، تنزيل PDF، نسخ الرقم، طلب إلغاء** (حسب الصلاحية).

## 4. خطوات التنفيذ

### Phase 0 — Registry واحد للقرار (قبل أي تعديل UI)
- ملف جديد: `rentrix-app/src/features/detail-presentation/detail-presentation-registry.ts`
  - يصرّح لكل كيان: `presentation: 'page' | 'quick-preview'` + المسار الكانوني + تسمية الإجراء الافتراضية («فتح الملف» / «معاينة سريعة»).
- `DetailPresentationActions` مشترك (desktop ActionMenu + mobile card primary action) يقرأ من الـ registry بدل أن كل صفحة تقرر بنفسها.
- Contract test جديد: `detail-presentation-registry.test.ts` يفرض:
  - كل كيان page له route في `route-tree` وزراعه الأساسية تـ navigate إليه.
  - كل كيان quick-preview يستخدم `<EntityPreviewDialog>` ولا يعرض inline panel/page كسلوك افتراضي.
  - لا يوجد كيان مزدوج (Dialog في مكان + Page في آخر) بدون مسار صريح ثانوي.

### Phase 1 — Heavy entities إلى Pages
1. **المالك** (`owner-workspace-table.tsx`):
   - `onRowClick` + mobile primary action → `navigate('/owners/$ownerId')`.
   - ActionMenu: «فتح الملف» أساسي → صفحة؛ «معاينة سريعة» ثانوي → `OwnerPreviewDialog` (لو أبقيناها).
2. **المستأجر** (`TenantsPage.tsx`):
   - `onRowClick` + mobile primary → `/tenants/$tenantId`؛ «معاينة سريعة» ثانوي يبقي `TenantPreviewDialog`.
3. **الوحدة** (`units-page.tsx`):
   - `onRowClick` + mobile primary → `/properties/$propertyId/units/$unitId` (الـ row يحمل property_id)؛ «معاينة سريعة» ثانوي يبقي `UnitPreviewDialog`.
4. **العقد** (`ContractTable.tsx`): إعادة تسمية action «معاينة» → «فتح الملف». السلوك page-first بالفعل.
5. **الشخص / الأرض**:
   - حذف `PersonPreviewDialog` (غير مستخدم) أو إبقاؤه Action ثانوي صريح في الأشخاص.
   - `LandDetailRouteComponent`: الـ primary يبقى `LandDetailPage`؛ يبقى وضع الـ Dialog فقط لـ «معاينة سريعة» صريح (background mode)، ولا يفتح من الصف إلا عبر action ثانوي.
6. **مزود الخدمة/العقار**: لا تغيير (تحقق فقط من تسميات الإجراءات).

### Phase 2 — Light entities إلى Quick Previews (الإيصال أولاً)
1. إنشاء `ReceiptPreviewDialog` فوق `EntityPreviewDialog` مع البنية التالية:
   - Header: رقم الإيصال + الحالة.
   - Body: المبالغ/التاريخ/الطريقة/المرجع/الفاتورة/المستأجر/العقار/السياق (من `ReceiptRecord` الموجود، بدون جلب مكرر).
   - Actions: طباعة A4 (يحتفظ بـ `openReceiptPrintTab`)، تنزيل PDF، نسخ الرقم، طلب إلغاء (إن كانت الصلاحية موجودة).
2. `receipts-page.tsx`:
   - حذف `ReceiptDetailCard` inline و`selectedReceiptId` side-panel.
   - `onRowClick` + mobile primary → فتح `ReceiptPreviewDialog`.
3. مسار `/receipts?receiptId=`:
   - يبقى **print-only** لهدف الطباعة (اختبارات `route-blank-state`, `legacy-compatibility`, `phase5-financials` محفوظة).
   - فتح الإيصال من Command Palette/الـ financials ينتقل إلى `section=collections&view=receipts&receiptId=` ويفتح المعاينة من داخل الـ controller بدلاً من رمي المستخدم في صفحة الطباعة.
4. توحيد تسميات بقية المعاينات الخفيفة («معاينة سريعة — فاتورة»، إلخ) بدون تغيير سلوكها.

### Phase 3 — توازي الموبايل/الكمبيوتر
- تعديل `EntityTable` mobile actions لتقرأ من الـ registry: primary action = نفس المنطق الوظيفي للصف.
- إزالة أي action «عرض» مكرر يفتح Dialog على الموبايل بينما يفتح صفحة على الديسكتوب.

### Phase 4 — الاختبارات والوثائق
- تحديث (عكس المتوقع):
  - `components/ui/detail-preview-contract.test.ts`
  - `features/detail-workspace-consistency.test.ts`
  - `app/router/phase3-route-dialog.test.ts` , `phase3-1-hardening.test.ts`
  - `features/p6-detail-dossiers.test.ts` , `p6b-...` , `p6c-...`
  - `features/owners/owners-page-interaction.test.tsx`
  - `features/units/units-page-interaction.test.tsx`
  - `features/financials/receipts/receipts-page.test.tsx` + `receipt-detail-print-readiness.test.tsx` (المسار print-only يظل ناجحاً)
- إضافة: `detail-presentation-registry.test.ts` + اختبار `ReceiptPreviewDialog` (المحتوى + الإجراءات).
- تحديث `docs/decisions` بعد الموافقة (ADR جديد برقم تالٍ).

## 5. ما لن أفعله
- لن أعيد تصميم ألوان/أيقونات/شكل الـ Dialog كهدف أول — القرار المنطقي أولاً، ثم ننهّي السطح الموحد للـ 7 أنواع فقط.
- لن أضيف صفحة مكررة أو Dialog مكرر لأي كيان.
- لن أجعل الفواتير/الإيصالات/الصيانة/المرافق صفحات إلا إذا كان مصطلح "ملف/Workspace" ينطبق فعلياً (لا ينطبق).
- لن أغير المنطق المالي أو الـ Backend.

## 6. نقاط تحتاج قرارك
1. **الـ Quick Peek للكيانات الثقيلة**: أبقيه Action ثانوي باسم «معاينة سريعة» (اقتراحي: للمالك/المستأجر/الوحدة)، أم page-only تماماً (أبسط وأقل صيانة)؟
2. **الإيصال والطباعة**: أبقى `/receipts?receiptId=` كـ print-only (اقتراحي: نعم، للحفاظ على الاختبارات ولينكات الطباعة القديمة) أم ننقل الطباعة لمسار جديد مخصص؟
3. **متى نبدأ التنفيذ**: بعد موافقتك على الجدول أعلاه أنفذ Phase 1 ثم 2 بالتتابع مع تشغيل `npm test` و`npm run typecheck` و`npm run check:architecture`.
