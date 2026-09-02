/**
 * Report share payload builders — P4 Intelligence & Communication.
 *
 * Sharing always points back to the same canonical report view inside MALEK
 * (deep link with section/view/period/scope) and optionally includes a short
 * business-language summary. It never fabricates a separate calculation: the
 * recipient opens the same read model the operator sees.
 *
 * Pure functions only; the caller decides when to open WhatsApp or the
 * system share sheet. No recipient identity, no financial detail is stored or
 * logged here.
 */

import type { ReportProductId } from './report-products';
import type { ReportSectionId } from './reports-page.sections';
import type { ReportViewId } from './report-view-registry';
import type { ReportsFilterState } from './reports-workspace-filters';

export const REPORT_SHARE_TEXT_MAX_LENGTH = 1_200;

export type ReportShareTarget = Readonly<{
  section: ReportSectionId;
  view: ReportViewId;
  filters: Pick<
    ReportsFilterState,
    | 'from'
    | 'to'
    | 'asOf'
    | 'propertyId'
    | 'unitId'
    | 'tenantId'
    | 'ownerId'
    | 'contractId'
  >;
}>;

/** Build the canonical in-app deep link for a report view. */
export function buildReportShareUrl(origin: string, target: ReportShareTarget): string {
  const params = new URLSearchParams();
  params.set('section', target.section);
  if (target.view) params.set('view', target.view);
  if (target.filters.from) params.set('from', target.filters.from);
  if (target.filters.to) params.set('to', target.filters.to);
  if (target.filters.asOf) params.set('asOf', target.filters.asOf);
  for (const key of [
    'propertyId',
    'unitId',
    'tenantId',
    'ownerId',
    'contractId',
  ] as const) {
    const value = target.filters[key];
    if (value) params.set(key, value);
  }
  return `${origin.replace(/\/+$/, '')}/reports?${params.toString()}`;
}

export type ReportShareTextInput = Readonly<{
  reportLabel: string;
  summaryText?: string;
  url: string;
}>;

/**
 * Build the message prepared for WhatsApp / the system share sheet.
 * One plain line per fact, URLs last, capped at the share limit.
 */
export function buildReportShareText(input: ReportShareTextInput): string {
  const lines = [input.reportLabel.trim()];
  const summary = input.summaryText?.trim();
  if (summary) lines.push(summary);
  lines.push(input.url.trim());
  const text = lines.filter(Boolean).join('\n');
  return text.length > REPORT_SHARE_TEXT_MAX_LENGTH
    ? text.slice(0, REPORT_SHARE_TEXT_MAX_LENGTH)
    : text;
}

export type ReportSharePayload = Readonly<{
  shareText: string;
  url: string;
}>;

/** Convenience: one call builds the URL and the prepared share message. */
export function buildReportSharePayload(
  origin: string,
  target: ReportShareTarget,
  input: Readonly<{ reportLabel: string; summaryText?: string }>,
): ReportSharePayload {
  const url = buildReportShareUrl(origin, target);
  const shareText = buildReportShareText({ ...input, url });
  return { shareText, url };
}

/* ------------------------------------------------------------------ */
/* Premium report-product sharing                                      */
/* ------------------------------------------------------------------ */

export type ReportProductShareTarget = Readonly<{
  reportId: ReportProductId;
  /** Product sub-view/target id; omitted means the product's default target. */
  view?: string;
  filters: ReportShareTarget['filters'];
}>;

/**
 * Build the canonical premium-product deep link (`/reports/<id>?…`). The
 * target route applies the same permission gate as the app shell, so the
 * link is secure by construction: recipients must sign in with
 * `financial.reports.view` to open the report — nothing is exposed by the
 * link itself.
 */
export function buildReportProductShareUrl(origin: string, target: ReportProductShareTarget): string {
  const params = new URLSearchParams();
  if (target.view) params.set('view', target.view);
  if (target.filters.from) params.set('from', target.filters.from);
  if (target.filters.to) params.set('to', target.filters.to);
  if (target.filters.asOf) params.set('asOf', target.filters.asOf);
  for (const key of [
    'propertyId',
    'unitId',
    'tenantId',
    'ownerId',
    'contractId',
  ] as const) {
    const value = target.filters[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${origin.replace(/\/+$/, '')}/reports/${encodeURIComponent(target.reportId)}${query ? `?${query}` : ''}`;
}

/** Premium convenience builder: product URL + prepared share message. */
export function buildReportProductSharePayload(
  origin: string,
  target: ReportProductShareTarget,
  input: Readonly<{ reportLabel: string; summaryText?: string }>,
): ReportSharePayload {
  const url = buildReportProductShareUrl(origin, target);
  const shareText = buildReportShareText({ ...input, url });
  return { shareText, url };
}
