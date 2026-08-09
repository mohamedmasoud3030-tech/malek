import { useLocation } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/app-shell';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { BackgroundLocationProvider } from '@/app/router/background-location';
import { LegacyPreviewRedirect } from '@/app/router/legacy-preview-redirect';
import { isOperationalFormRoute } from '@/lib/operational-form-routes';

export function ProtectedRouteComponent() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isOperationalRoute = isOperationalFormRoute(pathname);
  const formVisualVariant = isOperationalRoute ? 'operational' : undefined;

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
