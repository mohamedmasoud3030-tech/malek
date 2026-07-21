import { useSyncExternalStore, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/**
 * First-open "install the app" banner.
 *
 * Shown once when the app can be installed (Chrome/Edge native prompt) or can
 * be installed manually (iOS Safari instructions). Persists dismissal and
 * never nags inside an installed standalone window. Suppressed entirely in
 * the e2e fixture environment (VITE_E2E).
 */
export function PwaInstallPrompt() {
  const isE2E = Boolean(import.meta.env.VITE_E2E);
  const snapshot = useSyncExternalStore(subscribeInstallPrompt, installPromptSnapshot);
  const [nativeFlag, appInstalledText] = snapshot.split(':');
  const appInstalled = appInstalledText === 'true';
  const nativePromptAvailable = nativeFlag === 'true';
  const [dismissed, setDismissed] = useState(() => isInstallDismissed());
  const [installing, setInstalling] = useState(false);

  if (isE2E || dismissed || appInstalled || isStandaloneDisplay()) return null;

  const iosManual = isIosManualInstall();
  if (!nativePromptAvailable && !iosManual) return null;

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
      aria-label="تثبيت تطبيق Rentrix"
      className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(var(--mobile-bottom-nav-height,3.75rem)+env(safe-area-inset-bottom,0px)+0.75rem)] pt-2 duration-300 motion-reduce:animate-none lg:pb-6"
    >
      <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-card-foreground shadow-elevated">
        <div
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
        >
          <Download className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">ثبّت تطبيق Rentrix</p>
          {iosManual ? (
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              من متصفح Safari: اضغط{' '}
              <Share className="inline size-3.5 align-[-2px]" aria-hidden="true" />{' '}
              زر المشاركة ثم اختر{' '}
              <span className="font-bold text-foreground">
                «إضافة إلى الشاشة الرئيسية»{' '}
                <SquarePlus className="inline size-3.5 align-[-2px]" aria-hidden="true" />
              </span>{' '}
              لفتح التطبيق كأيقونة مستقلة.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              وصول أسرع من الشاشة الرئيسية وعمل دون اتصال — دون متجر تطبيقات.
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            {nativePromptAvailable ? (
              <Button size="sm" className="min-h-11" onClick={() => void handleInstall()} disabled={installing}>
                {installing ? 'جارٍ فتح نافذة التثبيت…' : 'تثبيت التطبيق'}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" className="min-h-11" onClick={handleDismiss}>
              {iosManual ? 'فهمت' : 'لاحقًا'}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="إغلاق رسالة تثبيت التطبيق"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 motion-reduce:transition-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
