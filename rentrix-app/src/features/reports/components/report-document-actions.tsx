import { Download, FileSpreadsheet, FileText, MessageCircle, Printer, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import type { CsvRow } from '@/lib/csvExport';
import { csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv } from '@/lib/tabular-export';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import { openWhatsAppComposer } from '@/lib/whatsapp-share';
import { documentActionErrorMessage } from '@/services/documents/runDocumentAction';
import { downloadCsv } from '../reports-page.helpers';

export type ReportDocumentShareInput = Readonly<{
  /** Canonical deep link back into the same report (authenticated route). */
  url: string;
  /** Prepared business-language message for share sheets that take text. */
  text: string;
  title: string;
  /**
   * Builds the exact generated PDF document for attachment sharing when the
   * browser supports `navigator.canShare({ files })`. When it is absent or
   * unsupported, the action falls back truthfully (link copy / download) —
   * it never shares a placeholder.
   */
  buildFile?: () => Promise<File>;
}>;

type ReportDocumentActionsProps = Readonly<{
  reportLabel: string;
  /** `full` = every supported action visible; `compact` = download + menu. */
  layout?: 'full' | 'compact';
  primaryDownloadLabel?: string;
  menuLabel?: string;
  onPrint?: () => void | Promise<void>;
  onDownloadPdf?: () => void | Promise<void>;
  /** Pre-built tabular export handler (statement panels) or raw rows. */
  onDownloadExcel?: () => void;
  excelRows?: Readonly<{
    headers: readonly string[];
    rows: readonly (readonly (string | number)[])[];
    filename: string;
  }>;
  csv?: Readonly<{ filename: string; rows: CsvRow[] }>;
  share?: ReportDocumentShareInput;
  /** Optional recipient phone for the manual WhatsApp composer. */
  phone?: string;
  /** Explicitly enable/disable the manual WhatsApp composer (default: on when `share` exists). */
  whatsapp?: boolean;
  disabled?: boolean;
  className?: string;
}>;

const WHATSAPP_MESSAGES = {
  TEXT_REQUIRED: 'لا يوجد نص لإرساله.',
  TEXT_TOO_LONG: 'نص المشاركة أطول من الحد المسموح.',
  PHONE_INVALID: 'رقم واتساب غير صالح.',
} as const;

/** True when the browser can attach files to the OS share sheet. */
export function canSharePdfFile(file: File): boolean {
  const navigatorRef = typeof navigator !== 'undefined' ? navigator : undefined;
  return typeof navigatorRef?.share === 'function'
    && typeof navigatorRef.canShare === 'function'
    && navigatorRef.canShare({ files: [file] });
}

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  // Revoking in the same tick races Chrome's download-start handling (the
  // saved file can lose its name entirely) — keep the blob alive briefly.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * The ONE shared report action component (preview/print/PDF/Excel/share).
 *
 * Rules this component enforces so every report product behaves identically:
 *  - an action is rendered only when it has a real handler or real data —
 *    never a decorative button that shows a toast instead of doing the work;
 *  - sharing attaches the genuinely generated PDF when the browser can
 *    accept files, and falls back truthfully (secure link copy, then
 *    download, then print) when it cannot;
 *  - failures surface only the document platform's user-safe Arabic
 *    messages, never raw errors.
 *
 * Legacy surfaces (`ReportShareActions`, `ReportOutputActions`) mount this
 * component too, so there is no competing action implementation in Reports.
 */
export function ReportDocumentActions({
  reportLabel,
  layout = 'full',
  primaryDownloadLabel = 'تنزيل PDF',
  menuLabel = 'مزيد من إجراءات الإخراج',
  onPrint,
  onDownloadPdf,
  onDownloadExcel,
  excelRows,
  csv,
  share,
  phone,
  whatsapp,
  disabled = false,
  className,
}: ReportDocumentActionsProps) {
  const [busy, setBusy] = useState(false);
  const showWhatsApp = share !== undefined && whatsapp !== false;

  const excelDisabled = disabled
    || (!onDownloadExcel && !(excelRows && excelRows.rows.length > 0));

  const handleExcel = () => {
    if (onDownloadExcel) {
      onDownloadExcel();
      return;
    }
    if (!excelRows || excelRows.rows.length === 0) return;
    try {
      downloadBlob(
        buildXlsxBlob({ name: reportLabel, headers: excelRows.headers, rows: excelRows.rows, rightToLeft: true }),
        excelRows.filename,
      );
    } catch (error) {
      console.error('Failed to export report XLSX:', error);
      toast.error('تعذر تصدير ملف Excel');
    }
  };

  const handleExcelFromCsv = () => {
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

  const handleWhatsApp = () => {
    if (!share || !showWhatsApp) return;
    const outcome = openWhatsAppComposer({
      phone,
      text: share.text,
      webComposer: false,
    });
    if (!outcome.result.ok) {
      toast.error(WHATSAPP_MESSAGES[outcome.result.reason]);
      return;
    }
    if (!outcome.opened) {
      toast.error('تعذر فتح واتساب. سُمح للمتصفح بفتح نافذة جديدة ثم أعد المحاولة.');
      return;
    }
    toast.success('تم فتح واتساب لإرسال الرسالة يدويًا.');
  };

  const handleShare = async () => {
    if (!share) return;
    // Preferred truthful path: share the actual generated PDF document.
    if (share.buildFile) {
      setBusy(true);
      try {
        const file = await share.buildFile();
        if (canSharePdfFile(file)) {
          try {
            await navigator.share({ files: [file], title: share.title });
            return;
          } catch {
            // User cancelled the share sheet — fall through to the link copy.
          }
        }
        if (await copyText(share.url)) {
          downloadFile(file);
          toast.success('شارك هذا المتصفح لا يرفق الملفات مباشرة — نزّلنا لك PDF جاهز للإرفاق، ونسخنا الرابط الآمن للتقرير.');
          return;
        }
        downloadFile(file);
        toast.success('نزّلنا لك ملف PDF جاهزًا للمشاركة؛ هذا المتصفح لا يدعم إرفاق الملفات أو نسخ الرابط.');
      } catch (error) {
        if (await copyText(share.url)) {
          toast.success('تعذر تجهيز PDF للمشاركة المباشرة — تم نسخ الرابط الآمن للتقرير بدلًا منه.');
          return;
        }
        toast.error(documentActionErrorMessage(error, 'تعذرت مشاركة التقرير في هذا المتصفح. انسخ الرابط من شريط العنوان.'));
      } finally {
        setBusy(false);
      }
      return;
    }
    // Link/text sharing for environments without a document attachment.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: share.title, text: share.text, url: share.url });
        return;
      } catch {
        // User cancelled the share sheet — keep the chance to copy the link.
      }
    }
    if (await copyText(share.url)) {
      toast.success('تم نسخ رابط التقرير.');
      return;
    }
    toast.error('المشاركة غير مدعومة هنا. انسخ الرابط من شريط العنوان.');
  };

  const buttonClass = 'min-h-11 gap-1.5 text-xs';

  const shareButton = share ? (
    <Button
      key="share"
      type="button"
      variant="outline"
      size="sm"
      className={buttonClass}
      onClick={() => void handleShare()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      <Share2 className="size-3.5" aria-hidden="true" />
      {busy ? 'جارٍ التجهيز…' : 'مشاركة'}
    </Button>
  ) : null;

  const printButton = onPrint ? (
    <Button
      key="print"
      type="button"
      variant="outline"
      size="sm"
      className={buttonClass}
      onClick={() => void onPrint()}
      disabled={disabled}
    >
      <Printer className="size-3.5" aria-hidden="true" />
      طباعة A4
    </Button>
  ) : null;

  const excelButtons = (onDownloadExcel || (excelRows && excelRows.rows.length > 0)) ? (
    <Button
      key="excel"
      type="button"
      variant="secondary"
      size="sm"
      className={buttonClass}
      onClick={handleExcel}
      disabled={excelDisabled}
    >
      <FileSpreadsheet className="size-3.5" aria-hidden="true" />
      Excel
    </Button>
  ) : null;

  const csvButton = csv ? (
    <Button
      key="csv"
      type="button"
      variant="ghost"
      size="sm"
      className={buttonClass}
      onClick={() => downloadCsv(csv.filename, csv.rows)}
      disabled={disabled || csv.rows.length === 0}
    >
      <FileText className="size-3.5" aria-hidden="true" />
      CSV
    </Button>
  ) : null;

  const whatsappButton = showWhatsApp ? (
    <Button
      key="whatsapp"
      type="button"
      variant="outline"
      size="sm"
      className={buttonClass}
      onClick={handleWhatsApp}
      disabled={disabled}
    >
      <MessageCircle className="size-3.5" aria-hidden="true" />
      واتساب
    </Button>
  ) : null;

  if (layout === 'compact') {
    const menuItems = [
      ...(onPrint ? [{ id: 'print', label: 'طباعة', icon: Printer, disabled, onClick: () => void onPrint() }] : []),
      ...(onDownloadExcel || excelRows
        ? [{ id: 'excel', label: 'تنزيل Excel', icon: FileSpreadsheet, disabled: excelDisabled, onClick: handleExcel }]
        : []),
      ...(share ? [{ id: 'share', label: 'مشاركة آمنة', icon: Share2, disabled: disabled || busy, onClick: () => void handleShare() }] : []),
    ];
    return (
      <div className={className} data-report-document-actions data-report-share-actions data-layout="compact">
        <div className="flex items-center gap-1">
          {onDownloadPdf ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onDownloadPdf()}
              disabled={disabled}
              className={buttonClass}
            >
              <Download className="size-3.5" aria-hidden="true" />
              {primaryDownloadLabel}
            </Button>
          ) : null}
          {menuItems.length > 0 ? (
            <ActionMenu label={menuLabel} items={menuItems} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-report-document-actions data-report-share-actions>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {printButton}
        {onDownloadPdf ? (
          <Button
            key="pdf"
            type="button"
            variant="outline"
            size="sm"
            className={buttonClass}
            onClick={() => void onDownloadPdf()}
            disabled={disabled}
          >
            <Download className="size-3.5" aria-hidden="true" />
            PDF
          </Button>
        ) : null}
        {onDownloadExcel || excelRows ? excelButtons : null}
        {csv && !onDownloadExcel && !excelRows ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={buttonClass}
            onClick={handleExcelFromCsv}
            disabled={disabled || csv.rows.length === 0}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            Excel
          </Button>
        ) : null}
        {csvButton}
        {whatsappButton}
        {shareButton}
      </div>
    </div>
  );
}
