// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { downloadCsv } = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('../reports-page.helpers', () => ({ downloadCsv }));

import { ReportCsvExportButton } from './report-csv-export-button';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReportCsvExportButton', () => {
  it('preserves the permission gate and disables empty data', () => {
    const rows = [{ tenant: 'سالم', daysOverdue: 21 }];
    const { rerender } = render(
      <ReportCsvExportButton enabled rows={rows} filename="follow-up.csv" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(downloadCsv).toHaveBeenCalledWith('follow-up.csv', rows);

    rerender(<ReportCsvExportButton enabled rows={[]} filename="empty.csv" />);
    expect(screen.getByRole('button', { name: 'CSV' }).hasAttribute('disabled')).toBe(true);

    rerender(<ReportCsvExportButton enabled={false} rows={rows} filename="hidden.csv" />);
    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull();
  });
});
