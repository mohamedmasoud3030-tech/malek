import { AppShell } from '@/app/layout/app-shell';
import { AppProviders } from '@/app/providers/app-providers';

export function ProtectedRouteComponent() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
