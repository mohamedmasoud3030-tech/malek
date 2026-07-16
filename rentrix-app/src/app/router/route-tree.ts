import { createRootRoute, createRoute, lazyRouteComponent, redirect, isRedirect } from '@tanstack/react-router';
import { RouteErrorFallback } from '@/components/error-boundary';
import { NotFoundPage } from '@/app/not-found-page';
import { RootRouteComponent } from '@/routes/__root';
import { AuthRouteComponent } from '@/routes/_auth';
import { ProtectedRouteComponent } from '@/routes/_protected';
import type { AppPermission } from '@/features/auth/permissions';
import { assertSessionPermission } from '@/features/auth/route-guards';
import { supabase } from '@/lib/supabase';

const rootRoute = createRootRoute({
  component: RootRouteComponent,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundPage,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: async () => {
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
    if (session) throw redirect({ to: '/' });
  },
  component: AuthRouteComponent,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  beforeLoad: async () => {
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
  component: ProtectedRouteComponent,
});

const requirePermission = (permission: AppPermission) => async () => {
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
const dashboardRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/', component: lazyRouteComponent(() => import('@/routes/_protected.index'), 'DashboardRouteComponent'), staticData: { title: 'لوحة التحكم' } });
const propertiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties', component: lazyRouteComponent(() => import('@/routes/_protected.properties'), 'PropertiesRouteComponent'), staticData: { title: 'العقارات' } });
const propertyNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/new', beforeLoad: requirePermission('properties.write'), component: lazyRouteComponent(() => import('@/routes/_protected.properties.new'), 'PropertyNewRouteComponent'), staticData: { title: 'إضافة عقار' } });
const propertyDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId'), 'PropertyDetailRouteComponent'), staticData: { title: 'تفاصيل العقار' } });
const propertyIndexRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.index'), 'PropertyOverviewRouteComponent'), staticData: { title: 'نظرة عامة على العقار' } });
const propertyUnitsRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.units'), 'PropertyUnitsRouteComponent'), staticData: { title: 'وحدات العقار' } });
const propertyUnitDetailRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units/$unitId', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.units.$unitId'), 'PropertyUnitDetailRouteComponent'), staticData: { title: 'تفاصيل الوحدة بالعقار' } });
const propertyEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId/edit', beforeLoad: requirePermission('properties.write'), component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.edit'), 'PropertyEditRouteComponent'), staticData: { title: 'تعديل عقار' } });
const unitsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/units', component: lazyRouteComponent(() => import('@/routes/_protected.units'), 'UnitsRouteComponent'), staticData: { title: 'الوحدات' } });
const peopleRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people', component: lazyRouteComponent(() => import('@/routes/_protected.people'), 'PeopleRouteComponent'), staticData: { title: 'الأشخاص' } });
const tenantsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/tenants', component: lazyRouteComponent(() => import('@/routes/_protected.tenants'), 'TenantsRouteComponent'), staticData: { title: 'المستأجرين' } });
const ownersRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners', beforeLoad: requirePermission('owners.hub.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners'), 'OwnersRouteComponent'), staticData: { title: 'الملاك' } });
const ownerDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners/$ownerId', beforeLoad: requirePermission('owners.detail.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners.$ownerId'), 'OwnerDetailRouteComponent'), staticData: { title: 'ملف المالك' } });
const landsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/lands', beforeLoad: requirePermission('lands.view'), component: lazyRouteComponent(() => import('@/routes/_protected.lands'), 'LandsRouteComponent'), staticData: { title: 'الأراضي' } });
const leadsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/leads', beforeLoad: requirePermission('leads.view'), component: lazyRouteComponent(() => import('@/routes/_protected.leads'), 'LeadsRouteComponent'), staticData: { title: 'العملاء المحتملون' } });
const personNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/new', component: lazyRouteComponent(() => import('@/routes/_protected.people.new'), 'PersonNewRouteComponent'), staticData: { title: 'إضافة شخص' } });
const personEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/$personId/edit', component: lazyRouteComponent(() => import('@/routes/_protected.people.$personId.edit'), 'PersonEditRouteComponent'), staticData: { title: 'تعديل شخص' } });
const contractsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts', component: lazyRouteComponent(() => import('@/routes/_protected.contracts'), 'ContractsRouteComponent'), staticData: { title: 'العقود' } });
const contractNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/new', beforeLoad: requirePermission('contracts.write'), component: lazyRouteComponent(() => import('@/routes/_protected.contracts.new'), 'ContractNewRouteComponent'), staticData: { title: 'إنشاء عقد' } });
const contractDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId', component: lazyRouteComponent(() => import('@/routes/_protected.contracts.$contractId'), 'ContractDetailRouteComponent'), staticData: { title: 'تفاصيل العقد' } });
const contractEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId/edit', beforeLoad: requirePermission('contracts.write'), component: lazyRouteComponent(() => import('@/routes/_protected.contracts.$contractId.edit'), 'ContractEditRouteComponent'), staticData: { title: 'تعديل عقد' } });
const financialsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/financials', component: lazyRouteComponent(() => import('@/routes/_protected.financials'), 'FinancialsRouteComponent'), staticData: { title: 'المالية' } });
const commissionsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/commissions', beforeLoad: requirePermission('commissions.view'), component: lazyRouteComponent(() => import('@/routes/_protected.commissions'), 'CommissionsRouteComponent'), staticData: { title: 'العمولات' } });
const communicationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/communication', beforeLoad: requirePermission('communication.view'), component: lazyRouteComponent(() => import('@/routes/_protected.communication'), 'CommunicationRouteComponent'), staticData: { title: 'التواصل' } });
const automationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/automation', beforeLoad: requirePermission('communication.view'), component: lazyRouteComponent(() => import('@/routes/_protected.automation'), 'AutomationRouteComponent'), staticData: { title: 'مركز الأتمتة' } });
const receiptsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/receipts', component: lazyRouteComponent(() => import('@/routes/_protected.receipts'), 'ReceiptsRouteComponent'), staticData: { title: 'إيصال الدفع' } });
const expensesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/expenses', beforeLoad: requirePermission('expenses.write'), component: lazyRouteComponent(() => import('@/routes/_protected.expenses'), 'ExpensesRouteComponent'), staticData: { title: 'المصاريف' } });
const invoicesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/invoices', component: lazyRouteComponent(() => import('@/routes/_protected.invoices'), 'InvoicesRouteComponent'), staticData: { title: 'الفواتير' } });
const arrearsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/arrears', beforeLoad: requirePermission('arrears.view'), component: lazyRouteComponent(() => import('@/routes/_protected.arrears'), 'ArrearsRouteComponent'), staticData: { title: 'المتأخرات' } });
const bankReconciliationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/bank-reconciliation', beforeLoad: requirePermission('financial.bank_reconciliation.view'), component: lazyRouteComponent(() => import('@/routes/_protected.bank-reconciliation'), 'BankReconciliationRouteComponent'), staticData: { title: 'مطابقة البنك' } });
const accountingRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/accounting', beforeLoad: () => { throw redirect({ to: '/financials' }); }, staticData: { title: 'المالية' } });
const reportsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/reports', component: lazyRouteComponent(() => import('@/routes/_protected.reports'), 'ReportsRouteComponent'), staticData: { title: 'التقارير' } });
const aiAssistantRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/ai-assistant', component: lazyRouteComponent(() => import('@/routes/_protected.ai-assistant'), 'AiAssistantRouteComponent'), staticData: { title: 'مساعد الذكاء الاصطناعي' } });
const utilitiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/utilities', component: lazyRouteComponent(() => import('@/routes/_protected.utilities'), 'UtilitiesRouteComponent'), staticData: { title: 'المرافق والعدادات' } });
const documentsVaultRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/documents-vault', component: lazyRouteComponent(() => import('@/routes/_protected.documents-vault'), 'DocumentsVaultRouteComponent'), staticData: { title: 'خزينة المستندات' } });

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
  beforeLoad: requirePermission('maintenance.view'),
  component: lazyRouteComponent(() => import('@/routes/_protected.maintenance'), 'MaintenanceRouteComponent'),
  staticData: { title: 'الصيانة' },
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing',
  component: lazyRouteComponent(() => import('@/routes/landing'), 'LandingRouteComponent'),
  staticData: { title: 'Rentrix — نظام إدارة العقارات' },
});

export const routeTree = rootRoute.addChildren([
  authRoute.addChildren([loginRoute]),
  landingRoute,
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
    commissionsRoute,
    receiptsRoute,
    expensesRoute,
    invoicesRoute,
    arrearsRoute,
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
