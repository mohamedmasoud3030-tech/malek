import { createRootRoute, createRoute, lazyRouteComponent, redirect, isRedirect } from '@tanstack/react-router';
import { RouteErrorFallback } from '@/components/error-boundary';
import { NotFoundPage } from '@/app/not-found-page';
import { RootRouteComponent } from '@/routes/__root';
import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';
import type { AppPermission } from '@/features/auth/permissions';
import { assertSessionPermission } from '@/features/auth/route-guards';

const rootRoute = createRootRoute({
  component: RootRouteComponent,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundPage,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: async () => {
    const { supabase } = await import('@/lib/supabase');
    let session: import('@supabase/supabase-js').Session | null = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return;
      session = data.session;
    } catch {
      return;
    }
    if (session) throw redirect({ to: '/dashboard' });
  },
  component: lazyRouteComponent(() => import('@/routes/_auth'), 'AuthRouteComponent'),
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  beforeLoad: async () => {
    const { supabase } = await import('@/lib/supabase');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw redirect({ to: '/login' });
      if (!data.session) throw redirect({ to: '/login' });
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: '/login' });
    }
  },
  component: lazyRouteComponent(() => import('@/routes/_protected'), 'ProtectedRouteComponent'),
});

const requirePermission = (permission: AppPermission) => async () => {
  const { supabase } = await import('@/lib/supabase');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw redirect({ to: '/login' });
    await assertSessionPermission(data.session, permission);
  } catch (err) {
    if (isRedirect(err)) throw err;
    throw redirect({ to: '/login' });
  }
};

const loginRoute = createRoute({ getParentRoute: () => authRoute, path: '/login', component: lazyRouteComponent(() => import('@/routes/_auth.login'), 'LoginRouteComponent'), staticData: { title: 'تسجيل الدخول' } });
const forgotPasswordRoute = createRoute({ getParentRoute: () => authRoute, path: '/forgot-password', component: lazyRouteComponent(() => import('@/features/auth/password-recovery-page'), 'ForgotPasswordPage'), staticData: { title: 'استعادة كلمة المرور' } });
const resetPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: lazyRouteComponent(() => import('@/features/auth/password-recovery-page'), 'ResetPasswordPage'), staticData: { title: 'تعيين كلمة مرور جديدة' } });
const dashboardRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/dashboard', component: lazyRouteComponent(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage'), staticData: { title: 'اليوم' } });
const propertiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties', component: lazyRouteComponent(() => import('@/features/portfolio-hub/portfolio-hub-workspace'), 'PortfolioHubPage'), staticData: { title: 'العقارات' } });
const propertyNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/new', beforeLoad: requirePermission('properties.create'), component: lazyRouteComponent(() => import('@/features/properties/property-form-page'), 'PropertyFormPage'), staticData: { title: 'إضافة عقار' } });
const propertyDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId', component: lazyRouteComponent(() => import('@/features/properties/property-detail-page'), 'PropertyDetailPage'), staticData: { title: 'تفاصيل العقار' } });
const propertyIndexRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/', component: lazyRouteComponent(() => import('@/features/properties/overview/property-overview-page'), 'PropertyOverview'), staticData: { title: 'نظرة عامة على العقار' } });
const propertyUnitsRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units', component: lazyRouteComponent(() => import('@/features/properties/property-detail-page'), 'PropertyUnitsPage'), staticData: { title: 'وحدات العقار' } });
const propertyUnitDetailRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units/$unitId', component: lazyRouteComponent(() => import('@/features/properties/units/property-unit-detail-page'), 'PropertyUnitDetailPage'), staticData: { title: 'تفاصيل الوحدة بالعقار' } });
const propertyEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId/edit', beforeLoad: requirePermission('properties.edit'), component: lazyRouteComponent(() => import('@/features/properties/property-form-page'), 'PropertyFormPage'), staticData: { title: 'تعديل عقار' } });

const landsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/lands', beforeLoad: requirePermission('lands.view'), component: lazyRouteComponent(() => import('@/features/lands/lands-page'), 'LandsWorkspace'), staticData: { title: 'الأراضي' } });
const landDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/lands/$landId', beforeLoad: requirePermission('lands.view'), component: lazyRouteComponent(() => import('@/routes/_protected.lands.$landId'), 'LandDetailRouteComponent'), staticData: { title: 'ملف الأرض' } });

// Owners and tenants are core entities with first-class standalone routes.
const ownersRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners', beforeLoad: requirePermission('owners.hub.view'), component: lazyRouteComponent(() => import('@/features/owners/OwnersPage'), 'OwnersWorkspace'), staticData: { title: 'الملاك' } });
const ownerDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners/$ownerId', beforeLoad: requirePermission('owners.detail.view'), component: lazyRouteComponent(() => import('@/features/owners/owner-detail-page'), 'OwnerDetailPage'), staticData: { title: 'ملف المالك' } });
const ownerEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners/$ownerId/edit', beforeLoad: requirePermission('owners.hub.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners.$ownerId.edit'), 'OwnerEditRouteComponent'), staticData: { title: 'تعديل مالك' } });
const tenantsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/tenants', component: lazyRouteComponent(() => import('@/features/tenants/TenantsPage'), 'TenantsWorkspace'), staticData: { title: 'المستأجرون' } });
const tenantDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/tenants/$tenantId', component: lazyRouteComponent(() => import('@/features/tenants/components/TenantPreviewDialog'), 'TenantDetailPage'), staticData: { title: 'ملف المستأجر' } });

// People directory is now first-class standalone (Phase 2). Legacy contracts?section=people redirects via hub.
const peopleRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people', component: lazyRouteComponent(() => import('@/features/people/people-list-page'), 'PeopleListPage'), staticData: { title: 'جهات التعامل' } });
const leadsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/leads', beforeLoad: requirePermission('leads.view'), component: lazyRouteComponent(() => import('@/features/leads/leads-page'), 'LeadsPage'), staticData: { title: 'العملاء المحتملون' } });
const communicationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/communication', beforeLoad: requirePermission('communication.view'), component: lazyRouteComponent(() => import('@/features/communication/communication-page'), 'CommunicationPage'), staticData: { title: 'التواصل' } });
const personDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/$personId', component: lazyRouteComponent(() => import('@/features/people/components/PersonDossier'), 'PersonDetailPage'), staticData: { title: 'ملف الشخص' } });
const personNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/new', beforeLoad: requirePermission('contracts.create'), component: lazyRouteComponent(() => import('@/routes/_protected.people.new'), 'PersonNewRouteComponent'), staticData: { title: 'إضافة شخص' } });
const personEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/$personId/edit', beforeLoad: requirePermission('contracts.edit'), component: lazyRouteComponent(() => import('@/routes/_protected.people.$personId.edit'), 'PersonEditRouteComponent'), staticData: { title: 'تعديل شخص' } });
const contractsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/contracts',
  beforeLoad: ({ search }) => {
    const legacySection = (search as Record<string, unknown>).section;
    const legacyTarget = legacySection === 'people'
      ? '/people'
      : legacySection === 'tenants'
        ? '/tenants'
        : legacySection === 'leads'
          ? '/leads'
          : legacySection === 'communication'
            ? '/communication'
            : null;
    if (legacyTarget) {
      throw redirect({
        to: legacyTarget,
        search: (previous: Record<string, unknown>) => {
          const next = { ...previous };
          delete next.section;
          return next;
        },
      });
    }
  },
  component: lazyRouteComponent(() => import('@/features/relationships-hub/leasing-hub-workspace'), 'LeasingHubPage'),
  staticData: { title: 'العقود' },
});
const contractNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/new', beforeLoad: requirePermission('contracts.create'), component: lazyRouteComponent(() => import('@/features/contracts/ContractFormPage'), 'ContractFormPage'), staticData: { title: 'إنشاء عقد' } });
const contractDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId', component: lazyRouteComponent(() => import('@/features/contracts/pages/ContractDetailPage'), 'ContractDetailPage'), staticData: { title: 'تفاصيل العقد' } });
const contractEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId/edit', beforeLoad: requirePermission('contracts.edit'), component: lazyRouteComponent(() => import('@/features/contracts/ContractFormPage'), 'ContractFormPage'), staticData: { title: 'تعديل عقد' } });

const financialsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/financials',
  component: lazyRouteComponent(() => import('@/features/finance/FinancePage'), 'FinancePage'),
  staticData: { title: 'المال' }
});

// Finance operational detail routes resolve through one primary Money hub
// entry so every Money capability shares one canonical implementation.
const commissionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/commissions',
  beforeLoad: requirePermission('commissions.view'),
  component: lazyRouteComponent(() => import('@/features/commissions/commissions-page'), 'CommissionsWorkspace'),
  staticData: { title: 'العمولات' }
});

const receiptsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/receipts',
  beforeLoad: ({ search }) => {
    const requestedReceiptId = (search as Record<string, unknown>).receiptId;
    if (typeof requestedReceiptId === 'string' && requestedReceiptId !== '') return;
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...(search as Record<string, unknown>), section: 'collections', view: 'receipts' })
    });
  },
  component: lazyRouteComponent(() => import('@/features/financials/receipts/receipts-page'), 'ReceiptsWorkspace'),
  staticData: { title: 'الإيصالات' }
});

const reportsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/reports',
  // Route-level guard matching the nav item permission and the page's own
  // AccessDenied gate: viewing reports requires financial.reports.view; the
  // export capability remains a separate action permission (R5).
  // to the dashboard instead of being shown a permission-denied page from a
  // nav entry they can see.
  beforeLoad: requirePermission('financial.reports.view'),
  component: lazyRouteComponent(() => import('@/features/reports/reports-page'), 'ReportsPage'),
  staticData: { title: 'المحاسبة والتقارير' }
});
const reportProductRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/reports/$reportId',
  // Same guard as the reports catalog: opening a premium report product is
  // report viewing; print/PDF/Excel stay behind the separate export
  // permission inside the page.
  beforeLoad: requirePermission('financial.reports.view'),
  component: lazyRouteComponent(() => import('@/features/reports/premium/report-product-page'), 'ReportProductPage'),
  staticData: { title: 'تقرير' }
});
const aiAssistantRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/ai-assistant',
  component: lazyRouteComponent(() => import('@/features/ai-assistant/ai-assistant-page'), 'AiAssistantPage'),
  staticData: { title: 'المساعد الذكي' },
});
const helpSupportRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/help',
  component: lazyRouteComponent(() => import('@/features/help-support/help-support-page'), 'HelpSupportPage'),
  staticData: { title: 'المساعدة والدعم' },
});
const adminSupportRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/admin-support',
  beforeLoad: requirePermission('support.operations.view'),
  component: lazyRouteComponent(() => import('@/features/admin-support/admin-support-page'), 'AdminSupportOperationsPage'),
  staticData: { title: 'عمليات الدعم والتحقيق' },
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('@/features/governance-hub/components/GovernanceHubWorkspace'), 'GovernanceHubWorkspace'),
  staticData: { title: 'الإعدادات' },
});
const serviceProvidersRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/service-providers', beforeLoad: requirePermission('service_providers.view'), component: lazyRouteComponent(() => import('@/features/service-providers/service-providers-page'), 'ServiceProvidersPage'), staticData: { title: 'مزودو الخدمات' } });
const serviceProviderNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/service-providers/new', beforeLoad: requirePermission('service_providers.write'), component: lazyRouteComponent(() => import('@/routes/_protected.service-providers.new'), 'ServiceProviderNewRouteComponent'), staticData: { title: 'إضافة مزود خدمة' } });
const serviceProviderDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/service-providers/$providerId', beforeLoad: requirePermission('service_providers.view'), component: lazyRouteComponent(() => import('@/features/service-providers/service-provider-detail-page'), 'ServiceProviderDetailPage'), staticData: { title: 'ملف مزود الخدمة' } });
const serviceProviderEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/service-providers/$providerId/edit', beforeLoad: requirePermission('service_providers.write'), component: lazyRouteComponent(() => import('@/routes/_protected.service-providers.$providerId.edit'), 'ServiceProviderEditRouteComponent'), staticData: { title: 'تعديل مزود الخدمة' } });
const maintenanceRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/maintenance',
  component: lazyRouteComponent(() => import('@/routes/_protected.maintenance'), 'MaintenanceRouteComponent'),
  staticData: { title: 'التشغيل والصيانة' },
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/routes/landing'), 'LandingRouteComponent'),
  staticData: { title: `${APP_BRAND_NAME} — ${APP_BRAND_TAGLINE_AR}` },
});

// Tenant Portal: a separate constrained read-only surface. It intentionally
// lives OUTSIDE the office protected shell (no office navigation, no office
// permissions) and authorizes only through tenant-specific claims.
const tenantPortalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tenant-portal',
  component: lazyRouteComponent(() => import('@/features/tenant-portal/tenant-portal-page'), 'TenantPortalPage'),
  staticData: { title: 'بوابة المستأجر' },
});
// Owner Portal: an isolated read-only owner-facing surface. Like the tenant
// portal it lives OUTSIDE the office protected shell (no office navigation,
// no office permissions). The exported bearer token in the URL is the only
// external scope input; owner/company scope is resolved server-side by
// get_owner_portal_snapshot.
const ownerPortalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/owner-portal',
  component: lazyRouteComponent(() => import('@/features/owner-portal/owner-portal-page'), 'OwnerPortalPage'),
  staticData: { title: 'بوابة مالك العقار' },
});
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: lazyRouteComponent(() => import('@/routes/privacy'), 'PrivacyRouteComponent'), staticData: { title: 'سياسة الخصوصية' } });
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: lazyRouteComponent(() => import('@/routes/terms'), 'TermsRouteComponent'), staticData: { title: 'شروط الاستخدام' } });
// Public-safe support destination for unauthenticated visitors (login/forgot
// password). Renders only static contact channels — no auth, Supabase, or
// support-ticket intake. The full authenticated support workspace stays at
// /help under protectedRoute.
const publicSupportRoute = createRoute({ getParentRoute: () => rootRoute, path: '/support', component: lazyRouteComponent(() => import('@/features/help-support/public-support-page'), 'PublicSupportPage'), staticData: { title: 'الدعم والتواصل' } });
const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/design-system',
  beforeLoad: () => { if (!import.meta.env.DEV) throw redirect({ to: '/' }); },
  component: import.meta.env.DEV
    ? lazyRouteComponent(() => import('@/features/design-system/design-system-showcase'), 'DesignSystemShowcase')
    : () => null,
  staticData: { title: 'MALEK Design System' },
});

export const routeTree = rootRoute.addChildren([
  authRoute.addChildren([loginRoute, forgotPasswordRoute]),
  resetPasswordRoute,
  landingRoute,
  tenantPortalRoute,
  ownerPortalRoute,
  privacyRoute,
  termsRoute,
  publicSupportRoute,
  designSystemRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    propertiesRoute,
    propertyNewRoute,
    propertyDetailRoute.addChildren([
      propertyIndexRoute,
      propertyUnitsRoute,
      propertyUnitDetailRoute,
    ]),
    propertyEditRoute,
    landsRoute,
    landDetailRoute,
    ownersRoute,
    ownerDetailRoute,
    ownerEditRoute,
    tenantsRoute,
    tenantDetailRoute,
    peopleRoute,
    leadsRoute,
    communicationRoute,
    personDetailRoute,
    personNewRoute,
    personEditRoute,
    contractsRoute,
    contractNewRoute,
    contractDetailRoute,
    contractEditRoute,
    financialsRoute,
    commissionsRoute,
    receiptsRoute,
    reportsRoute,
    reportProductRoute,
    aiAssistantRoute,
    helpSupportRoute,
    adminSupportRoute,
    maintenanceRoute,
    serviceProvidersRoute,
    serviceProviderNewRoute,
    serviceProviderDetailRoute,
    serviceProviderEditRoute,
    settingsRoute,
  ]),
]);
