import type { ReportProductId } from './report-products';
import type { ReportsFilterState } from './reports-workspace-filters';

export const REPORT_SHARE_TEXT_MAX_LENGTH = 1_200;

export type ReportShareTextInput = Readonly<{
  reportLabel: string;
  summaryText?: string;
  url: string;
}>;

/** Prepare a short, manual-share message without persisting recipient data. */
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

export type ReportProductShareTarget = Readonly<{
  reportId: ReportProductId;
  /** Product target ID; omitted means the product's first target. */
  view?: string;
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

/** Build the secure, canonical product URL used by every Reports share action. */
export function buildReportProductShareUrl(
  origin: string,
  target: ReportProductShareTarget,
): string {
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

export type ReportSharePayload = Readonly<{
  shareText: string;
  url: string;
}>;

/** Product URL + prepared message, with no financial value calculation or storage. */
export function buildReportProductSharePayload(
  origin: string,
  target: ReportProductShareTarget,
  input: Readonly<{ reportLabel: string; summaryText?: string }>,
): ReportSharePayload {
  const url = buildReportProductShareUrl(origin, target);
  const shareText = buildReportShareText({ ...input, url });
  return { shareText, url };
}
