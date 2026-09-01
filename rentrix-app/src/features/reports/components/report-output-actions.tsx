import { Download, FileSpreadsheet, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { documentActionErrorMessage } from '@/services/documents/runDocumentAction';

type ReportOutputActionsProps = Readonly<{
  downloadLabel: string;
  menuLabel: string;
  onDownloadPdf: () => void;
  onPrint?: () => void;
  onDownloadExcel?: () => void;
  /** Build the exact generated PDF in memory for Web Share. */
  onBuildPdfFile?: () => Promise<File>;
  disabled?: boolean;
}>;

/**
 * Shared report-output action group. Direct file sharing is preferred when
 * the browser supports Web Share files; otherwise the authenticated report
 * URL is shared/copied, never a pretend attachment or success toast.
 */
export function ReportOutputActions({
  downloadLabel,
  menuLabel,
  onDownloadPdf,
  onPrint,
  onDownloadExcel,
  onBuildPdfFile,
  disabled = false,
}: ReportOutputActionsProps) {
  const handleShare = async () => {
    if (disabled) return;

    if (
      onBuildPdfFile
      && typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
    ) {
      try {
        const file = await onBuildPdfFile();
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: menuLabel, files: [file] });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast.error(documentActionErrorMessage(error, 'تعذر تجهيز ملف PDF للمشاركة. سيتم استخدام رابط التقرير بدلًا منه.'));
      }
    }

    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) {
      toast.error('المشاركة غير متاحة في هذه البيئة. استخدم تنزيل PDF بدلًا من ذلك.');
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: menuLabel, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('تم نسخ رابط التقرير المحمي بتسجيل الدخول.');
        return;
      } catch {
        // Fall through to an explicit unsupported state.
      }
    }

    toast.error('لا يدعم هذا المتصفح مشاركة الملف أو نسخ الرابط. استخدم تنزيل PDF أو الطباعة.');
  };

  return (
    <div className="flex items-center gap-1" data-shared-report-output-actions>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onDownloadPdf}
        disabled={disabled}
        className="min-h-11 gap-1.5 text-xs"
      >
        <Download className="size-3.5" aria-hidden="true" />
        {downloadLabel}
      </Button>
      <ActionMenu
        label={menuLabel}
        items={[
          { id: 'share', label: 'مشاركة', icon: Share2, disabled, onClick: () => void handleShare() },
          ...(onPrint ? [{ id: 'print', label: 'طباعة', icon: Printer, disabled, onClick: onPrint }] : []),
          ...(onDownloadExcel ? [{ id: 'excel', label: 'تنزيل Excel', icon: FileSpreadsheet, onClick: onDownloadExcel }] : []),
        ]}
      />
    </div>
  );
}
