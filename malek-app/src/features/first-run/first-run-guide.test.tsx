// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockedPathname = '/dashboard';
let mockedCounts: Record<string, number> = {
  properties: 0,
  units: 0,
  people: 0,
  contracts: 0,
};
let mockedError: Error | null = null;

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockedPathname,
  Link: ({ children, to, ...rest }: Readonly<{ children: React.ReactNode; to: string }>) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () =>
        Promise.resolve(
          mockedError
            ? { count: null, error: mockedError }
            : { count: mockedCounts[table] ?? 0, error: null },
        ),
    }),
  },
}));

import { FIRST_RUN_STEPS, FirstRunGuide } from './first-run-guide';

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
  mockedPathname = '/dashboard';
  mockedCounts = { properties: 0, units: 0, people: 0, contracts: 0 };
  mockedError = null;
});

describe('FirstRunGuide — دليل البداية', () => {
  it('يعرض الخطوات الأربع مع روابطها على صفحة اليوم', async () => {
    render(<FirstRunGuide />);
    expect(screen.getByText('أهلا بيك في مالك — ابدأ من هنا')).toBeInTheDocument();
    for (const step of FIRST_RUN_STEPS) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.getByText(/خلصت 0 من 4/)).toBeInTheDocument();
    });
    expect(screen.getByText('إضافة عقار').closest('a')).toHaveAttribute('href', '/properties/new');
    expect(screen.getByText('إنشاء عقد').closest('a')).toHaveAttribute('href', '/contracts/new');
  });

  it('يعلم الخطوات المكتملة من عدد السجلات الفعلي', async () => {
    mockedCounts = { properties: 2, units: 5, people: 0, contracts: 0 };
    render(<FirstRunGuide />);
    await waitFor(() => {
      expect(screen.getByText(/خلصت 2 من 4/)).toBeInTheDocument();
    });
    expect(document.querySelector('[data-first-run-step="properties"]')).toHaveAttribute('data-step-done', 'true');
    expect(document.querySelector('[data-first-run-step="contracts"]')).toHaveAttribute('data-step-done', 'false');
  });

  it('يختفي تلقائيا لما الأساسيات تكتمل', async () => {
    mockedCounts = { properties: 1, units: 1, people: 1, contracts: 1 };
    const { container } = render(<FirstRunGuide />);
    await waitFor(() => {
      expect(container.querySelector('[data-first-run-guide]')).toBeNull();
    });
  });

  it('يفضل ظاهر من غير علامات إنجاز لو قراءة الأعداد فشلت', async () => {
    mockedError = new Error('network down');
    render(<FirstRunGuide />);
    await waitFor(() => {
      expect(screen.getByText('أضف أول عقار')).toBeInTheDocument();
    });
    expect(screen.queryByText(/خلصت .* من 4/)).toBeNull();
  });

  it('الإخفاء يتحفظ محليا ومايرجعش يظهر', async () => {
    const { unmount } = render(<FirstRunGuide />);
    fireEvent.click(screen.getByText('إخفاء الدليل'));
    expect(screen.queryByText('أهلا بيك في مالك — ابدأ من هنا')).toBeNull();
    unmount();
    render(<FirstRunGuide />);
    expect(screen.queryByText('أهلا بيك في مالك — ابدأ من هنا')).toBeNull();
  });

  it('لا يظهر خارج صفحة اليوم', () => {
    mockedPathname = '/contracts';
    const { container } = render(<FirstRunGuide />);
    expect(container.querySelector('[data-first-run-guide]')).toBeNull();
  });
});
