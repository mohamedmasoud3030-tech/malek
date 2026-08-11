/**
 * Document-platform boundary RULES (pure, testable predicates).
 *
 * The inventory guard scans repository source for Print/PDF bypasses. Those
 * predicates live here — separated from the scan — for one reason: a guard
 * that has never been shown to FAIL is not a guard. Keeping the rules pure
 * lets `documentBoundaryRules.test.ts` feed them synthetic bypass fixtures
 * and prove each rule actually fires, while
 * `documentOutputInventory.test.ts` applies the same rules to real files.
 *
 * These are source-text rules, so they are deliberately conservative: they
 * strip comments and string literals before matching, because the comments
 * that DOCUMENT a removed bypass must not be mistaken for the bypass itself.
 */

/**
 * Blanks out comments so a scan matches real CODE only.
 *
 * Block comments and line comments are replaced with spaces (preserving
 * nothing but structure). `://` inside a URL literal is protected by
 * requiring the `//` not to be preceded by `:`.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

export type BoundaryRule = Readonly<{
  id: string;
  /** Operator-facing explanation used as the assertion message. */
  message: string;
  /** True when `source` VIOLATES the rule. */
  violates: (source: string) => boolean;
}>;

/** Matches a direct print-dialog invocation on the global window object. */
const WINDOW_PRINT = /\b(?:window|globalThis|self)\s*\.\s*print\s*\(/;

/** Matches any zero-argument `.print()` call (popup, iframe, cloned window). */
const ANY_PRINT_CALL = /\.\s*print\s*\(\s*\)/;

/** Matches an iframe-based print engine. */
const IFRAME_PRINT = /contentWindow\s*\.\s*print/;

/** Matches hand-rolled printable HTML/document assembly. */
const HAND_BUILT_PRINT_HTML = /@page\s*\{|size:\s*A4|<!doctype html|document\.write\s*\(/i;

/** Matches driving a popup's document directly (a parallel print path). */
const POPUP_DOCUMENT_WRITE = /\.document\s*\.\s*(?:write|open)\s*\(/;

/** Matches a direct import of the PDF toolchain. */
const PDF_TOOLCHAIN_IMPORT = /from ['"](?:jspdf|html2canvas(?:-pro)?)['"]/;

/** Matches feature code reaching past the service boundary. */
const DEEP_PLATFORM_IMPORT = /from '@\/services\/documents\/(?:DocumentEngine|DocumentController|DocumentRenderer)'/;

/** Matches hand-assembly of a document model. */
const DOCUMENT_MODEL_LITERAL = /header:\s*\{\s*companyName/;

/** Matches a hard-coded company name used as document identity. */
const HARDCODED_COMPANY_NAME = /companyName\s*:\s*['"`](?!\s*['"`])/;

/** Matches a hard-coded currency code used as document currency. */
const HARDCODED_CURRENCY = /\bcurrency\s*:\s*['"`](?:OMR|USD|AED|SAR|EUR|EGP)['"`]/;

/** Matches raw `error.message` passthrough for a DOCUMENT failure. */
const RAW_DOCUMENT_ERROR_PASSTHROUGH =
  /(?:printDocument|downloadDocumentPdf|printExpenseVoucher|exportExpenseVoucher|printInvoiceDocument|exportInvoiceDocument)[\s\S]{0,400}?catch\s*\(\s*error\s*\)\s*\{[\s\S]{0,200}?toast\.error\(\s*error instanceof Error \? error\.message/;

/**
 * Matches an invocation of the document output service. Used to decide
 * whether a module is a Print/PDF CALL SITE that must appear in the
 * reviewed inventory.
 */
export const DOCUMENT_OUTPUT_INVOCATION =
  /documentService\s*\.\s*(printDocument|downloadDocumentPdf|print|downloadPdf|renderPdf)\b|\b(printInvoiceDocument|exportInvoiceDocument|printExpenseVoucher|exportExpenseVoucher)\s*\(|DocumentTemplates\s*\./;

/** True when the module produces a document (and so must be inventoried). */
export function invokesDocumentOutput(source: string): boolean {
  return DOCUMENT_OUTPUT_INVOCATION.test(stripComments(source));
}

/** True when the module enforces readiness inside the handler. */
export function enforcesHandlerReadiness(source: string): boolean {
  const code = stripComments(source);
  return (
    /runGuardedDocumentAction\s*\(/.test(code)
    || /requireDocumentReadiness\s*\(/.test(code)
    || /hasCompleteCompanyIdentity\s*\(/.test(code)
  );
}

/**
 * Rules applied to feature/component source. Every rule is exercised against
 * a synthetic violating fixture AND a compliant fixture in the rules test.
 */
export const FEATURE_BOUNDARY_RULES: readonly BoundaryRule[] = [
  {
    id: 'no-window-print',
    message: 'must not call window.print() — printing belongs to DocumentRenderer',
    violates: (source) => WINDOW_PRINT.test(stripComments(source)),
  },
  {
    id: 'no-print-dialog',
    message: 'must not invoke a print dialog',
    violates: (source) => ANY_PRINT_CALL.test(stripComments(source)),
  },
  {
    id: 'no-iframe-print',
    message: 'must not print through an iframe',
    violates: (source) => IFRAME_PRINT.test(stripComments(source)),
  },
  {
    id: 'no-hand-built-print-html',
    message: 'must not build printable document HTML by hand',
    violates: (source) => HAND_BUILT_PRINT_HTML.test(stripComments(source)),
  },
  {
    id: 'no-popup-document-write',
    message: 'must not drive its own popup document',
    violates: (source) => POPUP_DOCUMENT_WRITE.test(stripComments(source)),
  },
  {
    id: 'no-pdf-toolchain-import',
    message: 'must not import jspdf/html2canvas directly',
    violates: (source) => PDF_TOOLCHAIN_IMPORT.test(stripComments(source)),
  },
  {
    id: 'no-deep-platform-import',
    message: 'must not import DocumentEngine/Controller/Renderer directly — use documentService',
    violates: (source) => DEEP_PLATFORM_IMPORT.test(stripComments(source)),
  },
  {
    id: 'no-document-model-literal',
    message: 'must not assemble a UnifiedDocumentModel',
    violates: (source) => DOCUMENT_MODEL_LITERAL.test(stripComments(source)),
  },
];

/** Rules applied only to inventoried document call sites. */
export const CALL_SITE_RULES: readonly BoundaryRule[] = [
  {
    id: 'no-hardcoded-company-name',
    message: 'must not hard-code a document company name',
    violates: (source) => HARDCODED_COMPANY_NAME.test(stripComments(source)),
  },
  {
    id: 'no-hardcoded-currency',
    message: 'must not hard-code a document currency code',
    violates: (source) => HARDCODED_CURRENCY.test(stripComments(source)),
  },
  {
    id: 'no-raw-document-error',
    message: 'must surface document errors through runDocumentAction/runGuardedDocumentAction',
    violates: (source) => RAW_DOCUMENT_ERROR_PASSTHROUGH.test(stripComments(source)),
  },
];
