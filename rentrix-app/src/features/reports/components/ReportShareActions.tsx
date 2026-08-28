import { Download, FileSpreadsheet, FileText, MessageCircle, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { CsvRow } from '@/lib/csvExport';
import { csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv } from '@/lib/tabular-export';
import { openWhatsAppComposer } from '@/lib/whatsapp-share';
import { buildReportSharePayload, type ReportShareTarget } from '../report-share';
import { downloadCsv } from '../reports-page.helpers';

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
 * Every action here prepares something and lets the human finish it:
 *   - WhatsApp: prepares label/summary/deep-link and opens WhatsApp so the
 *     user chooses the recipient and presses send manually (no Business API).
 *   - Share: uses the OS share sheet when available, otherwise copies the
 *     canonical report link to the clipboard.
 *   - Print / PDF / Excel / CSV: canonical document/export boundaries.
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

  const handleWhatsApp = () => {
    const outcome = openWhatsAppComposer({
      phone,
      text: payload.shareText,
      webComposer: false,
    });
    if (!outcome.result.ok) {
      const messages = {
        TEXT_REQUIRED: 'لا يوجد نص لإرساله.',
        TEXT_TOO_LONG: 'نص المشاركة أطول من الحد المسموح.',
        PHONE_INVALID: 'رقم واتساب غير صالح.',
      } as const;
      toast.error(messages[outcome.result.reason]);
      return;
    }
    if (!outcome.opened) {
      toast.error('تعذر فتح واتساب. سُمح للمتصفح بفتح نافذة جديدة ثم أعد المحاولة.');
      return;
    }
    toast.success('تم فتح واتساب لإرسال الرسالة يدويًا.');
  };

  const handleShare = async () => {
    const sharePayload = {
      title: reportLabel,
      text: payload.shareText,
      url: payload.url,
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(sharePayload);
        return;
      } catch {
        // User cancelled the share sheet — keep the chance to copy the link.
      }
    }
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(payload.url);
        toast.success('تم نسخ رابط التقرير.');
        return;
      } catch {
        // Fall through to a neutral failure message.
      }
    }
    toast.error('المشاركة غير مدعومة هنا. انسخ الرابط من شريط العنوان.');
  };

  const handleExcel = () => {
    if (!csv || csv.rows.length === 0) return;
    try {
      downloadBlob(
        csvRowsToXlsxBlob(csv.rows, reportLabel),
        xlsxFilenameFromCsv(csv.filename),
      );
      toast.success('تم تجهيز ملف Excel');
    } catch (error) {
      console.error('Failed to export report XLSX:', error);
      toast.error('تعذر تصدير ملف Excel');
    }
  };

  return (
    <div className={className} data-report-share-actions>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5 text-xs"
        onClick={handleWhatsApp}
      >
        <MessageCircle className="size-3.5" aria-hidden="true" />
        واتساب
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5 text-xs"
        onClick={() => void handleShare()}
      >
        <Share2 className="size-3.5" aria-hidden="true" />
        مشاركة
      </Button>
      {onPrint ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5 text-xs"
          onClick={() => void onPrint()}
        >
          <Printer className="size-3.5" aria-hidden="true" />
          طباعة A4
        </Button>
      ) : null}
      {onDownloadPdf ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5 text-xs"
          onClick={() => void onDownloadPdf()}
        >
          <Download className="size-3.5" aria-hidden="true" />
          PDF
        </Button>
      ) : null}
      {csv ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 gap-1.5 text-xs"
            onClick={handleExcel}
            disabled={csv.rows.length === 0}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            Excel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 gap-1.5 text-xs"
            onClick={() => downloadCsv(csv.filename, csv.rows)}
            disabled={csv.rows.length === 0}
          >
            <FileText className="size-3.5" aria-hidden="true" />
            CSV
          </Button>
        </>
      ) : null}
    </div>
  );
}
