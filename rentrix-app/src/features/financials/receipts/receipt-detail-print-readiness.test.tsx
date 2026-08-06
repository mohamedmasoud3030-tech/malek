// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Mutable document-settings state each test configures before rendering.
const docSettingsState = {
  isReady: true,
  isLoading: false,
  companySettings: {
    companyName: 'شركة الأفق العقارية',
    phone: '+968 91112222',
    address: 'مسقط - الغبرة',
    currency: 'OMR',
    currencySymbol: 'ر.ع',
    documentPrefixes: {},
  },
};

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useSearch: () => ({ receiptId: 'receipt-1' }),
}));

vi.mock('./useReceipts', () => ({
  useReceipt: () => ({
    data: {
      id: 'receipt-1',
      receipt_number: 'REC-2026-0001',
      payment_date: '2026-07-20',
      amount: 250,
      payment_method: 'cash',
      status: 'posted',
      tenant_name: 'سالم الحبسي',
      property_title: 'عقار النور',
      unit_number: '12',
      invoice_id: null,
      reference_number: null,
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => docSettingsState,
}));

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn(),
    downloadDocumentPdf: vi.fn(),
  },
}));

vi.mock('@/services/action-service', () => ({
  openWhatsApp: vi.fn(),
  shareOrCopy: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReceiptDetailPage } from './receipt-detail-page';

function printButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter(
    (button) => button.textContent?.includes('طباعة'),
  );
}

describe('receipt detail print readiness (P0: no fake company identity)', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    docSettingsState.isReady = true;
    docSettingsState.isLoading = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => root!.unmount());
      document.body.removeChild(container);
    }
    root = null;
    container = null;
  });

  it('enables the print actions when company settings are complete', async () => {
    await act(async () => {
      root!.render(<ReceiptDetailPage />);
    });

    const buttons = printButtons(container!);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button.disabled).toBe(false);

    expect(container!.textContent).not.toContain('أكمل بيانات الشركة الأساسية');
    // Receipt details stay visible regardless of settings state.
    expect(container!.textContent).toContain('REC-2026-0001');
  });

  it('blocks printing and shows the settings guidance when the company name is missing', async () => {
    docSettingsState.isReady = false;

    await act(async () => {
      root!.render(<ReceiptDetailPage />);
    });

    // Print + PDF are disabled.
    const buttons = printButtons(container!);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button.disabled).toBe(true);
    const pdfButton = Array.from(container!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('تنزيل PDF'));
    expect(pdfButton?.disabled).toBe(true);

    // Arabic guidance with a direct route to the settings page.
    expect(container!.textContent).toContain('أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند');
    expect(container!.textContent).toContain('فتح إعدادات الشركة');
    const settingsLink = Array.from(container!.querySelectorAll('a'))
      .find((anchor) => anchor.textContent?.includes('فتح إعدادات الشركة'));
    expect(settingsLink?.getAttribute('href')).toBe('/settings');

    // Viewing the receipt itself is still allowed.
    expect(container!.textContent).toContain('REC-2026-0001');
  });

  it('does not render the legacy hardcoded company identity anywhere', async () => {
    await act(async () => {
      root!.render(<ReceiptDetailPage />);
    });

    expect(container!.textContent).not.toContain('+968 24000000');
    expect(container!.textContent).not.toContain('رينتريكس لإدارة العقارات');
    expect(container!.textContent).not.toContain('سلطنة عمان - مسقط');
  });

  it('keeps print handlers inert even if invoked while settings are incomplete', async () => {
    docSettingsState.isReady = false;
    const { documentService } = await import('@/services/documents/DocumentService');

    await act(async () => {
      root!.render(<ReceiptDetailPage />);
    });

    // The primary print button is disabled; force-invoke its handler to prove
    // the guard holds at the handler level too (defense in depth).
    const printButton = printButtons(container!)[0];
    expect(printButton.disabled).toBe(true);
    await act(async () => {
      printButton.removeAttribute('disabled');
      printButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(documentService.printDocument).not.toHaveBeenCalled();
    expect(documentService.downloadDocumentPdf).not.toHaveBeenCalled();
  });
});
