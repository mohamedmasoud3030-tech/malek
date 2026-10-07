import { AuthLayout } from '@/components/layout/auth-layout';

/** AppProviders already wrap every route at the root shell (see routes/__root.tsx). */
export function AuthRouteComponent() {
  return <AuthLayout />;
}
