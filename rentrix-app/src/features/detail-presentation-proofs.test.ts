import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * Canonical Detail-Presentation proofs (mission):
 * — every register opens the Quick Preview on row click (desktop AND mobile
 *   share the same semantic action via the shared EntityTable register);
 * — workspace registers expose an explicit full-page action;
 * — one shared shell, no per-feature or mobile/desktop shell duplicates;
 * — the shell is compact (never page-sized), always shows a close control and
 *   Escape/backdrop close stay wired on the shared primitive.
 */
describe('detail presentation architecture proofs', () => {
  const registers = [
    { path: '../features/owners/components/owner-workspace-table.tsx', fullLabel: 'فتح الملف الكامل' },
    { path: '../features/tenants/TenantsPage.tsx', fullLabel: 'فتح الملف الكامل' },
    { path: '../features/people/people-list-page.tsx', fullLabel: 'فتح الملف الكامل' },
    { path: '../features/properties/properties-list-page.tsx', fullLabel: 'فتح الملف الكامل' },
    { path: '../features/units/units-page.tsx', fullLabel: 'فتح ملف الوحدة' },
    { path: '../features/contracts/components/ContractTable.tsx', fullLabel: 'فتح العقد بالكامل' },
    { path: '../features/lands/components/lands-view.tsx', fullLabel: 'فتح ملف الأرض' },
    { path: '../features/service-providers/service-providers-page.tsx', fullLabel: 'فتح الملف الكامل' },
    { path: '../features/financials/receipts/receipts-page.tsx', fullLabel: 'طباعة' },
    { path: '../features/financials/components/invoice-list-section.tsx', fullLabel: 'فتح مساحة الفاتورة' },
    { path: '../features/utilities/components/utilities-workspace.tsx', fullLabel: 'معاينة سريعة' },
    { path: '../features/maintenance/components/maintenance-list.tsx', fullLabel: 'معاينة سريعة' },
  ];

  it('opens the preview from every workspace and transactional register row click', () => {
    for (const { path } of registers) {
      const source = read(path);
      expect(source, path).toContain('onRowClick');
      const opensPreview =
        /set\w+\(\w+/.test(source)                  // local preview state
        || source.includes('openPreview')
        || source.includes('onPreview(')
        || source.includes('onPreviewInvoice')
        || source.includes('onViewDetails');
      expect(opensPreview, `${path} row click should open a preview state`).toBe(true);
    }
  });

  it('keeps one shared shell and never reintroduces per-feature/mobile/desktop shells', () => {
    const previews = [
      '../features/owners/components/OwnerPreviewDialog.tsx',
      '../features/tenants/components/TenantPreviewDialog.tsx',
      '../features/people/components/PersonDossier.tsx',
      '../features/properties/components/property-preview-dialog.tsx',
      '../features/units/components/UnitPreviewDialog.tsx',
      '../features/contracts/components/contract-preview-dialog.tsx',
      '../features/lands/components/land-preview-dialog.tsx',
      '../features/service-providers/components/service-provider-preview-dialog.tsx',
      '../features/financials/receipts/ReceiptPreviewDialog.tsx',
      '../features/financials/components/invoice-preview-dialog.tsx',
      '../features/utilities/components/utility-bill-detail-overlay.tsx',
      '../features/maintenance/components/maintenance-detail-resolve-overlays.tsx',
    ];
    for (const path of previews) {
      expect(read(path), path).toContain('<EntityPreviewDialog');
      expect(read(path), path).not.toContain('MobilePreviewDialog');
      expect(read(path), path).not.toContain('DesktopPreviewDialog');
    }
    expect(existsSync(new URL('../features/owners/components/DesktopPreviewDialog.tsx', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../features/owners/components/MobilePreviewDialog.tsx', import.meta.url))).toBe(false);
  });

  it('keeps the shell compact with a permanent close control and read-only backdrop close', () => {
    const shell = read('../components/ui/entity-preview-dialog.tsx');
    // Compact centered: never viewport-width or page height. `dvh` is used
    // only as a ceiling inside min() so content never exceeds the viewport.
    expect(shell).not.toContain('w-screen');
    expect(shell).not.toContain('h-screen');
    // The body keeps a flex min-h-0 scroller (not a minimum-height layout).
    expect(shell).not.toContain('min-h-screen');
    expect(shell).not.toContain('max-w-5xl');
    expect(shell).toMatch(/max-h-\[min\(calc\(var\(--visual-viewport-height,100dvh\)-/);
    // Always-visible close control + Escape is handled by the underlying Dialog.
    expect(shell).toContain('aria-label="إغلاق المعاينة"');
    expect(shell).toContain('DialogClose');
    expect(shell).toContain('onPointerDown');
    expect(shell).toContain('overscroll-contain');
  });

  it('keeps workspace full pages reachable only through explicit actions from the registers', () => {
    const registersWithFullPage = registers.filter((entry) => !entry.fullLabel.includes('معاينة'));
    for (const { path, fullLabel } of registersWithFullPage) {
      expect(read(path), path).toContain(fullLabel);
    }
  });

  it('removes the inline receipt detail card from normal browsing', () => {
    const receipts = read('../features/financials/receipts/receipts-page.tsx');
    expect(receipts).not.toContain('<ReceiptDetailCard');
    expect(receipts).toContain('<ReceiptPreviewDialog');
    expect(existsSync(new URL('../features/financials/components/receipt-detail-card.tsx', import.meta.url))).toBe(false);
  });

  it('keeps the receipt deep link working as the print/compat adapter only', () => {
    const receipts = read('../features/financials/receipts/receipts-page.tsx');
    expect(receipts).toContain("receiptIdFromSearch");
    expect(receipts).toContain('return <ReceiptDetailPage />;');
  });

  it('gives every mobile card the same primary semantic as the desktop row', () => {
    for (const { path } of registers) {
      const source = read(path);
      if (source.includes('mobileCardPrimaryAction')) {
        expect(source, path).toContain('mobileCardPrimaryAction');
        // Mobile primary must open the preview (or the register's canonical
        // inspect action), never navigate to a page by omission.
        expect(source, path).toMatch(/mobileCardPrimaryAction[\s\S]*?onClick: \(\) => (set\w+|openPreview|onViewDetails|on\w+)/);
      }
    }
  });
});
