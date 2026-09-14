import {
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  redirect,
  isRedirect,
} from '@tanstack/react-router';
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
    const { getCurrentSession } = await import('@/services/auth-service');
    const session = await getCurrentSession();
    if (session) throw redirect({ to: '/dashboard' });
  },
  component: lazyRouteComponent(
    () => import('@/routes/_auth'),
    'AuthRouteComponent',
  ),
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  beforeLoad: async () => {
    const { getCurrentSession } = await import('@/services/auth-service');
    if (!await getCurrentSession()) throw redirect({ to: '/login' });
  },
  component: lazyRouteComponent(
    () => import('@/routes/_protected'),
    'ProtectedRouteComponent',
  ),
});

const requirePermission = (permission: AppPermission) => async () => {
  const { getCurrentSession } = await import('@/services/auth-service');
  try {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    await assertSessionPermission(session, permission);
  } catch (err) {
    if (isRedirect(err)) throw err;
    throw redirect({ to: '/login' });
  }
};

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  component: lazyRouteComponent(
    () => import('@/routes/_auth.login'),
    'LoginRouteComponent',
  ),
  staticData: { title: 'تسجيل الدخول' },
});
const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forgot-password',
  component: lazyRouteComponent(
    () => import('@/features/auth/password-recovery-page'),
    'ForgotPasswordPage',
  ),
  staticData: { title: 'استعادة كلمة المرور' },
});
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: lazyRouteComponent(
    () => import('@/features/auth/password-recovery-page'),
    'ResetPasswordPage',
  ),
  staticData: { title: 'تعيين كلمة مرور جديدة' },
});
const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/dashboard',
  component: lazyRouteComponent(
    () => import('@/features/dashboard/dashboard-page'),
    'DashboardPage',
  ),
  staticData: { title: 'اليوم' },
});
const propertiesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/properties',
  component: lazyRouteComponent(
    () => import('@/features/properties/properties-list-page'),
    'PropertiesListPage',
  ),
  staticData: { title: 'العقارات' },
});
const unitsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/units',
  component: lazyRouteComponent(
    () => import('@/features/units/units-page'),
    'UnitsWorkspace',
  ),
  staticData: { title: 'الوحدات' },
});
const propertyNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/properties/new',
  beforeLoad: requirePermission('properties.create'),
  component: lazyRouteComponent(
    () => import('@/features/properties/property-form-page'),
    'PropertyFormPage',
  ),
  staticData: { title: 'إضافة عقار' },
});
const propertyDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/properties/$propertyId',
  component: lazyRouteComponent(
    () => import('@/features/properties/property-detail-page'),
    'PropertyDetailPage',
  ),
  staticData: { title: 'تفاصيل العقار' },
});
const propertyIndexRoute = createRoute({
  getParentRoute: () => propertyDetailRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('@/features/properties/overview/property-overview-page'),
    'PropertyOverview',
  ),
  staticData: { title: 'نظرة عامة على العقار' },
});
const propertyUnitsRoute = createRoute({
  getParentRoute: () => propertyDetailRoute,
  path: '/units',
  component: lazyRouteComponent(
    () => import('@/features/properties/property-detail-page'),
    'PropertyUnitsPage',
  ),
  staticData: { title: 'وحدات العقار' },
});
const propertyUnitDetailRoute = createRoute({
  getParentRoute: () => propertyDetailRoute,
  path: '/units/$unitId',
  component: lazyRouteComponent(
    () => import('@/features/properties/units/property-unit-detail-page'),
    'PropertyUnitDetailPage',
  ),
  staticData: { title: 'تفاصيل الوحدة بالعقار' },
});
const propertyEditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/properties/$propertyId/edit',
  beforeLoad: requirePermission('properties.edit'),
  component: lazyRouteComponent(
    () => import('@/features/properties/property-form-page'),
    'PropertyFormPage',
  ),
  staticData: { title: 'تعديل عقار' },
});

const landsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/lands',
  beforeLoad: requirePermission('lands.view'),
  component: lazyRouteComponent(
    () => import('@/features/lands/lands-page'),
    'LandsWorkspace',
  ),
  staticData: { title: 'الأراضي' },
});
const landDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/lands/$landId',
  beforeLoad: requirePermission('lands.view'),
  component: lazyRouteComponent(
    () => import('@/features/lands/land-detail-route'),
    'LandDetailRouteComponent',
  ),
  staticData: { title: 'ملف الأرض' },
});

// Owners and tenants are core entities with first-class standalone routes.
const ownersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/owners',
  beforeLoad: requirePermission('owners.hub.view'),
  component: lazyRouteComponent(
    () => import('@/features/owners/OwnersPage'),
    'OwnersWorkspace',
  ),
  staticData: { title: 'الملاك' },
});
const ownerDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/owners/$ownerId',
  beforeLoad: requirePermission('owners.detail.view'),
  component: lazyRouteComponent(
    () => import('@/features/owners/owner-detail-page'),
    'OwnerDetailPage',
  ),
  staticData: { title: 'ملف المالك' },
});
const ownerEditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/owners/$ownerId/edit',
  beforeLoad: requirePermission('owners.hub.view'),
  component: lazyRouteComponent(
    () => import('@/features/owners/owner-edit-route'),
    'OwnerEditRouteComponent',
  ),
  staticData: { title: 'تعديل مالك' },
});
const tenantsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/tenants',
  component: lazyRouteComponent(
    () => import('@/features/tenants/TenantsPage'),
    'TenantsWorkspace',
  ),
  staticData: { title: 'المستأجرون' },
});
const tenantDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/tenants/$tenantId',
  component: lazyRouteComponent(
    () => import('@/features/tenants/components/TenantPreviewDialog'),
    'TenantDetailPage',
  ),
  staticData: { title: 'ملف المستأجر' },
});

// People directory is now first-class standalone (Phase 2). Legacy contracts?section=people redirects via hub.
const peopleRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/people',
  component: lazyRouteComponent(
    () => import('@/features/people/people-list-page'),
    'PeopleListPage',
  ),
  staticData: { title: 'الأشخاص' },
});
