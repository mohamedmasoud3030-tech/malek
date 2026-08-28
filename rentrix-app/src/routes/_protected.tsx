import { Navigate, useLocation } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/app-shell';
import { BackgroundLocationProvider } from '@/app/router/background-location';
import { LegacyPreviewRedirect } from '@/app/router/legacy-preview-redirect';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { LoadingState } from '@/components/ui/loading-state';
import type { AppPermission } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { isOperationalFormRoute } from '@/lib/operational-form-routes';

function workspacePermissionForPath(pathname: string): AppPermission | null {
  if (pathname === '/units' || pathname === '/properties' || pathname.startsWith('/properties/')) {
    return 'properties.view';
  }
  if (
    pathname === '/contracts' || pathname.startsWith('/contracts/') ||
    pathname === '/tenants' || pathname.startsWith('/tenants/') ||
    pathname === '/people' || pathname.startsWith('/people/')
  ) {
    return 'contracts.view';
  }
  if (
    pathname === '/financials' || pathname === '/finance/collections' ||
    pathname === '/invoices' || pathname === '/receipts'
  ) {
    return 'financial.workspace.view';
  }
  if (
    pathname === '/maintenance' || pathname === '/utilities' || pathname === '/documents-vault'
  ) {
    return 'maintenance.view';
  }
  if (pathname === '/reports' || pathname === '/accounting') {
    return 'financial.reports.view';
  }
  return null;
}

export function ProtectedRouteComponent() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { authorization, canAccess } = useAuth();
  const requiredWorkspacePermission = workspacePermissionForPath(pathname);
  const isOperationalRoute = isOperationalFormRoute(pathname);
  const formVisualVariant = isOperationalRoute ? 'operational' : undefined;

  if (requiredWorkspacePermission && !authorization?.effectivePermissionsResolved) {
    return <LoadingState variant="page" label="جارٍ التحقق من الصلاحيات..." />;
  }

  if (requiredWorkspacePermission && !canAccess(requiredWorkspacePermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <EntityFormVisualProvider variant={formVisualVariant}>
      <BackgroundLocationProvider>
        <div
          className="contents"
          data-operational-route={isOperationalRoute ? 'true' : undefined}
        >
          <AppShell />
          <LegacyPreviewRedirect />
        </div>
      </BackgroundLocationProvider>
    </EntityFormVisualProvider>
  );
}
