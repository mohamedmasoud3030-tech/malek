// @vitest-environment happy-dom
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

import { PwaInstallPrompt } from './pwa-install-prompt';

describe('PwaInstallPrompt — رسالة تثبيت التطبيق عند أول فتح', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    // clearAllMocks keeps implementations, so re-baseline them explicitly.
    vi.clearAllMocks();
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
    expect(banner?.textContent).toContain('ثبّت تطبيق MALIK');
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
});
