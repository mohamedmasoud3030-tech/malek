import { lazy, Suspense } from 'react';
import { LoginPage } from '@/features/auth/login-page';

// Keep the hermetic browser fixtures behind a build-time gate so production
// does not emit their modules as reachable lazy chunks.
const LoginE2EFixture = import.meta.env.VITE_E2E
  ? lazy(() => import('./_auth.login.e2e-fixture').then((module) => ({ default: module.LoginE2EFixture })))
  : null;

export function LoginRouteComponent() {
  if (LoginE2EFixture) {
    return (
      <Suspense fallback={<div data-e2e-fixture-loading aria-hidden="true" />}>
        <LoginE2EFixture fallback={<LoginPage />} />
      </Suspense>
    );
  }

  return <LoginPage />;
}
