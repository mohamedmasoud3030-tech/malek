// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pwaInstallMock = vi.hoisted(() => ({
  subscribeInstallPrompt: vi.fn(() => () => undefined),
  getDeferredInstallPrompt: vi.fn(() => null as object | null),
  getAppInstalledEventFired: vi.fn(() => false),
  isStandaloneDisplay: vi.fn(() => false),
  isIosManualInstall: vi.fn(() => false),
  isInstallDismissed: vi.fn(() => false),
  dismissInstallPrompt: vi.fn(),
  requestNativeInstall: vi.fn(async () => 'accepted' as const),
  PWA_REASK_AFTER_DAYS: 30,
}));

vi.mock('@/lib/pwa-install', () => pwaInstallMock);

// The banner reads the current path so it can stay off auth surfaces.
let currentPathname = '/';
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: currentPathname }),
}));

import { PwaInstallPrompt } from './pwa-install-prompt';

describe('PwaInstallPrompt — رسالة تثبيت التطبيق عند أول فتح', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    // clearAllMocks keeps implementations, so re-baseline them explicitly.
    vi.clearAllMocks();
    currentPathname = '/';
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue(null);
    pwaInstallMock.getAppInstalledEventFired.mockReturnValue(false);
    pwaInstallMock.isStandaloneDisplay.mockReturnValue(false);
    pwaInstallMock.isIosManualInstall.mockReturnValue(false);
    pwaInstallMock.isInstallDismissed.mockReturnValue(false);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
  });

  function render() {
    act(() => {
      root.render(<PwaInstallPrompt />);
    });
    return document.body.querySelector<HTMLElement>('[data-pwa-install-prompt]');
  }

  it('renders nothing when no install path is available', () => {
    expect(render()).toBeNull();
  });

  it('shows the install banner on first open when the native prompt is available', () => {
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);

    const banner = render();

    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('region');
    expect(banner?.textContent).toContain('ثبّت تطبيق MALEK');
    expect(banner?.textContent).toContain('تثبيت التطبيق');
    expect(banner?.textContent).toContain('لاحقًا');
  });

  it('triggers the native prompt on install click and hides the banner', async () => {
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);
    render();

    const installButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'تثبيت التطبيق',
    );
    expect(installButton).toBeDefined();

    await act(async () => {
      installButton?.click();
    });

    expect(pwaInstallMock.requestNativeInstall).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[data-pwa-install-prompt]')).toBeNull();
  });

  it('persists dismissal when the user taps لاحقًا or the close button', () => {
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);
    render();

    const laterButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'لاحقًا',
    );
    act(() => laterButton?.click());

    expect(pwaInstallMock.dismissInstallPrompt).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[data-pwa-install-prompt]')).toBeNull();
  });

  it('stays hidden inside an installed standalone window', () => {
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);
    pwaInstallMock.isStandaloneDisplay.mockReturnValue(true);
    expect(render()).toBeNull();
  });

  it('stays hidden after the user already dismissed it', () => {
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);
    pwaInstallMock.isInstallDismissed.mockReturnValue(true);
    expect(render()).toBeNull();
  });

  it('stays hidden once the appinstalled event fired', () => {
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);
    pwaInstallMock.getAppInstalledEventFired.mockReturnValue(true);
    expect(render()).toBeNull();
  });

  it('shows manual Add-to-Home-Screen guidance on iOS Safari', () => {
    pwaInstallMock.isIosManualInstall.mockReturnValue(true);

    const banner = render();

    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('إضافة إلى الشاشة الرئيسية');
    expect(banner?.textContent).toContain('زر المشاركة');
    expect(banner?.textContent).toContain('فهمت');
    expect(banner?.textContent).not.toContain('تثبيت التطبيق');
  });

  it('never intercepts touches aimed at the page beneath the banner', () => {
    // Live-QA regression (iPhone/Safari): the full-width fixed container acted
    // as a hit area and swallowed taps on the login submit button. The
    // container must opt out of hit-testing; only the card receives touches.
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);

    const banner = render();

    expect(banner).not.toBeNull();
    expect(banner?.classList.contains('pointer-events-none')).toBe(true);

    const card = banner?.firstElementChild as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card?.classList.contains('pointer-events-auto')).toBe(true);

    // Every interactive control must live inside the touch-transparent-in /
    // pointer-events-auto card subtree — never on the outer container.
    const interactiveOutsideCard = [...(banner?.querySelectorAll('button, a') ?? [])]
      .filter((el) => !card?.contains(el));
    expect(interactiveOutsideCard).toHaveLength(0);
  });

  it('reserves its own height in the dock-clearance token while visible', () => {
    // Live-QA regression: a floating card covered real row-action buttons on
    // every phone page even after the dock stacking fix. The bar's measured
    // height must fold INTO --mobile-dock-clearance (via --pwa-banner-height)
    // so pages reserve its space and it floats over gutter only.
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);

    render();

    // happy-dom reports offsetHeight 0 → the designed fallback height.
    expect(document.documentElement.style.getPropertyValue('--pwa-banner-height')).toBe('60px');

    const laterButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'لاحقًا',
    );
    act(() => laterButton?.click());

    expect(document.documentElement.style.getPropertyValue('--pwa-banner-height')).toBe('0px');
  });

  it('composes the clearance from the banner height in the canonical stylesheet (JIT-purge-proof)', () => {
    // happy-dom cannot parse calc() values, and the Tailwind JIT silently
    // dropped an arbitrary calc(var()) class from production CSS (v1 failed
    // exactly that way), so both halves of the contract are pinned at source
    // level: the stylesheet must compose the dock clearance from the measured
    // banner height, and the component must publish that measurement.
    const css = readFileSync(resolve(__dirname, '../../styles/ux-foundation.css'), 'utf8');
    expect(css).toContain('var(--pwa-banner-height');

    const source = readFileSync(resolve(__dirname, './pwa-install-prompt.tsx'), 'utf8');
    expect(source).toContain("'--pwa-banner-height'");
    expect(source).not.toContain('paddingBottom:');
  });

  it('stays hidden on auth surfaces — the banner must never block signing in', () => {
    // Live-QA regression (iPhone/Safari): the tall iOS-guidance card sat
    // exactly over the login submit button. Install nudging is worthless
    // where the user cannot get past the front door.
    pwaInstallMock.getDeferredInstallPrompt.mockReturnValue({} as object);

    for (const authPath of ['/login', '/login/e2e-fixture', '/forgot-password', '/reset-password']) {
      currentPathname = authPath;
      expect(render(), authPath).toBeNull();
    }

    // Non-auth public surfaces keep the banner.
    currentPathname = '/support';
    expect(render()).not.toBeNull();
  });
});
