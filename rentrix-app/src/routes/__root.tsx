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
    let animationFrame = 0;

    const commitViewportMetrics = () => {
      const height = Math.round(viewport?.height ?? window.innerHeight);
      const width = Math.round(viewport?.width ?? window.innerWidth);
      const offsetTop = Math.round(viewport?.offsetTop ?? 0);
      const offsetLeft = Math.round(viewport?.offsetLeft ?? 0);

      root.style.setProperty('--visual-viewport-height', `${height}px`);
      root.style.setProperty('--visual-viewport-width', `${width}px`);
      root.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
      root.style.setProperty('--visual-viewport-offset-left', `${offsetLeft}px`);
      root.style.setProperty('--visual-viewport-center-y', `${offsetTop + Math.round(height / 2)}px`);
    };

    const updateViewportMetrics = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(commitViewportMetrics);
    };

    commitViewportMetrics();
    window.addEventListener('resize', updateViewportMetrics);
    window.addEventListener('orientationchange', updateViewportMetrics);
    viewport?.addEventListener('resize', updateViewportMetrics);
    viewport?.addEventListener('scroll', updateViewportMetrics);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateViewportMetrics);
      window.removeEventListener('orientationchange', updateViewportMetrics);
      viewport?.removeEventListener('resize', updateViewportMetrics);
      viewport?.removeEventListener('scroll', updateViewportMetrics);
      root.style.removeProperty('--visual-viewport-height');
      root.style.removeProperty('--visual-viewport-width');
      root.style.removeProperty('--visual-viewport-offset-top');
      root.style.removeProperty('--visual-viewport-offset-left');
      root.style.removeProperty('--visual-viewport-center-y');
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
