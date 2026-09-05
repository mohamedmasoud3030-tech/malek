/**
 * Stable IDs for the public `/reports/$reportId` route.
 *
 * This route-level contract is deliberately UI-neutral so cross-product callers
 * can validate a Reports deep link without importing Reports presentation or
 * reporting authority. Rich labels, targets, filters, and renderers remain in
 * `features/reports/report-products.ts`.
 */
export const REPORT_PRODUCT_IDS = [
  'owner-comprehensive-statement',
  'tenant-statement',
  'collections-arrears-cheques',
  'portfolio-property-performance',
  'financial-settlement-pack',
] as const;

export type ReportProductId = (typeof REPORT_PRODUCT_IDS)[number];

export function isReportProductId(value: string): value is ReportProductId {
  return (REPORT_PRODUCT_IDS as readonly string[]).includes(value);
}
