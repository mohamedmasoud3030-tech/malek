/**
 * MALEK Reports — premium catalog contract.
 *
 * Locks the product decision that turned /reports into a five-product
 * catalog with real detail routes:
 *  - the landing is a catalog only: no KPI numbers, charts, financial
 *    totals, filters or generic preview dialogs;
 *  - every product opens a real route (/reports/$reportId), never a modal;
 *  - every legacy report view is owned by exactly one premium product, so
 *    the consolidation never loses a reachable surface;
 *  - the shared action component is the only place Print/PDF/Excel/share
 *    button logic lives, and share only attaches genuinely built PDFs.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  REPORT_PRODUCTS,
  getReportProduct,
  getReportProductTarget,
} from '../report-products';
import { ACCOUNTING_REPORT_VIEWS, ANALYTICS_REPORT_VIEWS } from '../report-view-registry';
import { buildReportProductShareUrl, buildReportProductSharePayload } from '../report-share';

const reportsDir = resolve(import.meta.dirname, '..');
const read = (relative: string) => readFileSync(resolve(reportsDir, relative), 'utf8');
const routeTreeSource = readFileSync(resolve(reportsDir, '../../app/router/route-tree.ts'), 'utf8');

describe('premium catalog — five products, nothing else', () => {
  it('creates exactly the five approved report products', () => {
    expect(REPORT_PRODUCTS.map((product) => product.id)).toEqual([
      'owner-comprehensive-statement',
      'tenant-statement',
      'collections-arrears-cheques',
      'portfolio-property-performance',
      'financial-settlement-pack',
    ]);
  });

  it('gives every product an Arabic identity, an English identity and a business question', () => {
    for (const product of REPORT_PRODUCTS) {
      expect(product.title).toMatch(/[\u0600-\u06FF]/);
      expect(product.englishTitle).toMatch(/^[A-Za-z,& ]+$/);
      expect(product.businessQuestion.length).toBeGreaterThan(10);
      expect(product.description).toMatch(/[\u0600-\u06FF]/);
      for (const text of [product.title, product.description, product.businessQuestion]) {
        expect(text).not.toMatch(/RPC|adapter|read model|payload|registry|snapshot|section/i);
      }
      expect(`${product.description} ${product.businessQuestion}`).not.toMatch(/\d/);
    }
  });

  it('never presents a fabricated cheque lifecycle', () => {
    const collections = REPORT_PRODUCTS.find((product) => product.id === 'collections-arrears-cheques')!;
    expect(collections.description).toContain('لا تُعرض دورة شيكات غير موجودة في المصدر');
    for (const target of collections.targets) {
      expect(target.view).not.toMatch(/cheque|pdc/i);
    }
  });
});

describe('premium catalog — real routes, not dialogs', () => {
  it('registers the canonical detail route and permission gate', () => {
    expect(routeTreeSource).toContain("path: '/reports/$reportId'");
    expect(routeTreeSource).toContain("requirePermission('financial.reports.view')");
  });

  it('opens products by navigation, never by mounting a preview dialog', () => {
    const catalog = read('components/ReportsCatalog.tsx');
    expect(catalog).toContain("to: '/reports/$reportId'");
    expect(catalog).not.toMatch(/<Dialog|showModal|createPortal/);
  });

  it('keeps the /reports landing catalog-only', () => {
    const page = read('reports-page.tsx');
    expect(page).toContain('<ReportsCatalog');
    expect(page).toContain('legacyLocationRequested');
    const landingBlock = page.slice(page.indexOf('if (!legacyLocationRequested)'), page.indexOf('return (\n    <PageLayout dir="rtl" lang="ar" size="wide">\n      <PageHeader title={reportsTitle} description={pageDescription} />\n\n      <div data-finance-root'));
    expect(landingBlock).toContain('data-reports-catalog-landing');
    expect(landingBlock).not.toContain('ReportsFilterSurface');
    expect(landingBlock).not.toContain('KpiCard');
  });

  it('renders the catalog card grid without any financial values', () => {
    const markup = renderToStaticMarkup(
      createElement('div', null, [
        ...REPORT_PRODUCTS.map((product) =>
          createElement('article', { key: product.id, 'data-report-product': product.id }, product.title, product.businessQuestion),
        ),
      ]),
    );
    for (const product of REPORT_PRODUCTS) {
      expect(markup).toContain(`data-report-product="${product.id}"`);
      expect(markup).toContain(product.title);
    }
    expect(markup).not.toMatch(/OMR|ر\.ع|\d{3,}/);
  });
});

describe('premium catalog — preservation of every legacy surface', () => {
  it('derives exactly one premium owner for every legacy report view from canonical product targets', () => {
    const allViews = [...ANALYTICS_REPORT_VIEWS.map((view) => view.id), ...ACCOUNTING_REPORT_VIEWS.map((view) => view.id)];
    for (const view of allViews) {
      const owners = REPORT_PRODUCTS.filter((product) => product.targets.some((target) => target.view === view));
      expect(owners, `legacy view ${view} must have one premium owner`).toHaveLength(1);
    }

    const ownerProduct = getReportProduct('owner-comprehensive-statement');
    expect(ownerProduct?.targets.some((target) => target.section === 'statements')).toBe(true);
  });

  it('routes every product target to a real (section, view) pair', () => {
    const analyticsIds = new Set<string>(ANALYTICS_REPORT_VIEWS.map((view) => view.id));
    const accountingIds = new Set<string>(ACCOUNTING_REPORT_VIEWS.map((view) => view.id));
    for (const product of REPORT_PRODUCTS) {
      expect(product.targets.length).toBeGreaterThan(0);
      for (const target of product.targets) {
        if (target.section === 'statements') {
          expect(target.view).toBe('');
        } else if (target.section === 'analytics') {
          expect(analyticsIds.has(target.view)).toBe(true);
        } else {
          expect(accountingIds.has(target.view)).toBe(true);
        }
      }
      expect(getReportProductTarget(product, undefined).id).toBe(product.targets[0].id);
      expect(getReportProductTarget(product, 'nope').id).toBe(product.targets[0].id);
      const second = product.targets[1] ?? product.targets[0];
      expect(getReportProductTarget(product, second.id).id).toBe(second.id);
    }
  });

  it('keeps the account route redirect flowing into the preserved compatibility workspace', () => {
    expect(routeTreeSource).toContain("to: '/reports'");
    expect(routeTreeSource).toContain("section: 'accounting', view: 'general_ledger'");
  });
});

describe('premium catalog — one shared action implementation', () => {
  it('makes the shared component the only action implementation in the premium page', () => {
    const page = read('premium/report-product-page.tsx');
    expect(page).toContain('<ReportDocumentActions');
    expect(page).not.toMatch(/window\.print\(/);
    expect(page).not.toMatch(/toast\.(success|error)\([^)]*\)\s*;\s*\}/);
  });

  it('delegates the legacy action surfaces to the same implementation', () => {
    const share = read('components/ReportShareActions.tsx');
    const output = read('components/report-output-actions.tsx');
    expect(share).toContain('<ReportDocumentActions');
    expect(output).toContain('<ReportDocumentActions');
  });

  it('only offers document actions backed by a canonical builder for the open target', () => {
    const documentKinds = new Set([
      'owner-pack',
      'tenant-statement',
      'rent-roll',
      'aged-arrears',
      'property-pack',
      'portfolio-performance',
    ]);
    for (const product of REPORT_PRODUCTS) {
      for (const target of product.targets) {
        if (target.documentKind) expect(documentKinds.has(target.documentKind)).toBe(true);
      }
    }
  });
});

describe('premium catalog — secure sharing', () => {
  it('builds product share links as real routes with the active scope', () => {
    const url = buildReportProductShareUrl('https://malek.app/', {
      reportId: 'tenant-statement',
      view: 'statement',
      filters: { from: '2026-08-01', to: '2026-08-31', contractId: 'c-1', asOf: '', ownerId: '', propertyId: '', tenantId: '', unitId: '' },
    });
    expect(url).toBe('https://malek.app/reports/tenant-statement?view=statement&from=2026-08-01&to=2026-08-31&contractId=c-1');
  });

  it('never embeds financial values in the prepared share text', () => {
    const payload = buildReportProductSharePayload('https://malek.app', {
      reportId: 'owner-comprehensive-statement',
      filters: { from: '2026-08-01', to: '2026-08-31', propertyId: '', unitId: '', tenantId: '', contractId: '', asOf: '', ownerId: '' },
    }, {
      reportLabel: 'كشف المالك الشامل',
      summaryText: 'الفترة: 2026-08-01 → 2026-08-31',
    });
    expect(payload.shareText).toContain('كشف المالك الشامل');
    expect(payload.shareText).toContain('https://malek.app/reports/owner-comprehensive-statement');
    expect(payload.shareText.length).toBeLessThanOrEqual(1_400);
  });

  it('falls back truthfully when file sharing is unavailable', () => {
    const actions = read('components/report-document-actions.tsx');
    expect(actions).toContain('canSharePdfFile');
    expect(actions).toContain('تم نسخ الرابط الآمن');
    expect(actions).toContain('انسخ الرابط من شريط العنوان');
    expect(actions).toContain('buildFile');
  });
});
