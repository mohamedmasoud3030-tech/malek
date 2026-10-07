import { LanguageProvider } from '@/features/landing/i18n/LanguageContext';
import { LegalPage } from '@/features/landing/components/LegalPage';

export function TermsRouteComponent() {
  return (
    <LanguageProvider>
      <LegalPage slug="terms" />
    </LanguageProvider>
  );
}
