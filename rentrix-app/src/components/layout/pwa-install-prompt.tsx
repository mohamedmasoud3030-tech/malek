import { useLayoutEffect, useRef, useSyncExternalStore, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Share, SquarePlus } from 'lucide-react';
import { MalikMark } from '@/components/brand/malik-mark';
import { Button } from '@/components/ui/button';
import { APP_BRAND_NAME } from '@/lib/brand';
import {
  dismissInstallPrompt,
  getAppInstalledEventFired,
  getDeferredInstallPrompt,
  isInstallDismissed,
  isIosManualInstall,
  isStandaloneDisplay,
  requestNativeInstall,
  subscribeInstallPrompt,
} from '@/lib/pwa-install';

function installPromptSnapshot(): string {
  return `${Boolean(getDeferredInstallPrompt())}:${getAppInstalledEventFired()}`;
}

/** Fallback bar height when the runtime cannot measure (tests). */
const FALLBACK_BAR_HEIGHT_PX = 60;

/**
 * First-open "install the app" banner.
 *
 * Shown once when the app can be installed (Chrome/Edge native prompt) or can
 * be installed manually (iOS Safari instructions). Persists dismissal and
 * never nags inside an installed standalone window. Suppressed entirely in
 * the e2e fixture environment (VITE_E2E) and on auth surfaces (the banner
 * must never block signing in).
 *
 * Layout contract (live-QA 2026-09): a floating card used to cover real row
 * actions on every phone page. Now the banner is a one-row bar AND its height
 * is folded into the canonical `--mobile-dock-clearance` token (JS measures
 * the bar and sets `--pwa-banner-height`; ux-foundation.css composes the
 * clearance from it). Page content and every dock-anchored overlay reserve
 * the bar's space, so the bar floats only over reserved gutter — never over
 * content, at any scroll position. The container keeps positioning only and
 * is pointer-events-none; the bar is the single interactive hit target.
 */
const AUTH_SURFACE_PATHS = ['/login', '/forgot-password', '/reset-password'];

function isAuthSurfacePath(pathname: string): boolean {
  return (
    AUTH_SURFACE_PATHS.includes(pathname) || pathname.startsWith('/login/')
  );
}

export function PwaInstallPrompt() {
  const isE2E = Boolean(import.meta.env.VITE_E2E);
  const { pathname } = useLocation();
  const snapshot = useSyncExternalStore(subscribeInstallPrompt, installPromptSnapshot);
  const [nativeFlag, appInstalledText] = snapshot.split(':');
  const appInstalled = appInstalledText === 'true';
  const nativePromptAvailable = nativeFlag === 'true';
  const [dismissed, setDismissed] = useState(() => isInstallDismissed());
  const [installing, setInstalling] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  const iosManual = isIosManualInstall();
  const visible =
    !isE2E &&
    !isAuthSurfacePath(pathname) &&
    !dismissed &&
    !appInstalled &&
    !isStandaloneDisplay() &&
    (nativePromptAvailable || iosManual);

  useLayoutEffect(() => {
    const rootStyle = document.documentElement.style;
    if (!visible) {
      rootStyle.setProperty('--pwa-banner-height', '0px');
      return;
    }
    // jsdom/happy-dom report offsetHeight 0 — fall back to the designed height.
    const measured = barRef.current?.offsetHeight || FALLBACK_BAR_HEIGHT_PX;
    rootStyle.setProperty('--pwa-banner-height', `${Math.round(measured)}px`);
    return () => rootStyle.setProperty('--pwa-banner-height', '0px');
  }, [visible]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismissInstallPrompt();
    setDismissed(true);
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await requestNativeInstall();
      // Hide the banner for this visit either way; re-ask on a later open.
      if (outcome !== null) setDismissed(true);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      data-pwa-install-prompt
      role="region"
      aria-label={`تثبيت تطبيق ${APP_BRAND_NAME}`}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pt-2"
    >
      <div
        ref={barRef}
        className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-elevated"
      >
        <div aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
          <MalikMark className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{`ثبّت تطبيق ${APP_BRAND_NAME}`}</p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground">
            {iosManual ? (
              <>
                من Safari: اضغط{' '}
                <Share className="inline size-3 align-[-1px]" aria-hidden="true" />{' '}
                زر المشاركة ثم{' '}
                <span className="font-bold text-foreground">
                  «إضافة إلى الشاشة الرئيسية»{' '}
                  <SquarePlus className="inline size-3 align-[-1px]" aria-hidden="true" />
                </span>
              </>
            ) : (
              'وصول أسرع من الشاشة الرئيسية وعمل دون اتصال.'
            )}
          </p>
        </div>

        {nativePromptAvailable ? (
          <Button size="sm" className="min-h-11 shrink-0 px-3" onClick={() => void handleInstall()} disabled={installing}>
            {installing ? 'جارٍ التثبيت…' : 'تثبيت التطبيق'}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="secondary" className="min-h-11 shrink-0 px-3" onClick={handleDismiss}>
          {iosManual ? 'فهمت' : 'لاحقًا'}
        </Button>
      </div>
    </div>
  );
}
