import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// P0 regression guard: every print/PDF surface that used to ship a hardcoded
// fake company identity must now print only with real company settings through
// the shared document-readiness boundary. Some large workspaces intentionally
// delegate settings/handler responsibilities to controller/helper modules, so
// this test follows the actual call chain instead of requiring every guard
// token to live in the JSX surface file.

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

const readinessSources: Record<(typeof guardedSurfaces)[number], readonly string[]> = {
  'financials/receipts/receipt-detail-page.tsx': ['financials/receipts/receipt-detail-page.tsx'],
  'maintenance/components/maintenance-workspace.tsx': ['maintenance/components/maintenance-workspace.tsx'],
  'financials/deposits/deposits-workspace.tsx': [
    'financials/deposits/deposits-workspace.tsx',
    'financials/deposits/use-deposit-workspace-controller.ts',
    'financials/deposits/deposit-clearance-document.ts',
  ],
  'utilities/components/utilities-workspace.tsx': ['utilities/components/utilities-workspace.tsx'],
};

describe('document readiness gate replaces fake company identity', () => {
  it.each(guardedSurfaces)('%s no longer hardcodes a fake company identity', (surface) => {
    const source = readinessSources[surface].map(read).join('\n');
    expect(source, `fake company name in ${surface}`).not.toContain(FAKE_NAME);
    expect(source, `fake phone in ${surface}`).not.toContain(FAKE_PHONE);
    expect(source, `fake address in ${surface}`).not.toContain(FAKE_ADDRESS);
    expect(source, `leftover defaultSettings in ${surface}`).not.toContain('const defaultSettings: DocumentSettings');
  });

  it.each(guardedSurfaces)('%s routes printing through the shared readiness gate', (surface) => {
    const source = readinessSources[surface].map(read).join('\n');
    expect(source, `useDocumentSettings in ${surface}`).toContain('useDocumentSettings');
    expect(source, `isReady gate in ${surface}`).toContain('documentSettings.isReady');
    expect(source, `handler-level guard in ${surface}`).toContain('runGuardedDocumentAction');
  });

  it('receipt print/PDF actions are disabled until settings are ready', () => {
    const source = read('financials/receipts/receipt-detail-page.tsx');
    expect(source).toContain('disabled={isPrinting || !documentSettings.isReady}');
    expect(source).toContain('onClick={handleDownloadPdf} disabled={!documentSettings.isReady}');
    expect(source).toContain('runGuardedDocumentAction');
    expect(source).toContain('isReady: documentSettings.isReady');
    expect(source).toContain('DocumentReadinessError(MISSING_RECEIPT_MESSAGE)');
    expect(source).toContain('settings: documentSettings.companySettings');
  });

  it('maintenance A4 statement is guarded and uses the real currency', () => {
    const source = read('maintenance/components/maintenance-workspace.tsx');
    expect(source).toContain('runGuardedDocumentAction');
    expect(source).toContain('isReady: documentSettings.isReady');
    expect(source).toMatch(/onClick=\{handlePrintMaintenanceList\}[\s\S]*?disabled=\{!documentSettings\.isReady\}/);
    expect(source).toContain('settings: documentSettings.companySettings');
    expect(source).not.toContain("`${r.cost} ر.ع`");
  });

  it('deposit clearance keeps visible, settings, and handler-level guards after decomposition', () => {
    const workspace = read('financials/deposits/deposits-workspace.tsx');
    const controller = read('financials/deposits/use-deposit-workspace-controller.ts');
    const documentActions = read('financials/deposits/deposit-clearance-document.ts');

    expect(controller).toContain('useDocumentSettings');
    expect(workspace).toContain('DocumentReadinessNotice');
    expect(workspace).toContain('isReady: documentSettings.isReady');
    expect(workspace).toContain('isDocumentReady: documentSettings.isReady');
    expect(workspace).toContain('handlePrint');
    expect(workspace).toContain('handleDownloadPdf');
    expect(documentActions).toContain('runGuardedDocumentAction');
    expect(documentActions).toContain('isReady,');
    expect(documentActions).toContain("documentService.printDocument('generic_report'");
    expect(documentActions).toContain("documentService.downloadDocumentPdf('generic_report'");
  });

  it('utilities report remains guarded', () => {
    const utilities = read('utilities/components/utilities-workspace.tsx');
    expect(utilities).toContain('runGuardedDocumentAction');
    expect(utilities).toContain('isReady: documentSettings.isReady');
    expect(utilities).toContain('onClick={handlePrint} disabled={!documentSettings.isReady}');
    expect(utilities).toContain('onClick={handleDownloadPdf} disabled={!documentSettings.isReady}');
    expect(utilities).not.toContain('ر.ع`');
  });

  it('a shared notice deep-links to the nested document settings section', () => {
    const notice = read('settings/components/document-readiness-notice.tsx');
    expect(notice).toContain('أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند');
    expect(notice).toContain('فتح إعدادات المستندات');
    expect(notice).toContain('to="/settings"');
    expect(notice).toContain("section: 'company'");
    expect(notice).toContain("companySection: 'documents'");

    for (const surface of guardedSurfaces) {
      expect(read(surface), `DocumentReadinessNotice in ${surface}`).toContain('DocumentReadinessNotice');
    }
  });
});
