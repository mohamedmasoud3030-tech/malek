import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CsvRow } from '@/lib/csvExport';
import { downloadCsv } from '../reports-page.helpers';

type Props = Readonly<{
  enabled: boolean;
  filename: string;
  rows: CsvRow[];
}>;

/** Permission-aware CSV action shared by report sections. */
export function ReportCsvExportButton({ enabled, filename, rows }: Props) {
  return enabled ? (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11 shrink-0 gap-2 text-xs"
      onClick={() => downloadCsv(filename, rows)}
      disabled={rows.length === 0}
    >
      <FileText className="size-4" aria-hidden="true" />
      CSV
    </Button>
  ) : null;
}
