// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AlertCenter } from './alert-center';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...rest }: any) => (
      <a href={typeof to === 'string' ? to : '#'} {...rest}>
        {children}
      </a>
    ),
  };
});

function futureTag(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const baseProps = {
  expiringContracts: [] as any[],
  overdueInvoices: [] as any[],
  urgentMaintenance: [] as any[],
};

describe('AlertCenter honest partial-data states', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (container) {
      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
      container = null;
    }
  });

  async function render(props: Partial<Parameters<typeof AlertCenter>[0]> = {}) {
    await act(async () => {
      root.render(<AlertCenter {...baseProps} {...props} />);
    });
  }

  it('reports a failed auxiliary source as غير متاح instead of a fake zero', async () => {
    await render({
      unmatchedBankTxCount: undefined,
      pendingSettlementsCount: 2,
      integrityWarningsCount: 0,
    });

    const text = container?.textContent ?? '';
    expect(text).toContain('غير متاح');
    expect(text).toContain('تعذر تحميل العدد الآن');
    // The known pending-settlement count is still surfaced accurately.
    expect(text).toContain('2 حالة تحتاج قراراً أو متابعة');
  });

  it('renders real counts as priority links with valid destinations', async () => {
    await render({
      unmatchedBankTxCount: 5,
      pendingSettlementsCount: 2,
      integrityWarningsCount: 0,
      expiringContracts: [
        { id: 'c1', end_date: futureTag(5) } as any,
      ],
    });

    const text = container?.textContent ?? '';
    expect(text).toContain('8 حالة تحتاج قراراً أو متابعة');

    const links = Array.from(container?.querySelectorAll('a[data-dashboard-priority-link]') ?? []);
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/bank-reconciliation');
    expect(hrefs).toContain('/owner-settlements');
    expect(hrefs).toContain('/contracts');
    // The retired /finance/banking path must never come back.
    expect(hrefs).not.toContain('/finance/banking');
  });

  it('shows the all-clear card only when every source is loaded and empty', async () => {
    await render({
      unmatchedBankTxCount: 0,
      pendingSettlementsCount: 0,
      integrityWarningsCount: 0,
    });

    const text = container?.textContent ?? '';
    expect(text).toContain('لا توجد أعمال عاجلة');
  });

  it('does not claim the all-clear when a source is unavailable', async () => {
    await render({
      unmatchedBankTxCount: 0,
      pendingSettlementsCount: 0,
      integrityWarningsCount: undefined,
    });

    const text = container?.textContent ?? '';
    expect(text).not.toContain('لا توجد أعمال عاجلة');
    expect(text).toContain('غير متاح');
  });
});
