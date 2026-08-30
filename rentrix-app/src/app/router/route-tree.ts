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
const dashboardRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/dashboard', component: lazyRouteComponent(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage'), staticData: { title: 'لوحة التحكم' } });
const propertiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties', component: lazyRouteComponent(() => import('@/features/portfolio-hub/portfolio-hub-workspace'), 'PortfolioHubPage'), staticData: { title: 'العقارات' } });
const propertyNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/new', beforeLoad: requirePermission('properties.create'), component: lazyRouteComponent(() => import('@/features/properties/property-form-page'), 'PropertyFormPage'), staticData: { title: 'إضافة عقار' } });
const propertyDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId', component: lazyRouteComponent(() => import('@/features/properties/property-detail-page'), 'PropertyDetailPage'), staticData: { title: 'تفاصيل العقار' } });
const propertyIndexRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/', component: lazyRouteComponent(() => import('@/features/properties/overview/property-overview-page'), 'PropertyOverview'), staticData: { title: 'نظرة عامة على العقار' } });
const propertyUnitsRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units', component: lazyRouteComponent(() => import('@/features/properties/property-detail-page'), 'PropertyUnitsPage'), staticData: { title: 'وحدات العقار' } });
const propertyUnitDetailRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units/$unitId', component: lazyRouteComponent(() => import('@/features/properties/units/property-unit-detail-page'), 'PropertyUnitDetailPage'), staticData: { title: 'تفاصيل الوحدة بالعقار' } });
const propertyEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId/edit', beforeLoad: requirePermission('properties.edit'), component: lazyRouteComponent(() => import('@/features/properties/property-form-page'), 'PropertyFormPage'), staticData: { title: 'تعديل عقار' } });

// Asset-supporting routes: units stays inside property workspace; lands is now first-class standalone (Phase 2).
const unitsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/units', beforeLoad: () => { throw redirect({ to: '/properties', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'units' }) }); }, staticData: { title: 'الوحدات' } });
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
  staticData: { title: 'المالية' }
});

// Finance operational detail routes remain available behind one primary Finance entry.
const financeCollectionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/finance/collections',
  beforeLoad: ({ search }) => {
    const section = (search as Record<string, unknown>).section;
    const view = section === 'receipts' ? 'receipts' : 'invoices';
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'collections', view })
    });
  },
  staticData: { title: 'التحصيل والفواتير' }
});

const financeExpensesArrearsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/finance/expenses',
  beforeLoad: async ({ search }) => {
    await requirePermission('expenses.view')();
    const section = (search as Record<string, unknown>).section;
    if (section === 'arrears') {
      throw redirect({
        to: '/financials',
        search: (previous: Record<string, unknown>) => ({ ...previous, section: 'collections', view: 'arrears' })
      });
    }
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'expenses', view: 'expenses' })
    });
  },
  staticData: { title: 'المصروفات والمتأخرات' }
});

const financeDepositsSettlementsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/finance/deposits',
  beforeLoad: async ({ search }) => {
    await requirePermission('financial.deposits.view')();
    const section = (search as Record<string, unknown>).section;
    const view = section === 'owner_settlements' ? 'owner_settlements' : 'deposits';
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'funds', view })
    });
  },
  staticData: { title: 'التأمينات وتسويات الملاك' }
});

const financeBankingCommissionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/finance/banking',
  beforeLoad: async ({ search }) => {
    await requirePermission('financial.bank_reconciliation.view')();
    const section = (search as Record<string, unknown>).section;
    if (section === 'commissions') {
      throw redirect({ to: '/commissions' });
    }
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'banking', view: 'bank_reconciliation' })
    });
  },
  staticData: { title: 'البنوك' }
});

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
  component: lazyRouteComponent(() => import('@/features/financials/receipts/receipts-page'), 'ReceiptsPage'),
  staticData: { title: 'الإيصالات' }
});

const expensesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/expenses',
  beforeLoad: async ({ search }) => {
    await requirePermission('expenses.view')();
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...(search as Record<string, unknown>), section: 'expenses', view: 'expenses' })
    });
  },
  staticData: { title: 'المصروفات' }
});

const invoicesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/invoices',
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...(search as Record<string, unknown>), section: 'collections', view: 'invoices' })
    });
  },
  staticData: { title: 'الفواتير' }
});

const arrearsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/arrears',
  beforeLoad: async () => {
    await requirePermission('arrears.view')();
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'collections', view: 'arrears' })
    });
  },
  staticData: { title: 'المتأخرات' }
});

const bankReconciliationRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/bank-reconciliation',
  beforeLoad: async () => {
    await requirePermission('financial.bank_reconciliation.view')();
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'banking' })
    });
  },
  staticData: { title: 'المطابقة البنكية' }
});

const depositsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/deposits',
  beforeLoad: async () => {
    await requirePermission('financial.deposits.view')();
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'funds', view: 'deposits' })
    });
  },
  staticData: { title: 'التأمينات' }
});

const ownerSettlementsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/owner-settlements',
  beforeLoad: async () => {
    await requirePermission('financial.owner_settlements.view')();
    throw redirect({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'funds', view: 'owner_settlements' })
    });
  },
  staticData: { title: 'تسويات الملاك' }
});

const accountingRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/accounting',
  beforeLoad: () => {
    throw redirect({
      to: '/reports',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'accounting', view: 'general_ledger' })
    });
  },
  staticData: { title: 'المحاسبة والتقارير' }
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

const automationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/automation', beforeLoad: async () => { await requirePermission('automation.view')(); throw redirect({ to: '/settings', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'automation' }) }); }, staticData: { title: 'الأتمتة' } });
const utilitiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/utilities', beforeLoad: () => { throw redirect({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'utilities' }) }); }, staticData: { title: 'المرافق والعدادات' } });
// Legacy compatibility only: retained for old bookmarks, never exposed in product navigation.
// Redirects to the single approved authority: the documents vault tab inside Operations Hub.
const documentsVaultRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/documents-vault',
  beforeLoad: () => {
    throw redirect({
      to: '/maintenance',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: 'documents_vault' }),
    });
  },
  staticData: { title: 'المستندات — توافق قديم' },
});

const settingsLegacyRedirect = (permission: AppPermission, section: string) => async () => {
  await requirePermission(permission)();
  throw redirect({
    to: '/settings',
    search: (previous: Record<string, unknown>) => ({ ...previous, section }),
  });
};
const systemRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/system', beforeLoad: settingsLegacyRedirect('system.view', 'system-settings'), staticData: { title: 'النظام والحوكمة' } });
const auditLogRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/audit-log', beforeLoad: settingsLegacyRedirect('audit.view', 'audit-log'), staticData: { title: 'سجل التدقيق' } });
const dataIntegrityRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/data-integrity', beforeLoad: settingsLegacyRedirect('integrity.view', 'data-integrity'), staticData: { title: 'سلامة البيانات' } });
const changePasswordRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/change-password', beforeLoad: settingsLegacyRedirect('auth.password.change', 'security'), staticData: { title: 'تغيير كلمة المرور' } });
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
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: lazyRouteComponent(() => import('@/routes/privacy'), 'PrivacyRouteComponent'), staticData: { title: 'سياسة الخصوصية' } });
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: lazyRouteComponent(() => import('@/routes/terms'), 'TermsRouteComponent'), staticData: { title: 'شروط الاستخدام' } });
// Public-safe support destination for unauthenticated visitors (login/forgot
// password). Renders only static contact channels — no auth, Supabase, or
// support-ticket intake. The full authenticated support workspace stays at
// /help under protectedRoute.
const publicSupportRoute = createRoute({ getParentRoute: () => rootRoute, path: '/support', component: lazyRouteComponent(() => import('@/features/help-support/public-support-page'), 'PublicSupportPage'), staticData: { title: 'الدعم والتواصل' } });
const landingCompatRoute = createRoute({ getParentRoute: () => rootRoute, path: '/landing', beforeLoad: () => { throw redirect({ to: '/' }); } });
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
  landingCompatRoute,
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
    unitsRoute,
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
    financeCollectionsRoute,
    financeExpensesArrearsRoute,
    financeDepositsSettlementsRoute,
    financeBankingCommissionsRoute,
    commissionsRoute,
    receiptsRoute,
    expensesRoute,
    invoicesRoute,
    arrearsRoute,
    depositsRoute,
    ownerSettlementsRoute,
    bankReconciliationRoute,
    accountingRoute,
    reportsRoute,
    aiAssistantRoute,
    helpSupportRoute,
    adminSupportRoute,
    automationRoute,
    utilitiesRoute,
    documentsVaultRoute,
    systemRoute,
    auditLogRoute,
    dataIntegrityRoute,
    changePasswordRoute,
    maintenanceRoute,
    serviceProvidersRoute,
    serviceProviderNewRoute,
    serviceProviderDetailRoute,
    serviceProviderEditRoute,
    settingsRoute,
  ]),
]);