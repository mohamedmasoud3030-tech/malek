/**
 * WP-06 — repository-wide Print/PDF call-site inventory lock (source scan).
 *
 * `documentPlatform.boundaries.test.ts` proves feature code does not import
 * the PDF toolchain. This file closes the complementary hole: it scans every
 * reachable authenticated feature source for Print/PDF *call sites* and
 * proves each one is routed through the canonical platform and guarded at
 * the handler.
 *
 * Why a source scan: a page test only covers the page it renders, so a NEW
 * Print/PDF action added to an unrelated screen would ship unguarded and
 * unnoticed. This scan fails on the new file instead.
 *
 * Nothing here asserts authorization; permission behavior stays owned by the
 * security track. The inventory only asserts the *document* boundary.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CALL_SITE_RULES,
  enforcesHandlerReadiness,
  FEATURE_BOUNDARY_RULES,
  invokesDocumentOutput,
} from './documentBoundaryRules';

const srcDir = resolve(import.meta.dirname, '../..');
const featuresDir = resolve(srcDir, 'features');
const componentsDir = resolve(srcDir, 'components');
const documentsDir = resolve(import.meta.dirname);

function collectFiles(root: string, predicate: (name: string) => boolean): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(root)) {
    if (name === 'node_modules') continue;
    const full = join(root, name);
    if (statSync(full).isDirectory()) entries.push(...collectFiles(full, predicate));
    else if (predicate(name)) entries.push(full);
  }
  return entries;
}

const isProductionSource = (name: string): boolean =>
  /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !/\.e2e-fixture\.tsx$/.test(name);

const featureFiles = collectFiles(featuresDir, isProductionSource);
const componentFiles = collectFiles(componentsDir, isProductionSource);
const serviceFiles = collectFiles(resolve(srcDir, 'services'), isProductionSource);

const read = (file: string) => readFileSync(file, 'utf8');

/**
 * Source with comments and string literals blanked out, so a scan matches
 * real CODE only. Without this, the very comments that document a removed
 * bypass would trip the guard that forbids it.
 */
const readCode = (file: string): string =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const rel = (file: string) => relative(srcDir, file).split('\\').join('/');

/**
 * The canonical, reviewed inventory of feature modules that invoke a
 * Print/PDF output action. Adding a Print/PDF call site to any other module
 * fails the inventory test below — the new surface must be reviewed against
 * the readiness/guard contract and then listed here.
 *
 * route → document type → guard are documented in the canonical pack
 * `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md`.
 */
const APPROVED_DOCUMENT_CALL_SITES: ReadonlySet<string> = new Set([
  // contracts — contract/legal document & domain adapters
  'features/contracts/actions/contractDetailActions.ts',
  'features/contracts/documents/contract-documents.ts',
  // financials — invoice, receipt, expense voucher, deposit clearance, deposit voucher
  'features/financials/invoices/invoice-actions.ts',
  'features/financials/invoices/useInvoiceWorkspaceController.ts',
  'features/financials/expenses/expense-actions.ts',
  'features/financials/components/expenses-section.tsx',
  'features/financials/receipts/receipt-detail-page.tsx',
  'features/financials/deposits/deposit-clearance-document.ts',
  'features/financials/deposits/deposit-voucher-document.ts',
  // owners — owner settlement statement & domain adapters
  'features/owners/components/OwnerSettlementWorkspace.tsx',
  'features/owners/documents/owner-documents.ts',
  // properties — unit lifecycle passport
  'features/properties/documents/unit-passport-document.ts',
  // maintenance — work order and completion certificate
  'features/maintenance/components/maintenance-workspace.tsx',
  'features/maintenance/documents/maintenance-documents.ts',
  // utilities — utility CAM split sheet
  'features/utilities/components/utilities-workspace.tsx',
  'features/utilities/documents/utility-split-document.ts',
  // accounting/reports workspace & domain adapters
  'features/reports/components/AccountingReportsSection.tsx',
  'features/reports/components/CollectionsSection.tsx',
  'features/reports/components/DeferredRevenueReportSection.tsx',
  'features/reports/components/ExpensesSection.tsx',
  'features/reports/components/MaintenanceReportSection.tsx',
  'features/reports/components/OccupancySection.tsx',
  'features/reports/components/OverdueSection.tsx',
  'features/reports/components/ServicesReportSection.tsx',
  'features/reports/components/StatementsSection.tsx',
  'features/reports/documents/report-documents.ts',
  'features/reports/documents/professional-owner-report.ts',
  'features/reports/documents/professional-property-report.ts',
]);

describe('Print/PDF call-site inventory', () => {
  it('every feature module that produces a document is in the reviewed inventory', () => {
    const found = featureFiles.filter((file) => invokesDocumentOutput(read(file))).map(rel);
    const unlisted = found.filter((file) => !APPROVED_DOCUMENT_CALL_SITES.has(file));

    expect(
      unlisted,
      'A new Print/PDF call site appeared. Route it through documentService with a handler-level '
        + 'readiness guard (runGuardedDocumentAction), then add it to '
        + 'APPROVED_DOCUMENT_CALL_SITES.',
    ).toEqual([]);
  });

  it('the inventory has no stale entries (every listed module still produces documents)', () => {
    const found = new Set(featureFiles.filter((file) => invokesDocumentOutput(read(file))).map(rel));
    const stale = [...APPROVED_DOCUMENT_CALL_SITES].filter((file) => !found.has(file));
    expect(stale, 'Remove modules that no longer produce documents from the inventory.').toEqual([]);
  });
});

describe('no parallel document engine outside the platform', () => {
  /**
   * Applies the SHARED boundary rules (the same objects
   * `documentBoundaryRules.test.ts` proves actually fire on synthetic bypass
   * fixtures) to real repository source. Rules and scan can therefore never
   * drift apart: weakening a rule fails the rules test, and adding a bypass
   * fails this scan.
   */
  const rendererInternals = new Set([
    'services/documents/DocumentRenderer.ts',
    'services/documents/renderer/documentHtml.ts',
    'services/documents/renderer/pagination.ts',
    'services/documents/renderer/offscreen.ts',
    'services/documents/renderer/latinPdf.ts',
    'services/documents/renderer/documentIdentity.ts',
    // The rules module necessarily CONTAINS the forbidden patterns (they are
    // its detection regexes), so it can never be scanned by itself. Its own
    // correctness is proven by documentBoundaryRules.test.ts instead.
    'services/documents/documentBoundaryRules.ts',
  ]);

  it.each(FEATURE_BOUNDARY_RULES.map((rule) => rule.id))('feature and component code obeys rule "%s"', (ruleId) => {
    const rule = FEATURE_BOUNDARY_RULES.find((candidate) => candidate.id === ruleId)!;
    const offenders = [...featureFiles, ...componentFiles]
      .filter((file) => !rendererInternals.has(rel(file)))
      .filter((file) => rule.violates(read(file)))
      .map(rel);
    expect(offenders, `${rule.message}:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no service outside the renderer invokes a print dialog', () => {
    const offenders = serviceFiles
      .filter((file) => !rendererInternals.has(rel(file)))
      .filter((file) => {
        const source = read(file);
        return (
          FEATURE_BOUNDARY_RULES.find((rule) => rule.id === 'no-print-dialog')!.violates(source)
          || FEATURE_BOUNDARY_RULES.find((rule) => rule.id === 'no-window-print')!.violates(source)
        );
      })
      .map(rel);
    expect(offenders, `printing must stay inside DocumentRenderer:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('printCurrentView() stays removed and unreferenced in production code', () => {
    const actionService = read(resolve(srcDir, 'services/action-service.ts'));
    expect(actionService).not.toMatch(/export\s+(?:function|const)\s+printCurrentView/);
    const callers = [...featureFiles, ...componentFiles, ...serviceFiles]
      .filter((file) => /\bprintCurrentView\s*\(/.test(readCode(file)))
      .map(rel);
    expect(callers, `no production caller may invoke printCurrentView:\n${callers.join('\n')}`).toEqual([]);
  });
});

describe('single rendering engine', () => {
  it('only DocumentController imports the renderer for output', () => {
    const allowed = new Set([
      'services/documents/DocumentController.ts',
      // Compatibility adapter: imports the error type only (checked below).
      'services/documents/DocumentTemplates.tsx',
    ]);
    for (const file of collectFiles(documentsDir, isProductionSource)) {
      const name = rel(file);
      if (name === 'services/documents/DocumentRenderer.ts' || name.startsWith('services/documents/renderer/')) continue;
      const source = read(file);
      if (!/from '\.\/DocumentRenderer'/.test(source)) continue;
      expect(allowed.has(name), `${name} must not import DocumentRenderer`).toBe(true);
    }
  });

  it('DocumentTemplates imports only the renderer error type, never the renderer itself', () => {
    const source = read(resolve(documentsDir, 'DocumentTemplates.tsx'));
    expect(source).toContain("import { DocumentRenderError } from './DocumentRenderer'");
    expect(source).not.toMatch(/DocumentRenderer\s*\.\s*(printDocument|downloadDocumentPdf)/);
  });

  it('feature code never reaches past the service into the engine or controller', () => {
    for (const file of featureFiles) {
      const source = read(file);
      expect(source, `${rel(file)} must not import DocumentEngine directly`).not.toMatch(
        /from '@\/services\/documents\/DocumentEngine'/,
      );
      expect(source, `${rel(file)} must not import DocumentController directly`).not.toMatch(
        /from '@\/services\/documents\/DocumentController'/,
      );
      expect(source, `${rel(file)} must not import DocumentRenderer directly`).not.toMatch(
        /from '@\/services\/documents\/DocumentRenderer'/,
      );
    }
  });
});

describe('handler-level readiness at every call site', () => {
  /**
   * Every inventory module must reference the readiness rule. Either it
   * consumes `useDocumentSettings().isReady` / a derived flag and passes it
   * to `runGuardedDocumentAction`, or (for pure action modules) it re-derives
   * identity completeness itself.
   */
  it('each inventoried module enforces readiness, not only a disabled prop', () => {
    const offenders: string[] = [];
    for (const file of featureFiles) {
      const name = rel(file);
      if (!APPROVED_DOCUMENT_CALL_SITES.has(name)) continue;
      const source = read(file);

      const guardsHandler =
        /runGuardedDocumentAction\s*\(/.test(source)
        || /requireDocumentReadiness\s*\(/.test(source)
        || /hasCompleteCompanyIdentity\s*\(/.test(source);

      // Thin action modules receive already-asserted settings and are covered
      // by their caller's guard; they must still not fabricate settings.
      const isThinActionModule = /^features\/financials\/(invoices\/invoice-actions|expenses\/expense-actions)\.ts$/.test(name);

      if (!guardsHandler && !isThinActionModule) offenders.push(name);
    }
    expect(
      offenders,
      'These modules produce documents without a handler-level readiness guard. '
        + 'Wrap the handler in runGuardedDocumentAction({ isReady, operation, fallbackMessage }).',
    ).toEqual([]);
  });

  it('no document call site fabricates company identity to satisfy the engine', () => {
    for (const file of featureFiles) {
      const name = rel(file);
      // Scoped to document call sites: the settings feature legitimately
      // declares currency defaults for the settings FORM, which is a
      // different concern from what a document renders.
      if (!APPROVED_DOCUMENT_CALL_SITES.has(name)) continue;
      const source = read(file);
      // A literal companyName/currency in feature code means the real
      // company_settings record was bypassed.
      expect(source, `${rel(file)} must not hard-code a document company name`).not.toMatch(
        /companyName\s*:\s*['"`](?!\s*['"`])/,
      );
      expect(source, `${rel(file)} must not hard-code a document currency code`).not.toMatch(
        /\bcurrency\s*:\s*['"`](?:OMR|USD|AED|SAR|EUR)['"`]/,
      );
    }
  });

  it('raw error messages are not piped straight to the user from document handlers', () => {
    for (const file of featureFiles) {
      const name = rel(file);
      if (!APPROVED_DOCUMENT_CALL_SITES.has(name)) continue;
      const source = read(file);
      // Scope to DOCUMENT failures only: a mutation's own onError toast is a
      // separate concern owned by that mutation, not by this platform.
      const documentErrorPassthrough =
        /(?:printDocument|downloadDocumentPdf|printExpenseVoucher|exportExpenseVoucher|printInvoiceDocument|exportInvoiceDocument)[\s\S]{0,400}?catch\s*\(\s*error\s*\)\s*\{[\s\S]{0,200}?toast\.error\(\s*error instanceof Error \? error\.message/;
      expect(source, `${name} must surface document errors through runDocumentAction/runGuardedDocumentAction`).not.toMatch(
        documentErrorPassthrough,
      );
    }
  });
});