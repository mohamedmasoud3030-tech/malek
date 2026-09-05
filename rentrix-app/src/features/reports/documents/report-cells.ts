import type { ReportCellFormat } from '@/services/documents/documentPayloads';

/**
 * Canonical cell helpers shared by every professional report payload builder
 * (property, owner, premium owner). One rule set for how a report cell renders
 * an absent value, so the printed documents stay consistent with each other.
 */

/** Text cell. Blank / null text renders as `—`. */
export const text = (value: string | null | undefined): ReportCellFormat => ({ kind: 'text', value: value?.trim() || '—' });

/**
 * Money cell. An UNAVAILABLE amount renders as `—`, never as `0` — a printed
 * zero must always mean a real zero from an authoritative source.
 */
export const amount = (value: number | null | undefined): ReportCellFormat => (value != null ? { kind: 'amount', value } : text('—'));

/** Percent cell (0–100 rate). Unavailable rate renders as `—`. */
export const percentOf = (value: number | null | undefined): ReportCellFormat => (value != null ? { kind: 'percent', value } : text('—'));

/** Integer count cell rendered as plain text. Unavailable count renders as `—`. */
export const countCell = (value: number | null | undefined): ReportCellFormat => (value != null ? { kind: 'text', value: String(value) } : text('—'));

/** Date-only (YYYY-MM-DD) label from an ISO date/timestamp; missing dates render as `—`. */
export const dateLabel = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '—');
