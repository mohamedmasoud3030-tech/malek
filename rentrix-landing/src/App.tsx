import { LanguageProvider } from './i18n/LanguageContext';
import { NavBar } from './components/NavBar';
import { Hero } from './components/Hero';
import { ProblemSolution } from './components/ProblemSolution';
import { FeaturesBento } from './components/FeaturesBento';
import { Showcase } from './components/Showcase';
import { HowItWorks } from './components/HowItWorks';
import { Devices } from './components/Devices';
import { Security } from './components/Security';
import { Faq } from './components/Faq';
import { FinalCta } from './components/FinalCta';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <LanguageProvider>
      <div className="min-h-screen overflow-x-clip bg-ink-950">
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
