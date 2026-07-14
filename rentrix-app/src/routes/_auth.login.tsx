import { EntityFormE2EFixture } from '@/components/ui/entity-form.e2e-fixture';
import { LoginPage } from '@/features/auth/login-page';

export function LoginRouteComponent() {
  if (import.meta.env.VITE_E2E && typeof window !== 'undefined') {
    const search = new URLSearchParams(window.location.search);
    if (search.get('e2e-form-contract') === '1') {
      const mobileSurface = search.get('surface') === 'full-page' ? 'full-page' : 'bottom-sheet';
      return <EntityFormE2EFixture mobileSurface={mobileSurface} />;
    }
  }

  return <LoginPage />;
}