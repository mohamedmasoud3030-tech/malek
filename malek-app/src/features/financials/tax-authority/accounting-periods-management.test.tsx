// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountingPeriodsManagement } from './accounting-periods-management';
import type { AccountingPeriod } from '@/features/accounting/accountingDomain';

const createMutateMock = vi.fn();
const updateStatusMutateMock = vi.fn();

let periodsRows: AccountingPeriod[] = [
  {
    id: 'period-08', company_id: 'company-1', name: '2026-08',
    start_date: '2026-08-01', end_date: '2026-08-31', status: 'OPEN',
    closed_at: null, closed_by: null, reopen_reason: null,
    created_at: '2026-08-01T00:00:00Z', created_by: null, updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'period-07', company_id: 'company-1', name: '2026-07',
    start_date: '2026-07-01', end_date: '2026-07-31', status: 'SOFT_CLOSED',
    closed_at: '2026-08-02T00:00:00Z', closed_by: 'user-1', reopen_reason: null,
    created_at: '2026-07-01T00:00:00Z', created_by: null, updated_at: '2026-08-02T00:00:00Z',
  },
  {
    id: 'period-06', company_id: 'company-1', name: '2026-06',
    start_date: '2026-06-01', end_date: '2026-06-30', status: 'HARD_CLOSED',
    closed_at: '2026-07-02T00:00:00Z', closed_by: 'user-1', reopen_reason: null,
    created_at: '2026-06-01T00:00:00Z', created_by: null, updated_at: '2026-07-02T00:00:00Z',
  },
];

let canManage = true;

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ canAccess: (permission: string) => permission === 'company.settings.manage' && canManage }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/accounting/useAccountingPeriods', () => ({
  useAccountingPeriods: () => ({ data: periodsRows, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateAccountingPeriod: () => ({ isPending: false, mutate: createMutateMock }),
  useUpdateAccountingPeriodStatus: () => ({ isPending: false, mutate: updateStatusMutateMock }),
}));

let host: HTMLElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function renderSection() {
  host = document.createElement('div');
  document.body.appendChild(host);
  const r = createRoot(host);
  root = r;
  await act(async () => {
    r.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AccountingPeriodsManagement />
      </QueryClientProvider>,
    );
  });
}

/** Radix portals mount dialogs at document.body level — query the whole document. */
const text = () => document.body.innerText ?? '';

function buttonByLabel(label: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes(label)) ?? null;
}

/** React ignores raw `.value=` writes; go through the native setter so onChange fires. */
function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

async function click(button: HTMLButtonElement | null) {
  await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

beforeEach(() => {
  vi.clearAllMocks();
  canManage = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = '';
});

describe('AccountingPeriodsManagement', () => {
  it('lists the periods with their server statuses, sorted by start date', async () => {
    await renderSection();
    const body = text();
    expect(body).toContain('الفترات المحاسبية');
    expect(body.indexOf('2026-06')).toBeLessThan(body.indexOf('2026-07'));
    expect(body.indexOf('2026-07')).toBeLessThan(body.indexOf('2026-08'));
    expect(body).toContain('مفتوحة');
    expect(body).toContain('مقفلة مؤقتاً');
    expect(body).toContain('مقفلة نهائياً');
  });

  it('hides every management affordance from users without the settings-management permission', async () => {
    canManage = false;
    await renderSection();
    expect(buttonByLabel('إنشاء فترة محاسبية')).toBeNull();
    expect(buttonByLabel('إعادة الفتح')).toBeNull();
    // The read-only list is still valuable context for non-managers.
    expect(text()).toContain('2026-08');
  });

  it('offers reopen only for SOFT_CLOSED periods and requires a reason before the RPC', async () => {
    await renderSection();
    const reopenButton = buttonByLabel('إعادة الفتح');
    expect(reopenButton).not.toBeNull();
    await click(reopenButton);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(text()).toContain('إعادة فتح الفترة 2026-07');

    const confirm = buttonByLabel('تأكيد إعادة الفتح');
    expect(confirm).not.toBeNull();
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    const reason = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(reason).not.toBeNull();
    await act(async () => setInputValue(reason, 'تسوية قيد متأخر'));
    expect((buttonByLabel('تأكيد إعادة الفتح') as HTMLButtonElement).disabled).toBe(false);

    await click(buttonByLabel('تأكيد إعادة الفتح'));
    expect(updateStatusMutateMock).toHaveBeenCalledWith(
      { period_id: 'period-07', status: 'OPEN', reason: 'تسوية قيد متأخر' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('prefills the create dialog with the month after the latest period and posts the YYYY-MM name', async () => {
    await renderSection();
    await click(buttonByLabel('إنشاء فترة محاسبية'));

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const [startInput, endInput] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    // Latest period ends 2026-08-31 → the next required period is September 2026.
    expect(startInput.value).toBe('2026-09-01');
    expect(endInput.value).toBe('2026-09-30');

    await click(buttonByLabel('حفظ الفترة'));
    expect(createMutateMock).toHaveBeenCalledWith(
      { name: '2026-09', start_date: '2026-09-01', end_date: '2026-09-30', status: 'OPEN' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('blocks an overlapping range client-side with a clear Arabic message before calling the RPC', async () => {
    await renderSection();
    await click(buttonByLabel('إنشاء فترة محاسبية'));
    const [startInput, endInput] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    await act(async () => {
      setInputValue(startInput, '2026-08-15');
      setInputValue(endInput, '2026-09-10');
    });
    await click(buttonByLabel('حفظ الفترة'));
    expect(text()).toContain('يتداخل مع الفترة 2026-08');
    expect(createMutateMock).not.toHaveBeenCalled();
  });
});
