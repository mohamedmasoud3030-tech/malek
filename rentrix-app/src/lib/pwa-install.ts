/**
 * PWA install prompt — captures the browser-native `beforeinstallprompt`
 * event at module scope (the event may fire before React mounts) and exposes
 * the state + actions the install banner needs.
 *
 * Behavior notes:
 * - Chrome/Edge/Android fire `beforeinstallprompt`; we preventDefault once and
 *   keep the event so the banner can trigger the native prompt on demand.
 * - iOS/iPadOS Safari never fires it; those devices need manual
 *   Share → Add to Home Screen instructions instead.
 * - Dismissal is persisted for PWA_REASK_AFTER_DAYS so the first-open message
 *   doesn't nag on every visit, but still re-offers eventually.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const PWA_INSTALL_DISMISS_KEY = 'malik.pwa-install-dismissed-at';
export const PWA_REASK_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalledEventFired = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  for (const subscriber of subscribers) subscriber();
}

// Module-scope capture so an event fired before hydration is never missed.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appInstalledEventFired = true;
    notifySubscribers();
  });
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function getAppInstalledEventFired(): boolean {
  return appInstalledEventFired;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Fire the captured native prompt. The event is single-use, so it is cleared
 * first. Returns the user's choice, or null when no prompt is available
 * (e.g. iOS or an unsupported browser).
 */
export async function requestNativeInstall(): Promise<'accepted' | 'dismissed' | null> {
  const promptEvent = deferredPrompt;
  if (!promptEvent) return null;
  deferredPrompt = null;
  notifySubscribers();
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  return outcome;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * True when the device needs manual Add-to-Home-Screen guidance: iOS/iPadOS
 * Safari. In-app browsers (Instagram/Facebook/LINE webviews) and non-Safari
 * iOS browsers are excluded because they cannot complete the flow reliably.
 */
export function isIosManualInstall(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandaloneDisplay()) return false;
  const userAgent = window.navigator.userAgent;
  const isIosDevice =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (userAgent.includes('Macintosh') && window.navigator.maxTouchPoints > 1);
  if (!isIosDevice) return false;
  return !/crios|fxios|edgios|instagram|fbav|fban|line\//i.test(userAgent);
}

export function readInstallDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    if (!raw) return null;
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch {
    return null;
  }
}

export function dismissInstallPrompt(dismissedAt = Date.now()): void {
  try {
    window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(dismissedAt));
  } catch {
    // Storage may be unavailable (private mode); dismissal stays session-only.
  }
}

export function isInstallDismissed(now = Date.now()): boolean {
  const dismissedAt = readInstallDismissedAt();
  if (dismissedAt === null) return false;
  return now - dismissedAt < PWA_REASK_AFTER_DAYS * DAY_MS;
}
