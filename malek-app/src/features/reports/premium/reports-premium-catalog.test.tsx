/**
 * MALEK Reports — premium catalog contract.
 *
 * Locks the product decision that keeps `/reports` analytical while retaining
 * entity-first statements on their canonical direct product routes:
 *  - the landing is a report catalog only: no KPI numbers, charts, financial
 *    totals, filters, generic preview dialogs, or statement cards;
 *  - reports and statements share a real route (/reports/$reportId), never a
 *    modal, but statement entry belongs to the selected entity context;
 *  - every retained report body is owned by exactly one product target;
 *  - the shared action component is the only place Print/PDF/Excel/share
 *    button logic lives, and share only attaches genuinely built PDFs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REPORT_PRODUCT_IDS } from '@/lib/report-product-ids';
import {
  REPORT_PRODUCTS,
  getReportProduct,
  getReportProductTarget,
  isStatementProduct,
} from '../report-products';
import {
  buildReportProductShareUrl,
  buildReportProductSharePayload,
} from '../report-share';

const reportsDir = resolve(import.meta.dirname, '..');
const read = (relative: string) =>
  readFileSync(resolve(reportsDir, relative), 'utf8').replaceAll('"', "'");
const routeTreeSource = readFileSync(
  resolve(reportsDir, '../../app/router/route-tree.ts'),
  'utf8',
).replaceAll('"', "'");

describe('premium products — one registry, distinct experiences', () => {
  it('keeps all five approved products in one registry and classifies the two entity statements', () => {
    expect(REPORT_PRODUCTS.map((product) => product.id)).toEqual([
      'owner-comprehensive-statement',
      'tenant-statement',
      'collections-arrears-cheques',
      'portfolio-property-performance',
      'financial-settlement-pack',
    ]);
    expect(REPORT_PRODUCTS.map((product) => product.id)).toEqual(
      REPORT_PRODUCT_IDS,
    );
    expect(
      REPORT_PRODUCTS.filter(isStatementProduct).map((product) => product.id),
    ).toEqual(['owner-comprehensive-statement', 'tenant-statement']);
    expect(
      REPORT_PRODUCTS.filter((product) => !isStatementProduct(product)).map(
        (product) => product.id,
      ),
    ).toEqual([
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
      for (const text of [
        product.title,
        product.description,
        product.businessQuestion,
      ]) {
        expect(text).not.toMatch(
          /RPC|adapter|read model|payload|registry|snapshot|section/i,
        );
      }
      expect(`${product.description} ${product.businessQuestion}`).not.toMatch(
        /\d/,
      );
    }
  });

  it('keeps the tenant statement contract-scoped instead of presenting a fabricated reporting period', () => {
    const tenantStatement = getReportProduct('tenant-statement')!;
    expect(tenantStatement.kind).toBe('statement');
    expect(tenantStatement.targets).toHaveLength(1);
    expect(tenantStatement.targets[0].visibleFilterFields).toEqual(['contract']);
  });

  it('never presents a fabricated cheque lifecycle', () => {
    const collections = REPORT_PRODUCTS.find(
      (product) => product.id === 'collections-arrears-cheques',
    )!;
    expect(collections.description).toContain(
      'لا تُعرض دورة شيكات غير موجودة في المصدر',
    );
    for (const target of collections.targets) {
      expect(target.view).not.toMatch(/cheque|pdc/i);
    }
  });
});

describe('reports catalog — analytical routes, not dialogs', () => {
  it('registers the canonical detail route and permission gate', () => {
    expect(routeTreeSource).toContain("path: '/reports/$reportId'");
    expect(routeTreeSource).toContain(
      "requirePermission('financial.reports.view')",
    );
  });

  it('opens analytical products by navigation, excludes statement cards, and never mounts a preview dialog', () => {
    const catalog = read('components/ReportsCatalog.tsx');
    expect(catalog).toContain("to: '/reports/$reportId'");
    expect(catalog).toContain('REPORT_PRODUCTS.filter');
    expect(catalog).toContain('!isStatementProduct(product)');
    expect(catalog).toContain('data-statement-entry-guidance');
    expect(catalog).not.toMatch(/<Dialog|showModal|createPortal/);
  });

  it('keeps the /reports landing catalog-only', () => {
    const page = read('reports-page.tsx');
    expect(page).toContain('<ReportsCatalog');
    expect(page).toContain('data-reports-catalog-landing');
    expect(page).not.toContain('ReportsFilterSurface');
    expect(page).not.toContain('KpiCard');
    expect(page).not.toContain('ReportsWorkspace');
  });

  it('keeps the three analytical catalog-card identities free of financial values', () => {
    const analyticalProducts = REPORT_PRODUCTS.filter(
      (product) => !isStatementProduct(product),
    );
    const markup = renderToStaticMarkup(
      createElement('div', null, [
        ...analyticalProducts.map((product) =>
          createElement(
            'article',
            { key: product.id, 'data-report-product': product.id },
            product.title,
            product.businessQuestion,
          ),
        ),
      ]),
    );
    for (const product of analyticalProducts) {
      expect(markup).toContain(`data-report-product="${product.id}"`);
      expect(markup).toContain(product.title);
    }
    for (const statement of REPORT_PRODUCTS.filter(isStatementProduct)) {
      expect(markup).not.toContain(`data-report-product="${statement.id}"`);
    }
    expect(markup).not.toMatch(/OMR|ر\.ع|\d{3,}/);
  });
});

describe('entity account statements — contextual direct-route chrome', () => {
  it('uses statement-first identity, entity context, and entity return without replacing the body dispatcher', () => {
    const productPage = read('premium/report-product-page.tsx');
    const statementHeader = read('premium/statement-product-header.tsx');

    expect(productPage).toContain("product.kind === 'statement'");
    expect(productPage).toContain('<StatementProductHeader');
    expect(productPage).toContain("to: '/owners/$ownerId'");
    expect(productPage).toContain("to: '/contracts/$contractId'");
    expect(productPage).toContain('<ReportViewPanel');
    expect(statementHeader).toContain('كشف حساب مرتبط بكيان');
    expect(statementHeader).toContain('data-statement-entity-context');
    expect(statementHeader).toContain('data-statement-product-actions');
    expect(read('components/ReportsFilterSurface.tsx')).toContain(
      'data-statement-filter-surface',
    );
    expect(read('components/ReportsFilterSurface.tsx')).toContain(
      "visibleFields?.includes('period')",
    );
  });

  it('keeps account-statement entry points in owner, tenant/person, and contract context', () => {
    expect(read('../owners/components/owner-detail-view.tsx')).toContain(
      'فتح كشف حساب المالك',
    );
    expect(read('../tenants/components/TenantPreviewDialog.tsx')).toContain(
      'فتح كشف حساب العقد',
    );
    expect(read('../people/components/PersonDossier.tsx')).toContain(
      'فتح كشف حساب المستأجر للعقد',
    );
    expect(
      read('../contracts/pages/ContractDetailPage.tsx'),
    ).toContain('فتح كشف حساب العقد');
  });

  it('offers every statement entry point only when the report route permission is held', () => {
    // /reports/$reportId is guarded by `financial.reports.view`. An entry
    // point that ignores that permission advertises a destination the route
    // will bounce, so every statement action must sit behind the same gate.
    for (const [file, action] of [
      ['../owners/components/owner-detail-view.tsx', 'فتح كشف حساب المالك'],
      ['../tenants/components/TenantPreviewDialog.tsx', 'فتح كشف حساب العقد'],
      ['../people/components/PersonDossier.tsx', 'فتح كشف حساب المستأجر للعقد'],
    ] as const) {
      const source = read(file);
      expect(
        source,
        `${file} reads the reports view permission`,
      ).toMatch(
        /canAccess\(\s*(authorization,\s*)?('financial\.reports\.view'|financialOperationPermissions\.viewReports)/,
      );
      const actionIndex = source.indexOf(action);
      expect(actionIndex, `${file} renders ${action}`).toBeGreaterThan(-1);
      // The gate must wrap the block that renders the action, not merely sit
      // somewhere earlier in the file.
      expect(
        source,
        `${file} gates ${action} behind canViewReports`,
      ).toMatch(new RegExp(`canViewReports\\s*[?&][\\s\\S]{0,900}?${action}`));
    }

    // The contract menu builds its actions declaratively behind the gate.
    const contract = read('../contracts/pages/ContractDetailPage.tsx');
    expect(contract).toContain('canViewReports');
    expect(
      contract.slice(
        contract.indexOf('...(canViewReports'),
        contract.indexOf('فتح كشف حساب العقد'),
      ),
    ).toContain("id: 'tenant-statement'");
  });
});

describe('premium catalog — canonical target ownership', () => {
  it('assigns every retained body location to one product target, without a second view registry', () => {
    const bodyLocations = REPORT_PRODUCTS.flatMap((product) =>
      product.targets
        .filter((target) => target.section !== 'statements')
        .map((target) => `${target.section}:${target.view}`),
    );
    expect(bodyLocations).toHaveLength(15);
    expect(new Set(bodyLocations).size).toBe(bodyLocations.length);

    const ownerProduct = getReportProduct('owner-comprehensive-statement');
    expect(
      ownerProduct?.targets.some((target) => target.section === 'statements'),
    ).toBe(true);
  });

  it('resolves each product target and falls back only to that product’s first target', () => {
    for (const product of REPORT_PRODUCTS) {
      expect(product.targets.length).toBeGreaterThan(0);
      for (const target of product.targets) {
        expect(getReportProductTarget(product, target.id).id).toBe(target.id);
      }
      expect(getReportProductTarget(product, undefined).id).toBe(
        product.targets[0].id,
      );
      expect(getReportProductTarget(product, 'nope').id).toBe(
        product.targets[0].id,
      );
    }
  });

  it('maps accounting reports to the canonical financial product route', () => {
    expect(routeTreeSource).toContain("path: '/reports'");
    expect(routeTreeSource).not.toContain("path: '/accounting'");
    const financial = REPORT_PRODUCTS.find(
      (product) => product.id === 'financial-settlement-pack',
    )!;
    expect(
      financial.targets.some(
        (target) =>
          target.section === 'accounting' && target.view === 'general_ledger',
      ),
    ).toBe(true);
  });
});

describe('premium catalog — one shared action implementation', () => {
  it('makes the shared component the only action implementation in the premium page', () => {
    const page = read('premium/report-product-page.tsx');
    expect(page).toContain('<ReportDocumentActions');
    expect(page).not.toMatch(/window\.print\(/);
    expect(page).not.toMatch(/toast\.(success|error)\([^)]*\)\s*;\s*\}/);
  });

  it('mounts the one shared action primitive directly, with no forwarding report-action shell', () => {
    for (const body of [
      'components/OverviewSection.tsx',
      'components/CollectionsSection.tsx',
      'components/PropertyAnalyticsSection.tsx',
    ]) {
      expect(read(body)).toContain('<ReportDocumentActions');
    }
    expect(
      existsSync(resolve(reportsDir, 'components/ReportShareActions.tsx')),
    ).toBe(false);
    expect(
      existsSync(resolve(reportsDir, 'components/report-output-actions.tsx')),
    ).toBe(false);
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
        if (target.documentKind)
          expect(documentKinds.has(target.documentKind)).toBe(true);
      }
    }
  });
});

describe('premium catalog — secure sharing', () => {
  it('builds product share links as real routes with the active scope', () => {
    const url = buildReportProductShareUrl('https://malek.app/', {
      reportId: 'tenant-statement',
      view: 'statement',
      filters: {
        from: '2026-08-01',
        to: '2026-08-31',
        contractId: 'c-1',
        asOf: '',
        ownerId: '',
        propertyId: '',
        tenantId: '',
        unitId: '',
      },
    });
    expect(url).toBe(
      'https://malek.app/reports/tenant-statement?view=statement&from=2026-08-01&to=2026-08-31&contractId=c-1',
    );
  });

  it('never embeds financial values in the prepared share text', () => {
    const payload = buildReportProductSharePayload(
      'https://malek.app',
      {
        reportId: 'owner-comprehensive-statement',
        filters: {
          from: '2026-08-01',
          to: '2026-08-31',
          propertyId: '',
          unitId: '',
          tenantId: '',
          contractId: '',
          asOf: '',
          ownerId: '',
        },
      },
      {
        reportLabel: 'كشف المالك الشامل',
        summaryText: 'الفترة: 2026-08-01 → 2026-08-31',
      },
    );
    expect(payload.shareText).toContain('كشف المالك الشامل');
    expect(payload.shareText).toContain(
      'https://malek.app/reports/owner-comprehensive-statement',
    );
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
