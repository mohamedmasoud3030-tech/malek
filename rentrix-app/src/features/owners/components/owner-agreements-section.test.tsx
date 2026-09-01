import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OwnerAgreementsSection } from './owner-agreements-section';

const agreementsResult = vi.hoisted(() => ({ value: { data: [] as unknown[], isLoading: false } }));

vi.mock('../useOwnerAgreements', () => ({
  useOwnerAgreementsForOwner: () => agreementsResult.value,
}));
vi.mock('@/app/router/background-location', () => ({
  useDialogNavigate: () => (to: unknown) => {
    lastNavigation = to;
  },
}));
let lastNavigation: unknown;

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <OwnerAgreementsSection ownerId="owner-1" />
    </QueryClientProvider>,
  );
}

function agreementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agreement-1',
    owner_id: 'owner-1',
    property_id: 'property-1',
    property: { id: 'property-1', title: 'برج النخيل' },
    agreement_type: 'property_management',
    commission_type: 'RATE',
    commission_value: 10,
    starts_on: '2026-01-01',
    ends_on: null,
    ...overrides,
  };
}

describe('owner dossier agreements section', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a business-language empty state when the owner has no agreements', () => {
    agreementsResult.value = { data: [], isLoading: false };
    const html = renderSection();
    expect(html).toContain('لا توجد اتفاقيات إدارة');
    expect(html).toContain('قسم الملكية في ملف العقار');
  });

  it('lists agreements across properties with temporal status and business terms', () => {
    agreementsResult.value = {
      data: [
        agreementRow(),
        agreementRow({
          id: 'agreement-2',
          property: { id: 'property-2', title: 'عمارة السلام' },
          commission_type: 'FIXED_MONTHLY',
          commission_value: 150,
          starts_on: '2026-09-01',
        }),
        agreementRow({
          id: 'agreement-3',
          property: { id: 'property-3', title: 'فيلا الحديقة' },
          starts_on: '2025-01-01',
          ends_on: '2025-12-31',
        }),
      ],
      isLoading: false,
    };
    const html = renderSection();
    expect(html).toContain('برج النخيل');
    expect(html).toContain('سارية');
    expect(html).toContain('نسبة من التحصيل');
    expect(html).toContain('عمارة السلام');
    expect(html).toContain('قادمة');
    expect(html).toContain('مبلغ شهري ثابت');
    expect(html).toContain('فيلا الحديقة');
    expect(html).toContain('منتهية');
    expect(html).toContain('مفتوحة');
    expect((html.match(/فتح قسم الملكية/g) ?? []).length).toBe(3);
  });

  it('stays read-only — no create or edit affordances in the dossier', () => {
    agreementsResult.value = { data: [agreementRow()], isLoading: false };
    const html = renderSection();
    expect(html).not.toContain('إنشاء اتفاقية');
    expect(html).not.toContain('تعديل الاتفاقية');
    expect(html).not.toContain('نسخة جديدة');
  });
});
