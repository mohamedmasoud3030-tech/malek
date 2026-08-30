import { AppProviders } from '@/app/providers/app-providers';
import { PublicSupportPage } from '@/features/help-support/public-support-page';

export function SupportRouteComponent() {
  return (
    <AppProviders>
      <PublicSupportPage />
    </AppProviders>
  );
}
