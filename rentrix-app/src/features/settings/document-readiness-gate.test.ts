import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// P0 regression guard: every print/PDF surface that used to ship a hardcoded
// fake company identity must now print only with real company settings
// through the shared `useDocumentSettings` readiness gate.

const root = resolve(import.meta.dirname, '..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

const FAKE_NAME = 'رينتريكس لإدارة العقارات';
const FAKE_PHONE = '+968 24000000';
const FAKE_ADDRESS = 'سلطنة عمان - مسقط';

const guardedSurfaces = [
  'financials/receipts/receipt-detail-page.tsx',
  'maintenance/components/maintenance-workspace.tsx',
  'financials/deposits/deposits-workspace.tsx',
  'utilities/components/utilities-workspace.tsx',
] as const;

describe('document readiness gate replaces fake company identity', () => {
  it.each(guardedSurfaces)('%s no longer hardcodes a fake company identity', (surface) => {
    const source = read(surface);
    expect(source, `fake company name in ${surface}`).not.toContain(FAKE_NAME);
    expect(source, `fake phone in ${surface}`).not.toContain(FAKE_PHONE);
    expect(source, `fake address in ${surface}`).not.toContain(FAKE_ADDRESS);
    expect(source, `leftover defaultSettings in ${surface}`).not.toContain('const defaultSettings: DocumentSettings');
  });

  it.each(guardedSurfaces)('%s routes printing through the shared readiness gate', (surface) => {
    const source = read(surface);
    expect(source, `useDocumentSettings in ${surface}`).toContain('useDocumentSettings');
    expect(source, `isReady gate in ${surface}`).toContain('documentSettings.isReady');
  });

  it('receipt print/PDF actions are disabled until settings are ready', () => {
    const source = read('financials/receipts/receipt-detail-page.tsx');
    expect(source).toContain('disabled={isPrinting || !documentSettings.isReady}');
    expect(source).toContain('onClick={handleDownloadPdf} disabled={!documentSettings.isReady}');
    // Handlers remain guarded even if a disabled button is bypassed.
    expect(source).toContain('if (!document || !documentSettings.isReady) return;');
    // Real identity only — no inline fallback company object.
    expect(source).toContain('settings: documentSettings.settings');
  });

  it('maintenance A4 statement is guarded and uses the real currency', () => {
    const source = read('maintenance/components/maintenance-workspace.tsx');
    expect(source).toContain('if (!documentSettings.isReady) return;');
    expect(source).toContain('onClick={handlePrintMaintenanceList} disabled={!documentSettings.isReady}');
    expect(source).toContain('documentSettings.settings,');
    expect(source).not.toContain("`${r.cost} ر.ع`");
  });

  it('deposits clearance print/PDF and utilities report are guarded', () => {
    const deposits = read('financials/deposits/deposits-workspace.tsx');
    expect(deposits).toContain('if (!documentSettings.isReady) return;');
    expect(deposits).toContain('onClick={() => handlePrint(deposit)} disabled={!documentSettings.isReady}');
    expect(deposits).toContain('onClick={() => handleDownloadPdf(deposit)} disabled={!documentSettings.isReady}');

    const utilities = read('utilities/components/utilities-workspace.tsx');
    expect(utilities).toContain('if (!documentSettings.isReady) return;');
    expect(utilities).toContain('onClick={handlePrint} disabled={!documentSettings.isReady}');
    expect(utilities).toContain('onClick={handleDownloadPdf} disabled={!documentSettings.isReady}');
    expect(utilities).not.toContain('ر.ع`');
  });

  it('a shared notice with a settings link is shown when identity is incomplete', () => {
    const notice = read('settings/components/document-readiness-notice.tsx');
    expect(notice).toContain('أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند');
    expect(notice).toContain('فتح إعدادات الشركة');
    expect(notice).toContain('to="/settings"');

    for (const surface of guardedSurfaces) {
      expect(read(surface), `DocumentReadinessNotice in ${surface}`).toContain('DocumentReadinessNotice');
    }
  });
});
