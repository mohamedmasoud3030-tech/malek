import { useEffect, useState } from 'react';
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
import { LegalPage } from './components/LegalPage';

/**
 * Minimal history-API router — the site has three real routes:
 * `/`, `/privacy`, `/terms`. Internal links opt in with `data-internal`.
 * The host serves index.html for all paths (see vercel.json rewrites).
 */
function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest?.('a[data-internal]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      window.history.pushState({}, '', url.pathname + url.hash);
      setPath(url.pathname);
      if (url.hash) {
        // Wait for the home sections to render, then jump to the anchor.
        window.requestAnimationFrame(() => {
          document.querySelector(url.hash)?.scrollIntoView({ behavior: 'smooth' });
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return path;
}

function HomePage({ hashAnchorsDirect }: { hashAnchorsDirect?: boolean }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-ink-950">
      <NavBar anchoredToHome={!hashAnchorsDirect} />
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
  );
}

export default function App() {
  const path = usePathname();

  return (
    <LanguageProvider>
      {path === '/privacy' ? (
        <LegalPage slug="privacy" />
      ) : path === '/terms' ? (
        <LegalPage slug="terms" />
      ) : (
        <HomePage hashAnchorsDirect />
      )}
    </LanguageProvider>
  );
}
