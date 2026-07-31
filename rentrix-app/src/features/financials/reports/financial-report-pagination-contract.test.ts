import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chunkReportIds } from './report-paginated-read';

const reportsRoot = __dirname;
const reportLoadersSource = readFileSync(
  join(reportsRoot, 'financial-reporting', 'report-loaders.ts'),
  'utf8',
);
const arrearsSource = readFileSync(
  join(reportsRoot, 'arrears-reports-service.ts'),
  'utf8',
);

describe('financial report pagination contract', () => {
  it('pages every operational row source instead of trusting one PostgREST response', () => {
    expect(reportLoadersSource).toContain('fetchCompleteReportRows<InvoiceReportRow>');
    expect(reportLoadersSource).toContain('fetchCompleteReportRows<PaymentReportRow>');
    expect(reportLoadersSource).toContain('fetchCompleteReportRows<ExpenseReportRow>');
    expect(reportLoadersSource.match(/fetchCompleteReportRows</g)).toHaveLength(3);
  });

  it('pages arrears invoices and uses deterministic ordering', () => {
    expect(arrearsSource).toContain('fetchCompleteReportRows<InvoiceReportRow>');
    expect(arrearsSource).toContain("'المتأخرات'");
    expect(arrearsSource).toContain(".order('id', { ascending: true })");
  });

  it('orders all paged operational queries before applying range windows', () => {
    const deterministicOrders = reportLoadersSource.match(/\.order\('id', \{ ascending: true \}\)/g) ?? [];
    expect(deterministicOrders.length).toBeGreaterThanOrEqual(5);
  });

  it('batches large relationship hydration id lists without losing ids', () => {
    const ids = Array.from({ length: 603 }, (_, index) => `id-${index}`);
    const chunks = chunkReportIds(ids, 250);

    expect(chunks.map((chunk) => chunk.length)).toEqual([250, 250, 103]);
    expect(chunks.flat()).toEqual(ids);
  });

  it('rejects invalid hydration batch sizes', () => {
    expect(() => chunkReportIds(['id-1'], 0)).toThrow(/عددًا صحيحًا موجبًا/);
    expect(() => chunkReportIds(['id-1'], 1.5)).toThrow(/عددًا صحيحًا موجبًا/);
  });
});
