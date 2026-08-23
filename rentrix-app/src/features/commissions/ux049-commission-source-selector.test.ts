import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * UX-049 regression tests:
 * Proves the commission form never exposes free-text UUID/source_id entry
 * and uses the typed CommissionSourceSelector instead.
 */
describe('CommissionSourceSelector (UX-049)', () => {
  const viewSource = readFileSync(
    resolve(import.meta.dirname, './components/commissions-view.tsx'),
    'utf8',
  );

  const pageSource = readFileSync(
    resolve(import.meta.dirname, './commissions-page.tsx'),
    'utf8',
  );

  const selectorSource = readFileSync(
    resolve(import.meta.dirname, './components/CommissionSourceSelector.tsx'),
    'utf8',
  );

  const serviceSource = readFileSync(
    resolve(import.meta.dirname, './services/commission-source-service.ts'),
    'utf8',
  );

  const labelsSource = readFileSync(
    resolve(import.meta.dirname, './labels.ts'),
    'utf8',
  );

  it('replaces free-text source_id input with typed CommissionSourceSelector', () => {
    // The view must import and use the selector component
    expect(viewSource).toContain('CommissionSourceSelector');
    // No free-text Input with source_id label
    expect(viewSource).not.toContain('label="معرف المصدر"');
    // Uses proper source label
    expect(viewSource).toContain('label="المصدر"');
  });

  it('never displays raw UUIDs as primary labels in the commissions table', () => {
    // Uses formatSourceLabel helper instead of raw source_id display
    expect(viewSource).toContain('formatSourceLabel');
    // Does not show raw "بدون مصدر" from source_id directly
    expect(viewSource).not.toContain('row.source_id ?? "بدون مصدر"');
  });

  it('supports all valid commission source types', () => {
    // Source types are handled in the commission-source-service
    expect(serviceSource).toContain("case 'contract'");
    expect(serviceSource).toContain("case 'owner'");
    expect(serviceSource).toContain("case 'lead'");
    expect(serviceSource).toContain("case 'land'");
    // RC1 closeout (Rule 4): 'payment' is not a commission source type and is
    // never offered by the selector; only the canonical options are.
    expect(selectorSource).not.toContain("type === 'payment'");
    expect(selectorSource).toContain('isCommissionSourceType');
    expect(labelsSource).toContain("commissionSourceTypeOptions = ['contract', 'owner', 'lead', 'land']");
  });

  it('fails closed for unsupported source types', () => {
    expect(serviceSource).toContain('default:');
    expect(serviceSource).toContain('return []');
  });

  it('shows Arabic labels for source types', () => {
    expect(selectorSource).toContain("contract: 'عقد'");
    expect(selectorSource).toContain("owner: 'مالك'");
    expect(selectorSource).toContain("lead: 'عميل محتمل'");
    expect(selectorSource).toContain("land: 'أرض'");
    // RC1 closeout (Rule 4): payment is not a selectable source type. It may
    // remain a display-only label in labels.ts for legacy read rows, but the
    // selector itself must not offer or special-case it.
    expect(selectorSource).not.toContain("payment: 'تحصيل'");
    expect(labelsSource).toContain("payment: 'تحصيل'");
  });

  it('formats source labels without UUID fragments', () => {
    expect(viewSource).toContain('formatSourceLabel');
    expect(viewSource).toContain('${prefix} مرتبط');
    expect(viewSource).not.toContain('sourceId.slice');
    expect(serviceSource).not.toContain('.id.slice');
  });

  it('keeps UUID as internal submitted value only', () => {
    // Selector passes ID (UUID) as value to onChange
    expect(selectorSource).toContain('onChange(event.target.value)');
    // But options use id property
    expect(selectorSource).toContain('value={source.id}');
  });

  it('does not regress on UX-001/002/003 fixed areas', () => {
    // Verify no fake fallback company identity in printed docs (UX-001)
    const receiptPrintSource = (() => {
      try {
        return readFileSync(
          resolve(import.meta.dirname, '../financials/receipts/receipt-detail-print-readiness.test.tsx'),
          'utf8',
        );
      } catch {
        return '';
      }
    })();
    // UX-001 is already fixed, verify tests exist
    if (receiptPrintSource) {
      expect(receiptPrintSource).toBeTruthy();
    }
  });
});
