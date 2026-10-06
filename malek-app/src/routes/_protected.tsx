import { Navigate, useLocation } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/app-shell';
import { BackgroundLocationProvider } from '@/app/router/background-location';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { LoadingState } from '@/components/ui/loading-state';
import { workspacePermissionForPath } from '@/app/navigation/route-contract';
import { useAuth } from '@/hooks/use-auth';
import { isOperationalFormRoute } from '@/lib/operational-form-routes';

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
        </div>
      </BackgroundLocationProvider>
    </EntityFormVisualProvider>
  );
}
