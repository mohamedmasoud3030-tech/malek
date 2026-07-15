import { PageLayout } from '@/components/layout/page-layout';
import { LandingNavBar } from '@/features/landing/components/LandingNavBar';
import { LandingHero } from '@/features/landing/components/LandingHero';
import { FeaturesSection } from '@/features/landing/components/FeaturesSection';
import { ShowcaseSection } from '@/features/landing/components/ShowcaseSection';
import { WhyRentrixSection } from '@/features/landing/components/WhyRentrixSection';
import { CtaSection } from '@/features/landing/components/CtaSection';
import { LandingFooter } from '@/features/landing/components/LandingFooter';

export function LandingRouteComponent() {
  return (
    <PageLayout dir="rtl" lang="ar" size="full" contentClassName="space-y-0" className="bg-background text-foreground">
      <LandingNavBar />
      <LandingHero />
      <FeaturesSection />
      <ShowcaseSection />
      <WhyRentrixSection />
      <CtaSection />
      <LandingFooter />
    </PageLayout>
  );
}
