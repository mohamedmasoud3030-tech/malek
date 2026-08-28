import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertyOnboardingReadinessBanner, usePropertyOnboardingReadiness } from './property-onboarding-readiness';

const ownerLinks = [
  {
    id: 'link-1',
    property_id: 'property-123',
    owner_id: 'owner-1',
    is_primary: true,
    starts_on: '2026-01-01',
    ends_on: null,
    owner: {
      id: 'owner-1',
      full_name: 'مالك تجريبي',
      display_name: 'مالك تجريبي',
      name: 'مالك تجريبي',
      is_active: true,
      deleted_at: null,
    },
  },
];

type OwnerLinkFixture = (typeof ownerLinks)[number];
type AgreementFixture = { starts_on: string; ends_on: string | null };

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => (opts: { search: { tab: string } }) => {
    lastNavigation = opts;
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

let lastNavigation: { search: { tab: string } } | null = null;

const ownersResult = vi.hoisted(() => ({
  value: { data: [] as OwnerLinkFixture[], isLoading: false },
}));
const agreementsResult = vi.hoisted(() => ({
  value: { data: [] as AgreementFixture[], isLoading: false },
}));

vi.mock('@/features/owners/useOwners', () => ({
  usePropertyOwners: () => ownersResult.value,
}));
vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useOwnerAgreements: () => agreementsResult.value,
}));

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <PropertyOnboardingReadinessBanner propertyId="property-123" />
    </QueryClientProvider>,
  );
}

function ReadinessProbe() {
  const readiness = usePropertyOnboardingReadiness('property-123');
  return <p data-readiness={readiness.status} data-health={'health' in readiness ? readiness.health : ''} />;
}

function renderReadiness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ReadinessProbe />
    </QueryClientProvider>,
  );
}

describe('property onboarding readiness', () => {
  it('derives the shared workflow health from owner links and agreements', () => {
    ownersResult.value = { data: ownerLinks, isLoading: false };
    agreementsResult.value = { data: [], isLoading: false };
    expect(renderReadiness()).toContain('data-readiness="incomplete" data-health="missing_agreement"');

    agreementsResult.value = {
      data: [{ starts_on: '2026-01-01', ends_on: null }],
      isLoading: false,
    };
    expect(renderReadiness()).toContain('data-readiness="ready"');
  });

  it('stays silent while readiness inputs load or the property is ready', () => {
    ownersResult.value = { data: [], isLoading: true };
    agreementsResult.value = { data: [], isLoading: false };
    expect(renderBanner()).toBe('');

    ownersResult.value = { data: ownerLinks, isLoading: false };
    agreementsResult.value = {
      data: [{ starts_on: '2026-01-01', ends_on: null }],
      isLoading: false,
    };
    expect(renderBanner()).toBe('');
  });

  it('guides linking an owner when no current ownership exists', () => {
    ownersResult.value = { data: [], isLoading: false };
    agreementsResult.value = { data: [], isLoading: false };
    const html = renderBanner();
    expect(html).toContain('العقار غير مرتبط بمالك ساري');
    expect(html).toContain('إكمال بيانات الملكية');
  });

  it('guides creating the management agreement when ownership exists without coverage', () => {
    ownersResult.value = { data: ownerLinks, isLoading: false };
    agreementsResult.value = { data: [], isLoading: false };
    const html = renderBanner();
    expect(html).toContain('لا توجد اتفاقية إدارة سارية');
    expect(html).toContain('إنشاء اتفاقية إدارة');
  });

  it('names the inactive owner when the linked owner is unavailable', () => {
    ownersResult.value = {
      data: [
        {
          ...ownerLinks[0],
          owner: { ...ownerLinks[0].owner, is_active: false },
        },
      ],
      isLoading: false,
    };
    agreementsResult.value = {
      data: [{ starts_on: '2026-01-01', ends_on: null }],
      isLoading: false,
    };
    const html = renderBanner();
    expect(html).toContain('المالك المرتبط غير نشط');
    expect(html).toContain('مالك تجريبي');
    expect(html).toContain('مراجعة الملكية');
  });
});
