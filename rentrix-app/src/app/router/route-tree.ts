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
    // Fix for review thread: don't swallow redirect by having it inside try/catch that catches all
    // Get session in try, handle errors separately, then redirect outside try
    let session: import('@supabase/supabase-js').Session | null = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        // Invalid or expired session - allow access to login page
        return;
      }
      session = data.session;
    } catch {
      // On any error (network etc), allow login page to render to avoid loop
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
      if (error) {
        throw redirect({ to: '/login' });
      }
      if (!data.session) throw redirect({ to: '/login' });
    } catch (err) {
      // Use router's isRedirect guard instead of ad-hoc 'to' in err check
      if (isRedirect(err)) {
        throw err;
      }
      // For any other error (invalid token etc), redirect to login to prevent loop
      throw redirect({ to: '/login' });
    }
  },
  component: lazyRouteComponent(() => import('@/routes/_protected'), 'ProtectedRouteComponent'),
});

const requirePermission = (permission: AppPermission) => async () => {
  const { supabase } = await import('@/lib/supabase');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw redirect({ to: '/login' });
    }
    assertSessionPermission(data.session, permission);
  } catch (err) {
    // Use isRedirect guard to correctly preserve permission-denial redirects
    // Previously used `'to' in err` which is unreliable for TanStack Router v1.139
    // where redirect target is nested in options and identified via isRedirect()
    if (isRedirect(err)) {
      throw err;
    }
    throw redirect({ to: '/login' });
  }
};

const loginRoute = createRoute({ getParentRoute: () => authRoute, path: '/login', component: lazyRouteComponent(() => import('@/routes/_auth.login'), 'LoginRouteComponent'), staticData: { title: 'تسجيل الدخول' } });
const dashboardRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/dashboard', component: lazyRouteComponent(() => import('@/routes/_protected.index'), 'DashboardRouteComponent'), staticData: { title: 'لوحة التحكم' } });
const propertiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties', component: lazyRouteComponent(() => import('@/routes/_protected.properties'), 'PropertiesRouteComponent'), staticData: { title: 'العقارات' } });
const propertyNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/new', beforeLoad: requirePermission('properties.write'), component: lazyRouteComponent(() => import('@/routes/_protected.properties.new'), 'PropertyNewRouteComponent'), staticData: { title: 'إضافة عقار' } });
const propertyDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId'), 'PropertyDetailRouteComponent'), staticData: { title: 'تفاصيل العقار' } });
const propertyIndexRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.index'), 'PropertyOverviewRouteComponent'), staticData: { title: 'نظرة عامة على العقار' } });
const propertyUnitsRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.units'), 'PropertyUnitsRouteComponent'), staticData: { title: 'وحدات العقار' } });
const propertyUnitDetailRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units/$unitId', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.units.$unitId'), 'PropertyUnitDetailRouteComponent'), staticData: { title: 'تفاصيل الوحدة بالعقار' } });
const propertyEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId/edit', beforeLoad: requirePermission('properties.write'), component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.edit'), 'PropertyEditRouteComponent'), staticData: { title: 'تعديل عقار' } });
// Portfolio hub child routes redirect into /properties?section=…
const unitsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/units', beforeLoad: () => { throw redirect({ to: '/properties', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'units' }) }); }, staticData: { title: 'الوحدات' } });
// Relationships hub child routes redirect into /contracts?section=…
const peopleRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people', beforeLoad: () => { throw redirect({ to: '/contracts', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'people' }) }); }, staticData: { title: 'الأشخاص' } });
const tenantsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/tenants', beforeLoad: () => { throw redirect({ to: '/contracts', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'tenants' }) }); }, staticData: { title: 'المستأجرين' } });
const ownersRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners', beforeLoad: async () => { await requirePermission('owners.hub.view')(); throw redirect({ to: '/properties', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'owners' }) }); }, staticData: { title: 'الملاك' } });
const ownerDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners/$ownerId', beforeLoad: requirePermission('owners.detail.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners.$ownerId'), 'OwnerDetailRouteComponent'), staticData: { title: 'ملف المالك' } });
const landsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/lands', beforeLoad: async () => { await requirePermission('lands.view')(); throw redirect({ to: '/properties', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'lands' }) }); }, staticData: { title: 'الأراضي' } });
const leadsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/leads', beforeLoad: async () => { await requirePermission('leads.view')(); throw redirect({ to: '/contracts', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'leads' }) }); }, staticData: { title: 'العملاء المحتملون' } });
const personNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/new', component: lazyRouteComponent(() => import('@/routes/_protected.people.new'), 'PersonNewRouteComponent'), staticData: { title: 'إضافة شخص' } });
const personEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/$personId/edit', component: lazyRouteComponent(() => import('@/routes/_protected.people.$personId.edit'), 'PersonEditRouteComponent'), staticData: { title: 'تعديل شخص' } });
const contractsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts', component: lazyRouteComponent(() => import('@/routes/_protected.contracts'), 'ContractsRouteComponent'), staticData: { title: 'العقود' } });
const contractNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/new', beforeLoad: requirePermission('contracts.write'), component: lazyRouteComponent(() => import('@/routes/_protected.contracts.new'), 'ContractNewRouteComponent'), staticData: { title: 'إنشاء عقد' } });
const contractDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId', component: lazyRouteComponent(() => import('@/routes/_protected.contracts.$contractId'), 'ContractDetailRouteComponent'), staticData: { title: 'تفاصيل العقد' } });
const contractEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId/edit', beforeLoad: requirePermission('contracts.write'), component: lazyRouteComponent(() => import('@/routes/_protected.contracts.$contractId.edit'), 'ContractEditRouteComponent'), staticData: { title: 'تعديل عقد' } });
const financialsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/financials', component: lazyRouteComponent(() => import('@/routes/_protected.financials'), 'FinancialsRouteComponent'), staticData: { title: 'المالية' } });
const communicationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/communication', beforeLoad: async () => { await requirePermission('communication.view')(); throw redirect({ to: '/contracts', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'communication' }) }); }, staticData: { title: 'التواصل' } });
// /automation redirects into the operations hub (automation tab). Permission
// guard is preserved; bookmarks and sidebar child links keep working.
const automationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/automation', beforeLoad: async () => { await requirePermission('automation.view')(); throw redirect({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'automation' }) }); }, staticData: { title: 'مركز الأتمتة' } });

// --- Merged finance hubs (2026-07 UX simplification) ---
// 8 standalone finance destinations (invoices, receipts, expenses, arrears,
// deposits, owner-settlements, bank-reconciliation, commissions) collapsed
// into 4 tabbed hubs. Old routes below now redirect into the matching hub
// so no bookmark or internal <Link to="/invoices"> etc. breaks.
const financeCollectionsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/finance/collections', component: lazyRouteComponent(() => import('@/features/finance-hub/collections-hub-page'), 'CollectionsHubPage'), staticData: { title: 'التحصيل اليومي' } });
const financeExpensesArrearsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/finance/expenses', beforeLoad: requirePermission('expenses.view'), component: lazyRouteComponent(() => import('@/features/finance-hub/expenses-arrears-hub-page'), 'ExpensesArrearsHubPage'), staticData: { title: 'المصروفات والذمم' } });
const financeDepositsSettlementsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/finance/deposits', beforeLoad: requirePermission('financial.deposits.view'), component: lazyRouteComponent(() => import('@/features/finance-hub/deposits-settlements-hub-page'), 'DepositsSettlementsHubPage'), staticData: { title: 'تسويات وضمانات' } });
const financeBankingCommissionsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/finance/banking', beforeLoad: requirePermission('financial.bank_reconciliation.view'), component: lazyRouteComponent(() => import('@/features/finance-hub/banking-commissions-hub-page'), 'BankingCommissionsHubPage'), staticData: { title: 'البنوك والعمولات' } });

const commissionsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/commissions', beforeLoad: async () => { await requirePermission('commissions.view')(); throw redirect({ to: '/finance/banking', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'commissions' }) }); }, staticData: { title: 'العمولات' } });
// /receipts?receiptId=… is the printable single-receipt document, not a hub
// tab: it is a full-bleed A4 surface with its own shell. Only the list view
// redirects into the hub, so print/detail links keep working unchanged.
const receiptsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/receipts', beforeLoad: ({ search }) => { const requestedReceiptId = (search as Record<string, unknown>).receiptId; if (typeof requestedReceiptId === 'string' && requestedReceiptId !== '') return; throw redirect({ to: '/finance/collections', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'receipts' }) }); }, component: lazyRouteComponent(() => import('@/routes/_protected.receipts'), 'ReceiptsRouteComponent'), staticData: { title: 'الإيصالات' } });
const expensesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/expenses', beforeLoad: async () => { await requirePermission('expenses.view')(); throw redirect({ to: '/finance/expenses', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'expenses' }) }); }, staticData: { title: 'المصاريف' } });
const invoicesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/invoices', beforeLoad: () => { throw redirect({ to: '/finance/collections', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'invoices' }) }); }, staticData: { title: 'الفواتير' } });
const arrearsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/arrears', beforeLoad: async () => { await requirePermission('arrears.view')(); throw redirect({ to: '/finance/expenses', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'arrears' }) }); }, staticData: { title: 'المتأخرات' } });
const bankReconciliationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/bank-reconciliation', beforeLoad: async () => { await requirePermission('financial.bank_reconciliation.view')(); throw redirect({ to: '/finance/banking', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'bank_reconciliation' }) }); }, staticData: { title: 'مطابقة البنك' } });
const depositsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/deposits', beforeLoad: async () => { await requirePermission('financial.deposits.view')(); throw redirect({ to: '/finance/deposits', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'deposits' }) }); }, staticData: { title: 'التأمينات' } });
const ownerSettlementsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owner-settlements', beforeLoad: async () => { await requirePermission('financial.owner_settlements.view')(); throw redirect({ to: '/finance/deposits', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'owner_settlements' }) }); }, staticData: { title: 'تسويات الملاك' } });
const accountingRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/accounting', beforeLoad: () => { throw redirect({ to: '/financials' }); }, staticData: { title: 'المالية' } });
const reportsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/reports', component: lazyRouteComponent(() => import('@/routes/_protected.reports'), 'ReportsRouteComponent'), staticData: { title: 'التقارير' } });
const aiAssistantRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/ai-assistant', component: lazyRouteComponent(() => import('@/routes/_protected.ai-assistant'), 'AiAssistantRouteComponent'), staticData: { title: 'مساعد الذكاء الاصطناعي' } });
// Operations child routes redirect into /maintenance?section=… so the hub is
// the single surface. No extra permission beyond authenticated session was
// required on the standalone utilities/documents-vault routes.
const utilitiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/utilities', beforeLoad: () => { throw redirect({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'utilities' }) }); }, staticData: { title: 'المرافق والعدادات' } });
const documentsVaultRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/documents-vault', beforeLoad: () => { throw redirect({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'documents_vault' }) }); }, staticData: { title: 'خزينة المستندات' } });

const systemRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/system',
  beforeLoad: requirePermission('system.view'),
  component: lazyRouteComponent(() => import('@/routes/_protected.system'), 'SystemRouteComponent'),
  staticData: { title: 'النظام والحوكمة' },
});
const auditLogRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/audit-log',
  beforeLoad: requirePermission('audit.view'),
  component: lazyRouteComponent(() => import('@/routes/_protected.audit-log'), 'AuditLogRouteComponent'),
  staticData: { title: 'سجل التدقيق' },
});
const dataIntegrityRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/data-integrity',
  beforeLoad: requirePermission('integrity.view'),
  component: lazyRouteComponent(() => import('@/routes/_protected.data-integrity'), 'DataIntegrityRouteComponent'),
  staticData: { title: 'سلامة البيانات' },
});
const changePasswordRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/change-password',
  beforeLoad: requirePermission('auth.password.change'),
  component: lazyRouteComponent(() => import('@/routes/_protected.change-password'), 'ChangePasswordRouteComponent'),
  staticData: { title: 'تغيير كلمة المرور' },
});
const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings',
  beforeLoad: requirePermission('settings.manage'),
  component: lazyRouteComponent(() => import('@/routes/_protected.settings'), 'SettingsRouteComponent'),
  staticData: { title: 'الإعدادات' },
});
const maintenanceRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/maintenance',
  component: lazyRouteComponent(() => import('@/routes/_protected.maintenance'), 'MaintenanceRouteComponent'),
  staticData: { title: 'مركز التشغيل' },
});

// Public marketing landing is served on the domain root; the authenticated
// dashboard lives at /dashboard and all guards redirect accordingly.
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/routes/landing'), 'LandingRouteComponent'),
  staticData: { title: `${APP_BRAND_NAME} — ${APP_BRAND_TAGLINE_AR}` },
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: lazyRouteComponent(() => import('@/routes/privacy'), 'PrivacyRouteComponent'),
  staticData: { title: 'سياسة الخصوصية' },
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: lazyRouteComponent(() => import('@/routes/terms'), 'TermsRouteComponent'),
  staticData: { title: 'شروط الاستخدام' },
});

// Backward compatibility: old /landing links must land on the public root.
const landingCompatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing',
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});

export const routeTree = rootRoute.addChildren([
  authRoute.addChildren([loginRoute]),
  landingRoute,
  landingCompatRoute,
  privacyRoute,
  termsRoute,
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
    peopleRoute,
    tenantsRoute,
    ownersRoute,
    ownerDetailRoute,
    landsRoute,
    leadsRoute,
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
    communicationRoute,
    automationRoute,
    utilitiesRoute,
    documentsVaultRoute,
    systemRoute,
    auditLogRoute,
    dataIntegrityRoute,
    changePasswordRoute,
    maintenanceRoute,
    settingsRoute,
  ]),
]);
