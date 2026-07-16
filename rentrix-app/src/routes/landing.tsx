import { LanguageProvider } from '@/features/landing/i18n/LanguageContext';
import { NavBar } from '@/features/landing/components/NavBar';
import { Hero } from '@/features/landing/components/Hero';
import { ProblemSolution } from '@/features/landing/components/ProblemSolution';
import { FeaturesBento } from '@/features/landing/components/FeaturesBento';
import { Showcase } from '@/features/landing/components/Showcase';
import { HowItWorks } from '@/features/landing/components/HowItWorks';
import { Devices } from '@/features/landing/components/Devices';
import { Security } from '@/features/landing/components/Security';
import { Faq } from '@/features/landing/components/Faq';
import { FinalCta } from '@/features/landing/components/FinalCta';
import { Footer } from '@/features/landing/components/Footer';

/**
 * Public marketing landing — served on the app domain root (`/`).
 * Full-bleed layout (no app chrome): the landing manages its own theme while mounted.
 */
export function LandingRouteComponent() {
  return (
    <LanguageProvider>
      <div className="min-h-screen overflow-x-clip bg-ink-950 font-sans">
        <NavBar />
        <main>
          <Hero />
          <ProblemSolution />
          <FeaturesBento />
          <Showcase />
          <HowItWorks />
          <Devices />
          <Security />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
