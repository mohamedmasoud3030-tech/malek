import { ReportDocumentActions } from './report-document-actions';

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
 *
 * This is the compact presentation of the ONE shared implementation
 * (`ReportDocumentActions`) — the buttons live here, the behavior does not.
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
    <ReportDocumentActions
      reportLabel={downloadLabel}
      layout="compact"
      primaryDownloadLabel={downloadLabel}
      menuLabel={menuLabel}
      onDownloadPdf={onDownloadPdf}
      onPrint={onPrint}
      onDownloadExcel={onDownloadExcel}
      disabled={disabled}
    />
  );
}
