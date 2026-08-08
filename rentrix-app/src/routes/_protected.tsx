import { useLocation } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/app-shell';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { EntityPreviewHost } from '@/components/ui/entity-preview-host';
import { isOperationalFormRoute } from '@/lib/operational-form-routes';

export function ProtectedRouteComponent() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isOperationalRoute = isOperationalFormRoute(pathname);
  const formVisualVariant = isOperationalRoute ? 'operational' : undefined;

  return (
    <EntityFormVisualProvider variant={formVisualVariant}>
      <div
        className="contents"
        data-operational-route={isOperationalRoute ? 'true' : undefined}
      >
        <AppShell />
        <EntityPreviewHost />
      </div>
    </EntityFormVisualProvider>
  );
}
