import { useLocation } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/app-shell';
import { AppProviders } from '@/app/providers/app-providers';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';

const operationalFormRoutePrefixes = [
  '/properties',
  '/units',
  '/people',
  '/tenants',
  '/owners',
  '/contracts',
  '/maintenance',
  '/settings',
  '/portfolio',
  '/relationships',
] as const;

export function isOperationalFormRoute(pathname: string): boolean {
  return operationalFormRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

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
