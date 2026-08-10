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
const dashboardRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/dashboard', component: lazyRouteComponent(() => import('@/routes/_protected.index'), 'DashboardRouteComponent'), staticData: { title: 'لوحة التحكم' } });
const propertiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties', component: lazyRouteComponent(() => import('@/routes/_protected.properties'), 'PropertiesRouteComponent'), staticData: { title: 'العقارات' } });
const propertyNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/new', beforeLoad: requirePermission('properties.write'), component: lazyRouteComponent(() => import('@/routes/_protected.properties.new'), 'PropertyNewRouteComponent'), staticData: { title: 'إضافة عقار' } });
const propertyDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId'), 'PropertyDetailRouteComponent'), staticData: { title: 'تفاصيل العقار' } });
const propertyIndexRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.index'), 'PropertyOverviewRouteComponent'), staticData: { title: 'نظرة عامة على العقار' } });
const propertyUnitsRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.units'), 'PropertyUnitsRouteComponent'), staticData: { title: 'وحدات العقار' } });
const propertyUnitDetailRoute = createRoute({ getParentRoute: () => propertyDetailRoute, path: '/units/$unitId', component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.units.$unitId'), 'PropertyUnitDetailRouteComponent'), staticData: { title: 'تفاصيل الوحدة بالعقار' } });
const propertyEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/properties/$propertyId/edit', beforeLoad: requirePermission('properties.write'), component: lazyRouteComponent(() => import('@/routes/_protected.properties.$propertyId.edit'), 'PropertyEditRouteComponent'), staticData: { title: 'تعديل عقار' } });

// Asset-supporting routes: units stays inside property workspace; lands is now first-class standalone (Phase 2).
const unitsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/units', beforeLoad: () => { throw redirect({ to: '/properties', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'units' }) }); }, staticData: { title: 'الوحدات' } });
const landsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/lands', beforeLoad: requirePermission('lands.view'), component: lazyRouteComponent(() => import('@/routes/_protected.lands'), 'LandsRouteComponent'), staticData: { title: 'الأراضي' } });
const landDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/lands/$landId', beforeLoad: requirePermission('lands.view'), component: lazyRouteComponent(() => import('@/routes/_protected.lands.$landId'), 'LandDetailRouteComponent'), staticData: { title: 'ملف الأرض' } });

// Owners and tenants are core entities with first-class standalone routes.
const ownersRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners', beforeLoad: requirePermission('owners.hub.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners'), 'OwnersRouteComponent'), staticData: { title: 'الملاك' } });
const ownerDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners/$ownerId', beforeLoad: requirePermission('owners.detail.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners.$ownerId'), 'OwnerDetailRouteComponent'), staticData: { title: 'ملف المالك' } });
const ownerEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/owners/$ownerId/edit', beforeLoad: requirePermission('owners.hub.view'), component: lazyRouteComponent(() => import('@/routes/_protected.owners.$ownerId.edit'), 'OwnerEditRouteComponent'), staticData: { title: 'تعديل مالك' } });
const tenantsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/tenants', component: lazyRouteComponent(() => import('@/routes/_protected.tenants'), 'TenantsRouteComponent'), staticData: { title: 'المستأجرون' } });
const tenantDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/tenants/$tenantId', component: lazyRouteComponent(() => import('@/routes/_protected.tenants.$tenantId'), 'TenantDetailRouteComponent'), staticData: { title: 'ملف المستأجر' } });

// People directory is now first-class standalone (Phase 2). Legacy contracts?section=people redirects via hub.
const peopleRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people', component: lazyRouteComponent(() => import('@/routes/_protected.people'), 'PeopleRouteComponent'), staticData: { title: 'جهات التعامل' } });
const leadsRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/leads', beforeLoad: requirePermission('leads.view'), component: lazyRouteComponent(() => import('@/routes/_protected.leads'), 'LeadsRouteComponent'), staticData: { title: 'العملاء المحتملون' } });
const communicationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/communication', beforeLoad: requirePermission('communication.view'), component: lazyRouteComponent(() => import('@/routes/_protected.communication'), 'CommunicationRouteComponent'), staticData: { title: 'التواصل' } });
const personDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/$personId', component: lazyRouteComponent(() => import('@/routes/_protected.people.$personId'), 'PersonDetailRouteComponent'), staticData: { title: 'ملف الشخص' } });
const personNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/new', component: lazyRouteComponent(() => import('@/routes/_protected.people.new'), 'PersonNewRouteComponent'), staticData: { title: 'إضافة شخص' } });
const personEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/people/$personId/edit', component: lazyRouteComponent(() => import('@/routes/_protected.people.$personId.edit'), 'PersonEditRouteComponent'), staticData: { title: 'تعديل شخص' } });
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
  component: lazyRouteComponent(() => import('@/routes/_protected.contracts'), 'ContractsRouteComponent'),
  staticData: { title: 'العقود' },
});
const contractNewRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/new', beforeLoad: requirePermission('contracts.write'), component: lazyRouteComponent(() => import('@/routes/_protected.contracts.new'), 'ContractNewRouteComponent'), staticData: { title: 'إنشاء عقد' } });
const contractDetailRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId', component: lazyRouteComponent(() => import('@/routes/_protected.contracts.$contractId'), 'ContractDetailRouteComponent'), staticData: { title: 'تفاصيل العقد' } });
const contractEditRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/contracts/$contractId/edit', beforeLoad: requirePermission('contracts.write'), component: lazyRouteComponent(() => import('@/routes/_protected.contracts.$contractId.edit'), 'ContractEditRouteComponent'), staticData: { title: 'تعديل عقد' } });

const financialsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/financials',
  component: lazyRouteComponent(() => import('@/routes/_protected.financials'), 'FinancialsRouteComponent'),
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
  component: lazyRouteComponent(() => import('@/routes/_protected.commissions'), 'CommissionsRouteComponent'),
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
  component: lazyRouteComponent(() => import('@/routes/_protected.receipts'), 'ReceiptsRouteComponent'),
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
  component: lazyRouteComponent(() => import('@/routes/_protected.reports'), 'ReportsRouteComponent'),
  staticData: { title: 'المحاسبة والتقارير' }
});
const aiAssistantRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/ai-assistant',
  beforeLoad: () => {
    throw redirect({
      to: '/dashboard',
      search: (previous: Record<string, unknown>) => ({ ...previous, globalAction: 'ai-assistant' }),
    });
  },
  staticData: { title: 'المساعد الذكي' },
});

const automationRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/automation', beforeLoad: async () => { await requirePermission('automation.view')(); throw redirect({ to: '/settings', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'automation' }) }); }, staticData: { title: 'الأتمتة' } });
const utilitiesRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/utilities', beforeLoad: () => { throw redirect({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'utilities' }) }); }, staticData: { title: 'المرافق والعدادات' } });
// Legacy compatibility only: retained for old bookmarks, never exposed in product navigation.
const documentsVaultRoute = createRoute({ getParentRoute: () => protectedRoute, path: '/documents-vault', component: lazyRouteComponent(() => import('@/routes/_protected.documents-vault'), 'DocumentsVaultRouteComponent'), staticData: { title: 'المستندات — توافق قديم' } });

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
  component: lazyRouteComponent(() => import('@/routes/_protected.settings'), 'SettingsRouteComponent'),
  staticData: { title: 'الإعدادات' },
});
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
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: lazyRouteComponent(() => import('@/routes/privacy'), 'PrivacyRouteComponent'), staticData: { title: 'سياسة الخصوصية' } });
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: lazyRouteComponent(() => import('@/routes/terms'), 'TermsRouteComponent'), staticData: { title: 'شروط الاستخدام' } });
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
  authRoute.addChildren([loginRoute]),
  landingRoute,
  landingCompatRoute,
  privacyRoute,
  termsRoute,
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
