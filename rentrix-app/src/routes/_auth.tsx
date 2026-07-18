import { AppProviders } from '@/app/providers/app-providers';
import { AuthLayout } from '@/components/layout/auth-layout';

export function AuthRouteComponent() {
  return (
    <AppProviders>
      <AuthLayout />
    </AppProviders>
  );
}
