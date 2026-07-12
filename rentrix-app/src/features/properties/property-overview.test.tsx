import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PropertyOverview } from './property-detail-page';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ propertyId: 'property-123' }),
  Link: ({ children }: any) => children,
  useLocation: () => ({ pathname: '/properties/property-123' }),
}));

// Mock useProperty and useUnits query hooks
vi.mock('./use-properties', () => ({
  useProperty: () => ({
    data: {
      id: 'property-123',
      title: 'عقار مكة التجريبي',
      type: 'building',
      status: 'active',
      address: 'مكة المكرمة',
      owner_name: 'محمد مسعود',
      purchase_value: 5000000,
      current_value: 6000000,
      notes: 'ملاحظات العقار',
      created_at: '2026-06-28',
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/features/units/use-units', () => ({
  useUnits: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useOwnerAgreements: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

describe('PropertyOverview Component Rendering and Copy Integrity', () => {
  it('renders accurate Arabic agreement and financial empty copy', () => {
    const html = renderToStaticMarkup(<PropertyOverview />);

    // Renders the current service-backed empty state for owner agreements
    expect(html).toContain('لا توجد اتفاقية مالك مسجلة لهذا العقار حالياً.');
    expect(html).toContain('سيظهر الملخص المالي هنا عند توفر بيانات مالية مرتبطة بالعقار.');

    // DOES NOT render unsupported legacy wording
    expect(html).not.toContain('ستظهر اتفاقية التشغيل هنا عند توفر بياناتها.');
    expect(html).not.toContain('لا توجد اتفاقية تشغيل نشطة مسجلة حالياً لهذا العقار.');
    expect(html).not.toContain('لا تتوفر حركات مالية أو تصفية محاسبية نشطة مسجلة لهذا العقار حالياً.');
  });

  it('renders property identity and basic details when available', () => {
    const html = renderToStaticMarkup(<PropertyOverview />);
    
    // Verifies property fields and basic info are rendered correctly
    expect(html).toContain('محمد مسعود');
    expect(html).toContain('ملاحظات العقار');
    expect(html).toContain('مبنى');
  });
});
