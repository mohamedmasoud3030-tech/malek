// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { CompanySettingsDraft } from '../settingsForm';
import { OfficeLaunchPanel } from './OfficeLaunchPanel';
import { parseOfficeImportFile } from './import/office-import';

vi.mock('./import/office-import', async (original) => ({
  ...await original<typeof import('./import/office-import')>(),
  parseOfficeImportFile: vi.fn(),
}));
vi.mock('./office-readiness', () => ({ deriveOfficeReadiness: () => ({
  ready: true, percent: 100, completed: 4, total: 4, items: [], nextAction: null,
}) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each(['resolve', 'reject'] as const)('ignores a stale %s after switching import entity', async (outcome) => {
  let resolve!: (rows: string[][]) => void;
  let reject!: (error: Error) => void;
  vi.mocked(parseOfficeImportFile).mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  render(<OfficeLaunchPanel draft={{} as CompanySettingsDraft} />);
  const upload = screen.getByLabelText('رفع ملف CSV أو Excel للفحص') as HTMLInputElement;
  fireEvent.change(upload, { target: { files: [new File(['old'], 'old.csv')] } });
  expect(upload.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('نوع بيانات الاستيراد'), { target: { value: 'units' } });
  expect(upload.disabled).toBe(false);
  await act(async () => {
    if (outcome === 'resolve') resolve([['اسم المالك'], ['مالك قديم']]);
    else reject(new Error('stale parse error'));
  });
  expect(screen.queryByText('مالك قديم')).toBeNull();
  expect(screen.queryByText('stale parse error')).toBeNull();
  expect(screen.queryByText('الملف: old.csv')).toBeNull();
  expect(upload.disabled).toBe(false);

  vi.mocked(parseOfficeImportFile).mockResolvedValueOnce([
    ['العقار', 'رقم الوحدة', 'الطابق', 'الحالة', 'الإيجار'], ['عقار جديد', '7', '1', 'available', '100'],
  ]);
  await act(async () => { fireEvent.change(upload, { target: { files: [new File(['new'], 'new.csv')] } }); });
  expect(screen.getByText('الملف: new.csv')).toBeTruthy();
  expect(screen.getByText('عقار جديد')).toBeTruthy();
});
