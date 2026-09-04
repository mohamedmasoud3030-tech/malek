/**
 * MALEK Detail Presentation policy — one typed source of truth for how a
 * record is opened from a register.
 *
 * This is a policy registry, not a UI framework. Each entity declares:
 *
 * - `kind`: whether it has a canonical full workspace/page or is a pure
 *   transactional record.
 * - `detailRoute`: the canonical detail route when a full page exists.
 * - `fullPageLabel`: the explicit action label that navigates to that page
 *   (never a misleading «معاينة»).
 * - `previewLabel`: the explicit quick-preview action label.
 *
 * Invariants enforced by `detail-presentation.contract.test.ts`:
 * - Row/card click and the mobile card primary action open the Quick Preview.
 * - Workspace entities expose a clear «فتح الملف الكامل»-style action that
 *   navigates directly to `detailRoute`.
 * - Transactional records are preview-only unless a real workspace exists.
 * - The same semantic result holds on desktop and mobile.
 */
export type DetailPresentationKind = 'workspace' | 'record';

export type DetailPresentationPolicy = Readonly<{
  kind: DetailPresentationKind;
  detailRoute?: string;
  fullPageLabel?: string;
  previewLabel: string;
}>;

export const detailPresentationRegistry = {
  owner: {
    kind: 'workspace',
    detailRoute: '/owners/$ownerId',
    fullPageLabel: 'فتح الملف الكامل',
    previewLabel: 'معاينة سريعة',
  },
  tenant: {
    kind: 'workspace',
    detailRoute: '/tenants/$tenantId',
    fullPageLabel: 'فتح ملف المستأجر',
    previewLabel: 'معاينة سريعة',
  },
  person: {
    kind: 'workspace',
    detailRoute: '/people/$personId',
    fullPageLabel: 'فتح ملف الشخص',
    previewLabel: 'معاينة سريعة',
  },
  property: {
    kind: 'workspace',
    detailRoute: '/properties/$propertyId',
    fullPageLabel: 'فتح ملف العقار',
    previewLabel: 'معاينة سريعة',
  },
  unit: {
    kind: 'workspace',
    detailRoute: '/properties/$propertyId/units/$unitId',
    fullPageLabel: 'فتح ملف الوحدة',
    previewLabel: 'معاينة سريعة',
  },
  contract: {
    kind: 'workspace',
    detailRoute: '/contracts/$contractId',
    fullPageLabel: 'فتح العقد بالكامل',
    previewLabel: 'معاينة سريعة',
  },
  land: {
    kind: 'workspace',
    detailRoute: '/lands/$landId',
    fullPageLabel: 'فتح ملف الأرض',
    previewLabel: 'معاينة سريعة',
  },
  serviceProvider: {
    kind: 'workspace',
    detailRoute: '/service-providers/$providerId',
    fullPageLabel: 'فتح ملف مزود الخدمة',
    previewLabel: 'معاينة سريعة',
  },
  receipt: {
    kind: 'record',
    previewLabel: 'معاينة الإيصال',
  },
  invoice: {
    kind: 'record',
    previewLabel: 'معاينة الفاتورة',
  },
  utilityBill: {
    kind: 'record',
    previewLabel: 'معاينة فاتورة المرافق',
  },
  maintenance: {
    kind: 'record',
    previewLabel: 'معاينة طلب الصيانة',
  },
  document: {
    kind: 'record',
    previewLabel: 'معاينة المستند',
  },
  overdueInvoice: {
    kind: 'record',
    previewLabel: 'معاينة المتأخرات',
  },
  collectionFollowUp: {
    kind: 'record',
    previewLabel: 'معاينة متابعة التحصيل',
  },
} as const satisfies Record<string, DetailPresentationPolicy>;

export type DetailPresentationEntity = keyof typeof detailPresentationRegistry;

export function getDetailPresentation(entity: DetailPresentationEntity): DetailPresentationPolicy {
  return detailPresentationRegistry[entity];
}
