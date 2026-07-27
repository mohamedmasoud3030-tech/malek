import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingControls } from './useOnboarding';

const useOwnersSpy = vi.fn<(options?: Readonly<{ enabled?: boolean }>) => { data: unknown[] }>();
const onboardingControls: { current: OnboardingControls } = {
  current: {
    isVisible: true,
    complete: () => undefined,
    skip: () => undefined,
    dismissLater: () => undefined,
    reset: () => undefined,
  },
};

vi.mock('@/features/owners/useOwners', () => ({
  useOwners: (options?: Readonly<{ enabled?: boolean }>) => useOwnersSpy(options),
}));

vi.mock('./useOnboarding', () => ({
  useOnboarding: () => onboardingControls.current,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: Readonly<{ children: React.ReactNode; to: string }>) => <a href={to}>{children}</a>,
}));

import { OnboardingChecklist } from './OnboardingChecklist';

const emptyProgress = { hasProperty: false, hasUnit: false, hasContract: false, hasInvoice: false };

describe('OnboardingChecklist unnecessary query gating (#1168)', () => {
  beforeEach(() => {
    useOwnersSpy.mockClear();
    useOwnersSpy.mockReturnValue({ data: [] });
    onboardingControls.current = { ...onboardingControls.current, isVisible: true };
  });

  it('does not enable the owners query when the checklist is hidden', () => {
    onboardingControls.current = { ...onboardingControls.current, isVisible: false };

    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup />,
    );

    expect(html).toBe('');
    expect(useOwnersSpy).toHaveBeenCalledWith({ enabled: false });
  });

  it('enables the owners query only while the checklist is visible', () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup />,
    );

    expect(html).toContain('إعداد حسابك');
    expect(useOwnersSpy).toHaveBeenCalledWith({ enabled: true });
  });

  it('hides setup actions from read-only users instead of linking them to forbidden routes', () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup={false} />,
    );

    expect(html).toBe('');
    expect(useOwnersSpy).toHaveBeenCalledWith({ enabled: false });
  });

  it('orders setup by real dependencies: owner, property, unit, contract, then optional invoice', () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup />,
    );

    const owner = html.indexOf('إضافة أول مالك');
    const property = html.indexOf('إنشاء أول عقار');
    const unit = html.indexOf('إنشاء أول وحدة');
    const contract = html.indexOf('إنشاء أول عقد');
    const invoice = html.indexOf('إصدار أول فاتورة');

    expect(owner).toBeGreaterThan(-1);
    expect(owner).toBeLessThan(property);
    expect(property).toBeLessThan(unit);
    expect(unit).toBeLessThan(contract);
    expect(contract).toBeLessThan(invoice);
  });
});
