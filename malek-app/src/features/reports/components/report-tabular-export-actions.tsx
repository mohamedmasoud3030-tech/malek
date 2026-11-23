import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CsvRow } from '@/lib/csvExport';
import {
  csvRowsToXlsxBlob,
  downloadBlob,
  xlsxFilenameFromCsv,
} from '@/lib/tabular-export';
import { downloadCsv } from '../reports-page.helpers';

type Props = Readonly<{
  rows: CsvRow[];
  filename: string;
  sheetName: string;
  enabled: boolean;
  className?: string;
}>;

/** The shared Excel/CSV button pair used by report table exports. */
export function ReportTabularExportActions({
  rows,
  filename,
  sheetName,
  enabled,
  className = 'flex flex-wrap gap-2',
}: Props) {
  const hasRows = rows.length > 0;
  return enabled ? (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          downloadBlob(
            csvRowsToXlsxBlob(rows, sheetName),
            xlsxFilenameFromCsv(filename),
          )
        }
        className="min-h-11 gap-1.5 text-xs"
        disabled={!hasRows}
      >
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        Excel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => downloadCsv(filename, rows)}
        className="min-h-11 gap-1.5 text-xs"
        disabled={!hasRows}
      >
        <FileText className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;
}
