// @vitest-environment happy-dom
/**
 * Professional report document primitives — engine + renderer contract.
 *
 * Verifies the new owner_report / property_report document language:
 *  - typed cells are formatted ONLY by the engine builder (company currency
 *    precision for amounts, Arabic percentages, text pass-through);
 *  - the professional body composes into atomic page blocks: identity
 *    strip, KPI strips, one block per compact table, one SVG block per
 *    chart, keep-together groups as a single atomic block;
 *  - long tables chunk between whole blocks with repeating headers and the
 *    totals only on the final chunk;
 *  - professional text participates in the Arabic/print detection feed;
 *  - empty groups render nothing (no fixed empty pages).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { documentEngine } from '../DocumentEngine';
import type { DocumentCompanySettings } from '../companyIdentity';
import type { OwnerReportPayload } from '../documentPayloads';
import { buildDocumentBodyBlocks, buildDocumentBodyHtml, collectDocumentTextChunks } from './documentHtml';
import type { ReportCellFormat } from '../documentPayloads';

const settings: DocumentCompanySettings = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  address: 'مسقط، سلطنة عمان',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: {},
};

const basePayload: OwnerReportPayload = {
  reportTitle: 'كشف المالك التفصيلي',
  ownerName: 'سالم بن سعيد',
  periodFrom: '2026-08-01',
  periodTo: '2026-08-31',
  identity: [
    { label: 'اسم المالك', value: 'سالم بن سعيد' },
    { label: 'نطاق العقارات', value: 'جميع العقارات المُدارة' },
  ],
  groups: [
    {
      blocks: [
        {
          kind: 'kpis',
          kpis: [
            { label: 'التحصيلات', value: { kind: 'amount', value: 1200 } },
            { label: 'نسبة الإشغال', value: { kind: 'percent', value: 94 } },
            { label: 'نطاق', value: { kind: 'text', value: 'المحفظة كاملة' } },
          ],
        },
        {
          kind: 'table',
          table: {
            title: 'تفاصيل التحصيل',
            columns: ['التاريخ', 'البيان', 'المبلغ'],
            rows: [
              [{ kind: 'text', value: '2026-08-01' }, { kind: 'text', value: 'إيجار الوحدة A1' }, { kind: 'amount', value: 400 }],
              [{ kind: 'text', value: '2026-08-05' }, { kind: 'text', value: 'إيجار الوحدة B2' }, { kind: 'amount', value: 800 }],
            ],
            totals: [{ kind: 'text', value: 'الإجمالي' }, { kind: 'text', value: '' }, { kind: 'amount', value: 1200 }],
          },
        },
      ],
    },
    {
      keepTogether: true,
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'تفاصيل الصيانة',
            columns: ['التاريخ', 'البيان', 'التكلفة'],
            rows: [[{ kind: 'text', value: '2026-08-10' }, { kind: 'text', value: 'إصلاح تكييف' }, { kind: 'amount', value: 75 }]],
          },
        },
        {
          kind: 'chart',
          chart: {
            chartType: 'hbar',
            title: 'توزيع المصروفات',
            categories: ['صيانة', 'كهرباء', 'نظافة'],
            series: [{ name: 'المبلغ', values: [75, 40, 25] }],
            note: 'من المصروفات المسجلة للفترة.',
          },
        },
        { kind: 'note', note: { text: 'لا يوجد نشاط مرافق في الفترة.', tone: 'info' } },
      ],
    },
    { blocks: [] },
  ],
};

describe('professional report engine primitives', () => {
  let model: ReturnType<typeof buildModel>;

  function buildModel() {
    return documentEngine.buildDocument('owner_report', { settings, payload: basePayload });
  }

  beforeEach(() => {
    model = buildModel();
  });

  it('builds an owner_report with a professional body', () => {
    expect(model.type).toBe('owner_report');
    expect(model.header.title).toBe('كشف المالك التفصيلي');
    expect(model.header.dateLabel).toBe('فترة التقرير');
    expect(model.kpis).toEqual([]);
    expect(model.tables).toEqual([]);
    expect(model.professional).toBeDefined();
    expect(model.professional?.identity.map((row) => row.value)).toEqual(['سالم بن سعيد', 'جميع العقارات المُدارة']);
    expect(model.fileName).toMatch(/^owner-report-/);
  });

  it('formats typed cells at build time with currency precision (engine owns money)', () => {
    const kpiBlock = model.professional!.groups[0].blocks[0];
    expect(kpiBlock.kind).toBe('kpis');
    if (kpiBlock.kind !== 'kpis') return;
    expect(kpiBlock.kpis.map((kpi) => [kpi.label, kpi.value])).toEqual([
      ['التحصيلات', '1,200.000 ر.ع'],
      ['نسبة الإشغال', '94%'],
      ['نطاق', 'المحفظة كاملة'],
    ]);

    const tableBlock = model.professional!.groups[0].blocks[1];
    expect(tableBlock.kind).toBe('table');
    if (tableBlock.kind !== 'table') return;
    expect(tableBlock.table.rows[0][2]).toBe('400.000 ر.ع');
    expect(tableBlock.table.totals?.[2]).toBe('1,200.000 ر.ع');
  });

  it('formats fractional percentages with a single decimal place', () => {
    const payload: OwnerReportPayload = {
      ...basePayload,
      groups: [
        {
          blocks: [
            {
              kind: 'kpis',
              kpis: [{ label: 'جزء', value: { kind: 'percent', value: 94.25 } }],
            },
          ],
        },
      ],
    };
    const built = documentEngine.buildDocument('owner_report', { settings, payload });
    const kpi = built.professional!.groups[0].blocks[0];
    if (kpi.kind !== 'kpis') return;
    expect(kpi.kpis[0].value).toBe('94.3%');
  });

  it('identity strip is the first body block and empty blocks never render', () => {
    const blocks = buildDocumentBodyBlocks(model);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks[0]).toContain('document-block');
    expect(blocks[1]).toContain('اسم المالك');
    // The empty group contributes nothing.
    const tableCount = blocks.filter((block) => block.includes('<table')).length;
    expect(tableCount).toBeGreaterThanOrEqual(2);
  });

  it('keep-together groups render as ONE atomic block', () => {
    const blocks = buildDocumentBodyBlocks(model);
    const groupBlocks = blocks.filter((block) => block.includes('تفاصيل الصيانة'));
    expect(groupBlocks).toHaveLength(1);
    // The keep-together group contains the table + the chart + the note.
    expect(groupBlocks[0]).toContain('<table');
    expect(groupBlocks[0]).toContain('<svg');
    expect(groupBlocks[0]).toContain('لا يوجد نشاط مرافق');
    // The chart block is atomic: title and SVG are inside the same section.
    expect(groupBlocks[0]).toContain('توزيع المصروفات');
  });

  it('renders deterministic inline SVG charts with RTL labels and a note', () => {
    const html = buildDocumentBodyHtml(model);
    expect(html).toContain('<svg');
    expect(html).toContain('صيانة');
    expect(html).toContain('من المصروفات المسجلة للفترة.');
    expect(html).not.toContain('hover');
  });

  it('chunks oversized compact tables between whole blocks with repeated headers', () => {
    const rows: ReportCellFormat[][] = [];
    for (let index = 0; index < 60; index += 1) {
      rows.push([
        { kind: 'text', value: `2026-08-${String((index % 28) + 1).padStart(2, '0')}` },
        { kind: 'text', value: `حركة ${index + 1}` },
        { kind: 'amount', value: index + 1 },
      ]);
    }
    const payload: OwnerReportPayload = {
      ...basePayload,
      groups: [
        {
          blocks: [
            {
              kind: 'table',
              table: {
                title: 'سجل الحركات الكبير',
                columns: ['التاريخ', 'البيان', 'المبلغ'],
                rows,
                totals: [{ kind: 'text', value: 'الإجمالي' }, { kind: 'text', value: '' }, { kind: 'amount', value: 1830 }],
              },
            },
          ],
        },
      ],
    };
    const built = documentEngine.buildDocument('owner_report', { settings, payload });
    const blocks = buildDocumentBodyBlocks(built);
    const tableBlocks = blocks.filter((block) => block.includes('<table'));
    expect(tableBlocks.length).toBeGreaterThan(1);
    // Every chunk repeats the header; totals live on the last chunk only.
    const headerOccurrences = blocks.filter((block) => block.includes('<thead')).length;
    expect(headerOccurrences).toBe(tableBlocks.length);
    const totalsRows = blocks.filter((block) => block.includes('1,830.000 ر.ع')).length;
    expect(totalsRows).toBe(1);
  });

  it('professional content participates in the Arabic text feed', () => {
    const chunks = collectDocumentTextChunks(model);
    expect(chunks).toContain('كشف المالك التفصيلي');
    expect(chunks).toContain('تفاصيل التحصيل');
    expect(chunks).toContain('توزيع المصروفات');
    expect(chunks.some((chunk) => /[\u0600-\u06FF]/.test(chunk))).toBe(true);
  });

  it('validation requires reportTitle, ownerName, identity and groups', () => {
    expect(() =>
      documentEngine.buildDocument('owner_report', {
        settings,
        payload: { reportTitle: '', ownerName: 'x', identity: [], groups: [] } as unknown as OwnerReportPayload,
      }),
    ).toThrow(/بيانات المستند ناقصة/);
    expect(() =>
      documentEngine.buildDocument('owner_report', {
        settings,
        payload: { reportTitle: 'تقرير', ownerName: 'x', identity: [] } as unknown as OwnerReportPayload,
      }),
    ).toThrow(/بيانات المستند ناقصة/);
  });

  it('property_report builds through the same professional builder', () => {
    const built = documentEngine.buildDocument('property_report', {
      settings,
      payload: {
        reportTitle: 'تقرير أداء العقار',
        propertyTitle: 'برج الياسمين',
        identity: [{ label: 'العقار', value: 'برج الياسمين' }],
        groups: [],
      },
    });
    expect(built.type).toBe('property_report');
    expect(built.professional?.identity[0].value).toBe('برج الياسمين');
    expect(built.fileName).toMatch(/^property-report-/);
  });
});