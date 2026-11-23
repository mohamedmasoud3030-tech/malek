// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv, downloadCsv } = vi.hoisted(() => ({
  csvRowsToXlsxBlob: vi.fn(() => 'xlsx-blob'),
  downloadBlob: vi.fn(),
  xlsxFilenameFromCsv: vi.fn((filename: string) => filename.replace('.csv', '.xlsx')),
  downloadCsv: vi.fn(),
}));

vi.mock('@/lib/tabular-export', () => ({ csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv }));
vi.mock('../reports-page.helpers', () => ({ downloadCsv }));

import { ReportTabularExportActions } from './report-tabular-export-actions';

describe('ReportTabularExportActions', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the common Excel and CSV actions available for non-empty permitted rows', () => {
    const rows = [{ tenant: 'مستأجر', amount: 125 }];
    render(
      <ReportTabularExportActions
        rows={rows}
        filename="rent-roll.csv"
        sheetName="سجل الإيجارات"
        enabled
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    expect(csvRowsToXlsxBlob).toHaveBeenCalledWith(rows, 'سجل الإيجارات');
    expect(xlsxFilenameFromCsv).toHaveBeenCalledWith('rent-roll.csv');
    expect(downloadBlob).toHaveBeenCalledWith('xlsx-blob', 'rent-roll.xlsx');
    expect(downloadCsv).toHaveBeenCalledWith('rent-roll.csv', rows);
  });

  it('disables empty exports and hides all actions without export permission', () => {
    const { rerender } = render(
      <ReportTabularExportActions rows={[]} filename="empty.csv" sheetName="empty" enabled />,
    );
    expect(screen.getByRole('button', { name: 'Excel' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'CSV' }).hasAttribute('disabled')).toBe(true);

    rerender(
      <ReportTabularExportActions rows={[]} filename="empty.csv" sheetName="empty" enabled={false} />,
    );
    expect(screen.queryByRole('button', { name: 'Excel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull();
  });
});
