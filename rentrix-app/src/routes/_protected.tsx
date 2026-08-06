import { useLocation } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/app-shell';
import { AppProviders } from '@/app/providers/app-providers';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { isOperationalFormRoute } from '@/lib/operational-form-routes';

export function ProtectedRouteComponent() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const formVisualVariant = isOperationalFormRoute(pathname)
    ? 'operational'
    : undefined;

  return (
    <AppProviders>
      <EntityFormVisualProvider variant={formVisualVariant}>
        <AppShell />
      </EntityFormVisualProvider>
    </AppProviders>
  );
}
