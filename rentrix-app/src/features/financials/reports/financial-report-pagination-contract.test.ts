import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { chunkReportIds, fetchCompleteReportRows } from './report-paginated-read';

const reportsRoot = __dirname;
const reportLoadersSource = readFileSync(
  join(reportsRoot, 'financial-reporting', 'report-loaders.ts'),
  'utf8',
);
const arrearsSource = readFileSync(
  join(reportsRoot, 'arrears-reports-service.ts'),
  'utf8',
);

type TestRow = { id: string };

describe('financial report pagination contract', () => {
  it('reads successive pages until the first short page', async () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({ id: `id-${index}` }));
    const range = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));

    await expect(
      fetchCompleteReportRows<TestRow>(() => ({ range }), 'الاختبار'),
    ).resolves.toEqual(rows);

    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1_000, 1_999);
  });

  it('propagates database read failures instead of returning partial totals', async () => {
    const databaseError = new Error('database unavailable');
    const range = vi.fn(async () => ({ data: null, error: databaseError }));

    await expect(
      fetchCompleteReportRows<TestRow>(() => ({ range }), 'الاختبار'),
    ).rejects.toThrow('database unavailable');
  });

  it('fails closed when the paginated safety ceiling is reached', async () => {
    const fullPage = Array.from({ length: 1_000 }, (_, index) => ({ id: `id-${index}` }));
    const range = vi.fn(async () => ({ data: fullPage, error: null }));

    await expect(
      fetchCompleteReportRows<TestRow>(() => ({ range }), 'الفواتير'),
    ).rejects.toThrow(/تعذر تحميل كامل بيانات الفواتير/);

    expect(range).toHaveBeenCalledTimes(20);
  });

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
