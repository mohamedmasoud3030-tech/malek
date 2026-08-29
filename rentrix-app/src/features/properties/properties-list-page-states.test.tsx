// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PropertiesListPage } from './properties-list-page';

const queryState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./use-properties', () => ({
  useProperties: () => ({
    data: { rows: queryState.rows, count: queryState.rows.length },
    isLoading: queryState.isLoading,
    isError: queryState.isError,
    error: queryState.error,
    refetch: queryState.refetch,
  }),
  useProperty: () => ({ data: undefined, isLoading: false }),
  useUpdateProperty: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSoftDeleteProperty: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('@/features/owners/useOwners', () => ({
  useOperationalOwners: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useCreatePropertyWithAgreement: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe('PropertiesListPage data visibility states', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    queryState.rows = [];
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.error = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it('shows a retryable error instead of the empty-success register', async () => {
    queryState.isError = true;
    queryState.error = new Error('network down');
    await act(async () => {
      root.render(<PropertiesListPage />);
    });
    const text = container.textContent ?? '';
    expect(text).toContain('تعذر تحميل قائمة العقارات');
    expect(text).toContain('إعادة المحاولة');
    expect(text).not.toContain('لم تُضف عقارات بعد');
    expect(text).not.toContain('إضافة أول عقار');
    expect(container.querySelector('[data-property-summary]')).toBeNull();
  });

  it('keeps the honest empty office state when the query succeeds with zero rows', async () => {
    await act(async () => {
      root.render(<PropertiesListPage />);
    });
    const text = container.textContent ?? '';
    expect(text).toContain('لم تُضف عقارات بعد');
    expect(text).toContain('إضافة أول عقار');
    expect(text).not.toContain('تعذر تحميل قائمة العقارات');
  });
});
