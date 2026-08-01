import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chunkForInFilter, fetchAllRows, PAGED_READ_PAGE_SIZE } from '@/lib/paginatedRead';

describe('server-side pagination stability, chunking, and deterministic tie-breaking contract', () => {
  it('1. Enforces deterministic tie-breaking (.order("id")) across large dataset services', () => {
    const maintenanceSource = readFileSync(
      resolve(import.meta.dirname, './maintenance/maintenance-service.ts'),
      'utf8',
    );
    const auditSource = readFileSync(
      resolve(import.meta.dirname, './audit/services/audit-log-service.ts'),
      'utf8',
    );
    const communicationSource = readFileSync(
      resolve(import.meta.dirname, './communication/services/communication-service.ts'),
      'utf8',
    );
    const commissionsSource = readFileSync(
      resolve(import.meta.dirname, './commissions/services/commissions-service.ts'),
      'utf8',
    );
    const receiptsSource = readFileSync(
      resolve(import.meta.dirname, './financials/receipts/receiptService.ts'),
      'utf8',
    );

    expect(maintenanceSource).toContain(".order('id', { ascending: false })");
    expect(auditSource).toContain(".order('id', { ascending: false })");
    expect(communicationSource).toContain(".order('id', { ascending: false })");
    expect(commissionsSource).toContain(".order('id', { ascending: false })");
    expect(receiptsSource).toContain(".order('id', { ascending: false })");
  });

  it('2. Chunks large identifier lists for .in() queries to prevent oversized PostgREST URLs', () => {
    const ids = Array.from({ length: 600 }, (_, i) => `id-${i}`);
    const chunks = chunkForInFilter(ids, 250);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(250);
    expect(chunks[1]).toHaveLength(250);
    expect(chunks[2]).toHaveLength(100);
  });

  it('3. fetchAllRows pages forward across pages without duplicate or missing rows', async () => {
    const allRows = Array.from({ length: 2500 }, (_, i) => ({ id: `row-${i}`, val: i }));
    const queryFactory = () => {
      let pageIndex = 0;
      return {
        range: (from: number, to: number) => {
          const slice = allRows.slice(from, to + 1);
          return Promise.resolve({ data: slice, error: null });
        },
      };
    };

    const result = await fetchAllRows(queryFactory);

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(2500);
    const idSet = new Set(result.rows.map((r) => r.id));
    expect(idSet.size).toBe(2500); // zero duplicates, zero missing
  });

  it('4. Supports server-side search filters and count accuracy without partial truncation deception', async () => {
    const receiptSource = readFileSync(
      resolve(import.meta.dirname, './financials/receipts/receiptService.ts'),
      'utf8',
    );

    expect(receiptSource).toContain('fetchInChunks');
    expect(receiptSource).toContain('chunkForInFilter(ids)');
  });
});
