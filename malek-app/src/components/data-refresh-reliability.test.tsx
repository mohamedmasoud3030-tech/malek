import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataRefreshAlert } from './data-refresh-alert';

function source(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    'utf8',
  );
}

describe('page-by-page data refresh reliability', () => {
  it('provides an announced, retryable stale-data surface', () => {
    const html = renderToStaticMarkup(
      <DataRefreshAlert onRetry={() => undefined} />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('المعلومات المعروضة من آخر تحميل مكتمل');
    expect(html).toContain('إعادة المحاولة');
  });

  it('keeps cached contract, property, unit, provider, and receipt details visible on refresh errors', () => {
    const files = [
      '../features/contracts/pages/ContractDetailPage.tsx',
      '../features/properties/property-detail-page.tsx',
      '../features/properties/units/property-unit-detail-page.tsx',
      '../features/service-providers/service-provider-detail-page.tsx',
      '../features/financials/receipts/receipt-detail-page.tsx',
    ];

    for (const file of files) {
      const page = source(file);
      expect(page).toContain('DataRefreshAlert');
      expect(page).toContain('isError');
    }

    expect(source(files[0])).toContain('if (!contractQuery.data)');
    expect(source(files[1])).toContain("status={property ? 'ready'");
    expect(source(files[2])).toMatch(/status=\{\s*unit\s*\?\s*'ready'/);
    expect(source(files[3])).toContain('if (!dossierQuery.data)');
    expect(source(files[4])).toContain('if (!receipt)');
  });

  it('fails closed for receipt document output while the cached receipt is stale', () => {
    const receipt = source(
      '../features/financials/receipts/receipt-detail-page.tsx',
    );

    expect(receipt).toContain(
      'const canUseReceiptDocument = documentSettings.isReady && !receiptQuery.isError',
    );
    expect(receipt.match(/isReady: canUseReceiptDocument/gu)).toHaveLength(2);
    expect(receipt).toContain(
      'disabled={isPrinting || !canUseReceiptDocument}',
    );
    expect(receipt).toContain('disabled={!canUseReceiptDocument}');
  });

  it('keeps the command center honest when only supporting reads fail', () => {
    const hook = source('../features/dashboard/use-dashboard-priorities.ts');
    const bell = source('../app/layout/notifications-menu.tsx');

    // Failing supporting reads never silently collapse a signal to an empty
    // "all clear" — completeness is carried on the signal and surfaced honestly
    // by the notifications bell that now owns the priority queue.
    expect(hook).not.toContain(
      'utilityBillsQuery.isError ? EMPTY_UTILITY_OBLIGATIONS_SIGNAL',
    );
    expect(hook).not.toContain(
      'maintenanceQuery.isError\n      ? EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL',
    );
    expect(hook).toContain('isComplete: sourcesComplete');
    expect(bell).toContain('priorities.isComplete === false');
    expect(bell).toContain('تعذر اكتمال قائمة الأولويات');
    expect(bell).toContain('بعض المصادر غير متاحة');
  });

  it('isolates owner ready-state hooks in a stable child component', () => {
    const owner = source('../features/owners/components/owner-detail-view.tsx');

    expect(owner).toContain('function OwnerDetailReady');
    expect(owner).toContain(
      "state: Extract<OwnerDetailState, { status: 'ready' }>",
    );
    expect(owner.indexOf('function OwnerDetailReady')).toBeLessThan(
      owner.indexOf('const { authorization } = useAuth()'),
    );
  });
});
