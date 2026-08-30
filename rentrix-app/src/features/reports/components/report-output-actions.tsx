import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';

type ReportOutputActionsProps = Readonly<{
  downloadLabel: string;
  menuLabel: string;
  onDownloadPdf: () => void;
  onPrint?: () => void;
  onDownloadExcel?: () => void;
  disabled?: boolean;
}>;

/**
 * One visible report action. Less common formats stay in a compact menu so
 * every report panel does not grow its own row of competing export buttons.
 */
export function ReportOutputActions({
  downloadLabel,
  menuLabel,
  onDownloadPdf,
  onPrint,
  onDownloadExcel,
  disabled = false,
}: ReportOutputActionsProps) {
  return (
    <div className="flex items-center gap-1">
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
          ...(onPrint ? [{ id: 'print', label: 'طباعة', icon: Printer, disabled, onClick: onPrint }] : []),
          ...(onDownloadExcel ? [{ id: 'excel', label: 'تنزيل Excel', icon: FileSpreadsheet, onClick: onDownloadExcel }] : []),
        ]}
      />
    </div>
  );
}
