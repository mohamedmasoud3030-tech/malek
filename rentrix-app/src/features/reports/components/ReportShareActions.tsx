import type { CsvRow } from '@/lib/csvExport';
import { buildReportSharePayload, type ReportShareTarget } from '../report-share';
import { ReportDocumentActions } from './report-document-actions';

type ReportShareActionsProps = Readonly<{
  /** Business name of the open report (e.g. "تعتيق المتأخرات"). */
  reportLabel: string;
  target: ReportShareTarget;
  /** Optional one-line business-language summary for the prepared message. */
  summaryText?: string;
  /** Optional recipient phone for the WhatsApp composer (manual send). */
  phone?: string;
  onPrint?: () => Promise<void> | void;
  onDownloadPdf?: () => Promise<void> | void;
  csv?: { filename: string; rows: CsvRow[] };
  className?: string;
}>;

/**
 * Canonical report action group — P4 communication.
 *
 * This is a compatibility shell over the ONE shared implementation
 * (`ReportDocumentActions`) so no report keeps its own competing print /
 * PDF / Excel / WhatsApp / share button logic. Every action here prepares
 * something real and lets the human finish it:
 *   - WhatsApp: label/summary/deep-link in the system composer, sent manually.
 *   - Share: OS share sheet, falling back to copying the canonical report link.
 *   - Print / PDF / Excel / CSV: the canonical document/export boundaries.
 *
 * All actions require `canExportReports` at the call site; this component
 * never mutates financial data and never sends anything automatically.
 */
export function ReportShareActions({
  reportLabel,
  target,
  summaryText,
  phone,
  onPrint,
  onDownloadPdf,
  csv,
  className,
}: ReportShareActionsProps) {
  const payload = buildReportSharePayload(
    typeof window !== 'undefined' ? window.location.origin : '',
    target,
    { reportLabel, summaryText },
  );

  return (
    <ReportDocumentActions
      reportLabel={reportLabel}
      onPrint={onPrint}
      onDownloadPdf={onDownloadPdf}
      csv={csv}
      phone={phone}
      share={{ title: reportLabel, text: payload.shareText, url: payload.url }}
      className={className}
    />
  );
}
