/**
 * WP-06 — guard-of-the-guard.
 *
 * `documentOutputInventory.test.ts` scans the repository and passes today.
 * That proves nothing on its own: a scan with a broken regex also passes.
 * These tests feed every boundary rule a synthetic BYPASS fixture and assert
 * the rule fires, plus a compliant fixture and assert it does not.
 *
 * If someone weakens a rule, this file fails even though the repository scan
 * would still be green.
 */
import { describe, expect, it } from 'vitest';
import {
  CALL_SITE_RULES,
  enforcesHandlerReadiness,
  FEATURE_BOUNDARY_RULES,
  invokesDocumentOutput,
  stripComments,
} from './documentBoundaryRules';

const ruleById = (id: string) => {
  const rule = [...FEATURE_BOUNDARY_RULES, ...CALL_SITE_RULES].find((candidate) => candidate.id === id);
  if (!rule) throw new Error(`unknown rule: ${id}`);
  return rule;
};

/** A realistic, compliant Print/PDF call site. */
const COMPLIANT_CALL_SITE = `
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';

export function ReceiptActions() {
  const documentSettings = useDocumentSettings();
  const handlePrint = () => {
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => documentService.printDocument('receipt', {
        settings: documentSettings.companySettings,
        payload: buildPayload(),
      }),
      fallbackMessage: 'تعذرت طباعة الإيصال.',
    });
  };
  return <button onClick={handlePrint}>طباعة</button>;
}
`;

/** Each rule id → a source snippet that MUST trip it. */
const BYPASS_FIXTURES: Readonly<Record<string, string>> = {
  'no-window-print': 'export const p = () => { window.print(); };',
  'no-print-dialog': 'export const p = (popup: Window) => { popup.print(); };',
  'no-iframe-print': 'export const p = (f: HTMLIFrameElement) => { f.contentWindow.print(); };',
  'no-hand-built-print-html': 'export const html = `<style>@page { size: A4 portrait; }</style>`;',
  'no-popup-document-write': 'export const p = (w: Window) => { w.document.write("<h1>x</h1>"); };',
  'no-pdf-toolchain-import': "import { jsPDF } from 'jspdf';\nexport const d = new jsPDF();",
  'no-deep-platform-import':
    "import { documentEngine } from '@/services/documents/DocumentEngine';\nexport const m = documentEngine;",
  'no-document-model-literal':
    'export const model = { header: { companyName: "شركة", title: "t" }, kpis: [], tables: [] };',
  'no-hardcoded-company-name': 'export const settings = { companyName: "شركة الأفق", currency: c };',
  'no-hardcoded-currency': 'export const settings = { companyName: n, currency: "OMR" };',
  'no-raw-document-error': `
    const run = async () => {
      try {
        await documentService.printDocument('receipt', payload);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'fallback');
      }
    };`,
};

describe('every boundary rule actually fires on a bypass fixture', () => {
  it.each(Object.keys(BYPASS_FIXTURES))('rule "%s" detects its bypass', (ruleId) => {
    const rule = ruleById(ruleId);
    expect(rule.violates(BYPASS_FIXTURES[ruleId]), `${ruleId} failed to detect its own bypass fixture`).toBe(true);
  });

  it('every declared rule has a bypass fixture (no untested rule may exist)', () => {
    const declared = [...FEATURE_BOUNDARY_RULES, ...CALL_SITE_RULES].map((rule) => rule.id).sort();
    expect(Object.keys(BYPASS_FIXTURES).sort()).toEqual(declared);
  });

  it('no rule fires on a compliant call site (no false positives)', () => {
    for (const rule of [...FEATURE_BOUNDARY_RULES, ...CALL_SITE_RULES]) {
      expect(rule.violates(COMPLIANT_CALL_SITE), `${rule.id} false-positived on compliant source`).toBe(false);
    }
  });
});

describe('rules match code, not prose', () => {
  it('a comment describing a removed bypass does not trip the rule', () => {
    const documented = `
      /*
       * printCurrentView() (a bare window.print()) used to live here.
       * It is removed and must not come back.
       */
      // window.print() is forbidden; use documentService instead.
      export const noop = () => undefined;
    `;
    expect(ruleById('no-window-print').violates(documented)).toBe(false);
    expect(ruleById('no-print-dialog').violates(documented)).toBe(false);
  });

  it('but a real call hidden below a comment still trips the rule', () => {
    const sneaky = `
      // this looks harmless
      export const p = () => { window.print(); };
    `;
    expect(ruleById('no-window-print').violates(sneaky)).toBe(true);
  });

  it('stripComments preserves URLs (:// is not a line comment)', () => {
    expect(stripComments("const u = 'https://example.test/a';")).toContain('https://example.test/a');
  });
});

describe('call-site detection', () => {
  it.each([
    ["documentService.printDocument('receipt', x)", true],
    ['documentService.downloadDocumentPdf(t, x)', true],
    ['documentService.downloadPdf(request)', true],
    ['DocumentTemplates.printReceiptDocument(d, s)', true],
    ['printInvoiceDocument(invoice, context)', true],
    ["import { Printer } from 'lucide-react';", false],
    ['<Button onClick={onPrint}>طباعة</Button>', false],
    ['const href = createReceiptPrintHref(id);', false],
  ])('classifies %s as a document call site: %s', (source, expected) => {
    expect(invokesDocumentOutput(source)).toBe(expected);
  });

  it('ignores a call site that exists only inside a comment', () => {
    expect(invokesDocumentOutput('// documentService.printDocument("receipt", x)')).toBe(false);
  });
});

describe('handler readiness detection', () => {
  it('accepts the canonical guarded helper and the explicit guards', () => {
    expect(enforcesHandlerReadiness(COMPLIANT_CALL_SITE)).toBe(true);
    expect(enforcesHandlerReadiness('requireDocumentReadiness(isReady);')).toBe(true);
    expect(enforcesHandlerReadiness('if (!hasCompleteCompanyIdentity(settings)) return;')).toBe(true);
  });

  it('REJECTS a disabled-prop-only gate, which is not enforcement', () => {
    const disabledOnly = `
      export function Actions({ isReady }) {
        const onPrint = () => documentService.printDocument('receipt', payload);
        return <Button disabled={!isReady} onClick={onPrint}>طباعة</Button>;
      }
    `;
    expect(enforcesHandlerReadiness(disabledOnly)).toBe(false);
  });

  it('REJECTS an early-return guard that only reads a flag without the platform guard', () => {
    const earlyReturnOnly = `
      const onPrint = () => {
        if (!documentSettings.isReady) return;
        void documentService.printDocument('receipt', payload);
      };
    `;
    // A silent early return gives the user no reason; the platform requires
    // the guarded helper so the failure is visible and Arabic.
    expect(enforcesHandlerReadiness(earlyReturnOnly)).toBe(false);
  });
});
