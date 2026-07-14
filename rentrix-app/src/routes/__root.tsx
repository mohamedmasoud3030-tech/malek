import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { AppCatchBoundary } from '@/components/error-boundary';
import { getAppLanguageState } from '@/lib/i18n';

function useVisualViewportCssVariable() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const updateViewportHeight = () => {
      const height = Math.round(viewport?.height ?? window.innerHeight);
      root.style.setProperty('--visual-viewport-height', `${height}px`);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      root.style.removeProperty('--visual-viewport-height');
    };
  }, []);
}

export function RootRouteComponent() {
  useVisualViewportCssVariable();

  return (
    <AppCatchBoundary>
      <Outlet />
      <Toaster richColors position="top-left" dir={getAppLanguageState().direction} />
      {import.meta.env.DEV && !import.meta.env.VITE_E2E ? <TanStackRouterDevtools position="bottom-left" /> : null}
    </AppCatchBoundary>
  );
}