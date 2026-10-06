import { LanguageProvider } from '@/features/landing/i18n/LanguageContext';
import { LegalPage } from '@/features/landing/components/LegalPage';

export function PrivacyRouteComponent() {
  return (
    <LanguageProvider>
      <LegalPage slug="privacy" />
    </LanguageProvider>
  );
}
