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

    const html = renderToStaticMarkup(<OnboardingChecklist progress={emptyProgress} />);

    expect(html).toBe('');
    expect(useOwnersSpy).toHaveBeenCalledWith({ enabled: false });
  });

  it('enables the owners query only while the checklist is visible', () => {
    const html = renderToStaticMarkup(<OnboardingChecklist progress={emptyProgress} />);

    expect(html).toContain('إعداد حسابك');
    expect(useOwnersSpy).toHaveBeenCalledWith({ enabled: true });
  });
});
