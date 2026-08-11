// @vitest-environment happy-dom
/**
 * WP-06 — shared Print/PDF readiness regression lock.
 *
 * These tests protect the *platform* guarantees that individual page tests
 * cannot: that every reachable Print/PDF action fails closed without real
 * company/document readiness, that errors reaching the user stay user-safe
 * Arabic sentences, that concurrent activations stay single-flight per
 * document (and do NOT coalesce across different documents), and that no new
 * call site can bypass the canonical platform.
 *
 * Canonical rule: UX-008 + "Printing and documents" (Document 6).
 * Nothing here asserts authorization behavior — permission semantics remain
 * owned by the security track.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const html2canvasMock = vi.hoisted(() =>
  vi.fn(async (_element: HTMLElement) => ({
    width: 794,
    height: 1122,
    toDataURL: () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  }) as unknown as HTMLCanvasElement),
);
vi.mock('html2canvas-pro', () => ({ default: html2canvasMock }));

const saveRecorder = vi.hoisted(() => ({ names: [] as string[] }));
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  class RecordingJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = ((filename?: string) => {
        saveRecorder.names.push(filename ?? 'generated.pdf');
        return this;
      }) as unknown as typeof this.save;
    }
  }
  return { ...actual, jsPDF: RecordingJsPDF };
});

import { documentEngine, DocumentDataError } from './DocumentEngine';
import { documentService } from './DocumentService';
import { DocumentRenderer, DocumentRenderError, resetDocumentRenderState } from './DocumentRenderer';
import { assertDocumentCompanySettings, MissingDocumentSettingsError, type DocumentCompanySettings } from './companyIdentity';
import { removeAllRenderContainers, RENDER_ROOT_ATTRIBUTE } from './renderer/offscreen';
import {
  documentActionErrorMessage,
  DocumentReadinessError,
  isUserSafeDocumentError,
  requireDocumentReadiness,
  runDocumentAction,
  runGuardedDocumentAction,
} from './runDocumentAction';
import type { UnifiedDocumentModel } from './types';
import { documentIdentityKey } from './renderer/documentIdentity';
import { APP_BRAND_NAME } from '@/lib/brand';

const readySettings: DocumentCompanySettings = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: {},
};

const receiptPayload = {
  reference: 'REC-2026-0001',
  paymentDate: '2026-07-25',
  amount: 1200.5,
  paymentMethod: 'نقداً',
  payerName: 'أحمد بن سالم الحارثي',
} as const;

const modelOf = (fileName: string, amount: string): UnifiedDocumentModel => ({
  type: 'receipt',
  header: { companyName: readySettings.companyName, title: 'إيصال استلام نقدية' },
  kpis: [{ label: 'المبلغ', value: amount }],
  tables: [{ columns: ['البند', 'القيمة'], rows: [['المبلغ المستلم', amount]] }],
  footer: { signatures: ['accountant'], companyStampLabel: null, metadata: null },
  fileName,
});

beforeEach(() => {
  toastMock.error.mockClear();
  toastMock.success.mockClear();
  saveRecorder.names.length = 0;
  html2canvasMock.mockClear();
  resetDocumentRenderState();
  removeAllRenderContainers();
});

afterEach(() => {
  resetDocumentRenderState();
  removeAllRenderContainers();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* 1. Fail-closed readiness at the HANDLER, not just the button        */
/* ------------------------------------------------------------------ */

describe('handler-level readiness — hiding or disabling a button is not enforcement', () => {
  it('a guarded handler invoked while not ready never reaches the document service', async () => {
    const operation = vi.fn(async () => undefined);

    await runGuardedDocumentAction({
      isReady: false,
      operation,
      fallbackMessage: 'تعذرت طباعة المستند.',
    });

    expect(operation).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    // The user sees the readiness reason, not a silent no-op.
    expect(String(toastMock.error.mock.calls[0][0])).toMatch(/بيانات الشركة غير مكتملة|غير جاهز للإصدار/);
  });

  it('a guarded handler runs the operation once readiness is confirmed', async () => {
    const operation = vi.fn(async () => undefined);
    await runGuardedDocumentAction({ isReady: true, operation, fallbackMessage: 'تعذرت الطباعة.' });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('requireDocumentReadiness throws the canonical Arabic readiness error', () => {
    expect(() => requireDocumentReadiness(false)).toThrow(DocumentReadinessError);
    expect(() => requireDocumentReadiness(false)).toThrow(/إعدادات|الشركة/);
    expect(() => requireDocumentReadiness(true)).not.toThrow();
  });

  it('the engine itself is the last line of defence: no identity ⇒ no document', () => {
    const attempt = () =>
      documentEngine.buildDocument('receipt', {
        settings: { companyName: '', currency: '', documentPrefixes: {} },
        payload: receiptPayload,
      });
    expect(attempt).toThrow(MissingDocumentSettingsError);
    expect(attempt).toThrow(/بيانات هوية الشركة غير مكتملة/);
  });

  it('a blank/whitespace company name or currency can never satisfy readiness', () => {
    for (const settings of [
      { companyName: '   ', currency: 'OMR', documentPrefixes: {} },
      { companyName: 'شركة', currency: '   ', documentPrefixes: {} },
    ] satisfies DocumentCompanySettings[]) {
      expect(() => assertDocumentCompanySettings(settings)).toThrow(MissingDocumentSettingsError);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. No fake company identity / placeholder legal content             */
/* ------------------------------------------------------------------ */

describe('truthful identity — the product brand is never a company fallback', () => {
  it('renders the real company name and never substitutes the MALEK brand', () => {
    const model = documentEngine.buildDocument('receipt', { settings: readySettings, payload: receiptPayload });
    expect(model.header.companyName).toBe(readySettings.companyName);
    const serialized = JSON.stringify(model);
    // Neither the current product brand nor the historical technical name may
    // ever stand in for a real company identity on a legal/financial document.
    // (Assembled at runtime so this assertion does not itself become a
    // legacy-name occurrence for the brand-contract scan.)
    for (const forbiddenBrand of [APP_BRAND_NAME, ['Rent', 'rix'].join('')]) {
      expect(serialized).not.toContain(forbiddenBrand);
    }
  });

  it('does not invent an address, phone, tax number or registration number', () => {
    const model = documentEngine.buildDocument('receipt', { settings: readySettings, payload: receiptPayload });
    expect(model.header.companyAddress).toBeNull();
    expect(model.header.companyPhone).toBeNull();
    expect(model.header.companyTaxNumber).toBeNull();
    expect(model.header.companyRegistrationNumber).toBeNull();
  });

  it('refuses a document whose required financial data is missing rather than defaulting it', () => {
    expect(() =>
      documentEngine.buildDocument('receipt', {
        settings: readySettings,
        payload: { ...receiptPayload, amount: Number.NaN },
      }),
    ).toThrow(DocumentDataError);
  });
});

/* ------------------------------------------------------------------ */
/* 3. User-safe Arabic errors (no implementation detail leakage)       */
/* ------------------------------------------------------------------ */

describe('user-safe errors — internals never reach the toast', () => {
  it('surfaces platform-authored Arabic messages verbatim', async () => {
    const message = 'تعذر إنشاء ملف PDF لهذا المستند. يرجى إعادة المحاولة.';
    await runDocumentAction(async () => {
      throw new DocumentRenderError(message);
    }, 'fallback');
    expect(toastMock.error).toHaveBeenCalledWith(message);
  });

  it('replaces non-platform errors with the caller Arabic fallback', async () => {
    const fallback = 'تعذرت طباعة الإيصال.';
    await runDocumentAction(async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'rows') at supabaseClient.ts:214");
    }, fallback);
    expect(toastMock.error).toHaveBeenCalledWith(fallback);
  });

  it('never leaks stack frames, SQL, URLs, tokens or file paths into the message', () => {
    const hostile = [
      new TypeError('undefined is not a function\n    at /src/features/financials/x.tsx:12:9'),
      new Error('select * from receipts where company_id = \'aaaa-bbbb\''),
      new Error('FetchError: https://xyz.supabase.co/rest/v1/receipts?apikey=eyJhbGciOi'),
      { message: 'plain object rejection' },
      'string rejection',
    ];
    for (const error of hostile) {
      const shown = documentActionErrorMessage(error, 'تعذر إنشاء المستند.');
      expect(shown).toBe('تعذر إنشاء المستند.');
      expect(shown).not.toMatch(/https?:|select |\.tsx|apikey|at \//i);
    }
  });

  it('classifies every platform error type as user-safe', () => {
    expect(isUserSafeDocumentError(new DocumentRenderError('رسالة عربية'))).toBe(true);
    expect(isUserSafeDocumentError(new MissingDocumentSettingsError())).toBe(true);
    expect(isUserSafeDocumentError(new DocumentDataError('تفاصيل'))).toBe(true);
    expect(isUserSafeDocumentError(new DocumentReadinessError())).toBe(true);
    expect(isUserSafeDocumentError(new Error('internal'))).toBe(false);
  });

  it('a failing action never rethrows, so caller cleanup (finally) always runs', async () => {
    let cleanedUp = false;
    try {
      await runDocumentAction(async () => {
        throw new Error('boom');
      }, 'تعذر.');
    } finally {
      cleanedUp = true;
    }
    expect(cleanedUp).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Single-flight correctness                                        */
/* ------------------------------------------------------------------ */

describe('single-flight — one document, one output', () => {
  it('coalesces a double activation of the SAME document into one PDF', async () => {
    const model = modelOf('receipt-REC-1', '50.000 ر.ع');
    await Promise.all([
      DocumentRenderer.downloadDocumentPdf(model),
      DocumentRenderer.downloadDocumentPdf(model),
    ]);
    expect(saveRecorder.names).toEqual(['receipt-REC-1.pdf']);
  });

  it('does NOT coalesce two different documents that share a filename', async () => {
    // The registry filename strategy falls back to `<prefix>-<date>`, so two
    // genuinely different documents routinely share one filename. Joining
    // them would output the wrong document for the second click.
    const first = modelOf('invoice-2026-07-31', '100.000 ر.ع');
    const second = modelOf('invoice-2026-07-31', '999.000 ر.ع');

    await Promise.all([
      DocumentRenderer.downloadDocumentPdf(first),
      DocumentRenderer.downloadDocumentPdf(second),
    ]);

    expect(saveRecorder.names).toHaveLength(2);
    expect(html2canvasMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('releases the in-flight slot after a failure so a retry can still run', async () => {
    const model = modelOf('receipt-RETRY', '10.000 ر.ع');
    html2canvasMock.mockRejectedValueOnce(new Error('rasterizer crash'));

    await expect(DocumentRenderer.downloadDocumentPdf(model)).rejects.toThrow(DocumentRenderError);
    expect(saveRecorder.names).toHaveLength(0);

    // The retry must actually render rather than joining a stuck promise.
    await DocumentRenderer.downloadDocumentPdf(model);
    expect(saveRecorder.names).toEqual(['receipt-RETRY.pdf']);
  });

  it('coalesces a double activation of the SAME document on the PRINT channel', async () => {
    const model = modelOf('receipt-PRINT-1', '50.000 ر.ع');
    const openMock = vi.fn(() => null);
    vi.stubGlobal('open', openMock);

    // Both activations must join ONE flight, so only one popup is attempted.
    const results = await Promise.allSettled([
      DocumentRenderer.printDocument(model),
      DocumentRenderer.printDocument(model),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('print and PDF issued CONCURRENTLY never coalesce with each other', async () => {
    const model = modelOf('receipt-SPLIT', '25.000 ر.ع');
    const openMock = vi.fn(() => null);
    vi.stubGlobal('open', openMock);

    // Two distinct user-visible operations on one document: the PDF must be
    // produced AND the print must independently report its own failure.
    const [pdfResult, printResult] = await Promise.allSettled([
      DocumentRenderer.downloadDocumentPdf(model),
      DocumentRenderer.printDocument(model),
    ]);

    expect(pdfResult.status).toBe('fulfilled');
    expect(printResult.status).toBe('rejected');
    expect(saveRecorder.names).toEqual(['receipt-SPLIT.pdf']);
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('the in-flight slot is released after success, so a later click renders again', async () => {
    const model = modelOf('receipt-SEQUENTIAL', '15.000 ر.ع');
    await DocumentRenderer.downloadDocumentPdf(model);
    await DocumentRenderer.downloadDocumentPdf(model);
    // Two SEQUENTIAL user actions are two legitimate documents (not a
    // double-click), so the guard must not permanently dedupe them.
    expect(saveRecorder.names).toEqual(['receipt-SEQUENTIAL.pdf', 'receipt-SEQUENTIAL.pdf']);
  });

  it('a rejected flight is not cached: concurrent joiners share the failure, the retry re-renders', async () => {
    const model = modelOf('receipt-REJOIN', '30.000 ر.ع');
    html2canvasMock.mockRejectedValueOnce(new Error('rasterizer crash'));

    const results = await Promise.allSettled([
      DocumentRenderer.downloadDocumentPdf(model),
      DocumentRenderer.downloadDocumentPdf(model),
    ]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(saveRecorder.names).toHaveLength(0);

    await DocumentRenderer.downloadDocumentPdf(model);
    expect(saveRecorder.names).toEqual(['receipt-REJOIN.pdf']);
  });

  it('never writes the single-flight key into the DOM, the filename or the console', async () => {
    const logs: string[] = [];
    const capture = (...args: unknown[]) => logs.push(args.map(String).join(' '));
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(capture),
      vi.spyOn(console, 'info').mockImplementation(capture),
      vi.spyOn(console, 'warn').mockImplementation(capture),
      vi.spyOn(console, 'debug').mockImplementation(capture),
    ];

    const model = modelOf('receipt-OPAQUE', '77.000 ر.ع');
    await DocumentRenderer.downloadDocumentPdf(model);
    for (const spy of spies) spy.mockRestore();

    const key = documentIdentityKey('pdf', model);
    const digest = key.split(':')[2];
    expect(logs.join('\n')).not.toContain(digest);
    expect(document.body.innerHTML).not.toContain(digest);
    // The saved filename stays the registry-sanitized name, never the key.
    expect(saveRecorder.names).toEqual(['receipt-OPAQUE.pdf']);
    for (const name of saveRecorder.names) expect(name).not.toContain(digest);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Cleanup on every path                                            */
/* ------------------------------------------------------------------ */

describe('cleanup — nothing leaks into the live app DOM', () => {
  const renderRoots = () => document.querySelectorAll(`[${RENDER_ROOT_ATTRIBUTE}]`).length;

  it('removes every offscreen container after a successful render', async () => {
    await DocumentRenderer.downloadDocumentPdf(modelOf('receipt-OK', '5.000 ر.ع'));
    expect(renderRoots()).toBe(0);
  });

  it('removes every offscreen container after a failed render', async () => {
    html2canvasMock.mockRejectedValueOnce(new Error('capture failed'));
    await expect(DocumentRenderer.downloadDocumentPdf(modelOf('receipt-FAIL', '5.000 ر.ع'))).rejects.toThrow(
      DocumentRenderError,
    );
    expect(renderRoots()).toBe(0);
  });

  it('leaves the app <head> untouched (no injected document styles)', async () => {
    const headBefore = document.head.innerHTML;
    await DocumentRenderer.downloadDocumentPdf(modelOf('receipt-HEAD', '5.000 ر.ع'));
    expect(document.head.innerHTML).toBe(headBefore);
  });

  it('a download never opens a popup window', async () => {
    const openMock = vi.fn(() => null);
    vi.stubGlobal('open', openMock);
    await DocumentRenderer.downloadDocumentPdf(modelOf('receipt-NOPOPUP', '5.000 ر.ع'));
    expect(openMock).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* 6. OMR precision is preserved end to end                            */
/* ------------------------------------------------------------------ */

describe('OMR precision — three decimals survive to the rendered model', () => {
  it('formats positive, zero and negative OMR amounts with exactly 3 decimals', () => {
    const model = documentEngine.buildDocument('owner_statement', {
      settings: readySettings,
      payload: {
        ownerName: 'سالم بن راشد البلوشي',
        totalRent: 1200,
        totalExpenses: 0,
        totalCommission: 60.5,
        netAmount: -35.75,
        transactions: [
          { date: '2026-07-10', type: 'تحصيل', description: 'إيجار يوليو', amount: 1200 },
          { date: '2026-07-12', type: 'مصروف', description: 'صيانة', amount: -35.75 },
          { date: '2026-07-13', type: 'تسوية', description: 'تسوية صفرية', amount: 0 },
        ],
      },
    });

    const rendered = [...model.kpis.map((k) => k.value), ...model.tables.flatMap((t) => t.rows.flat())].join(' | ');
    expect(rendered).toContain('1,200.000');
    expect(rendered).toContain('60.500');
    expect(rendered).toContain('0.000');
    expect(rendered).toMatch(/-\s?35\.750/);
    // No two-decimal money may appear for an OMR document.
    expect(rendered).not.toMatch(/\d+\.\d{2}(?!\d)\s*ر\.ع/);
  });
});

/* ------------------------------------------------------------------ */
/* 7. Service boundary rejects unknown document types                  */
/* ------------------------------------------------------------------ */

describe('service boundary — only registered documents can be produced', () => {
  it('rejects an unregistered type on both print and PDF before rendering', async () => {
    await expect(
      documentService.printDocument('totally_unknown' as never, { settings: readySettings, payload: {} as never }),
    ).rejects.toThrow(/Unsupported document type/);
    await expect(
      documentService.downloadDocumentPdf('totally_unknown' as never, { settings: readySettings, payload: {} as never }),
    ).rejects.toThrow(/Unsupported document type/);
    expect(saveRecorder.names).toHaveLength(0);
  });
});
