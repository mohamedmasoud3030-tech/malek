import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingControls } from './useOnboarding';
import type { OnboardingRequirementState } from './onboardingService';

const useOwnersSpy = vi.fn<(options?: Readonly<{ enabled?: boolean }>) => { data: unknown[] }>();

const requirements: OnboardingRequirementState[] = [
  { code: 'owner', label_ar: 'إضافة أول مالك', required: true, waiver_policy: 'NON_WAIVABLE', sort_order: 1, waived: false, waiver_reason: null, waived_at: null, waiver_authority: null, evidence_reference: null },
  { code: 'property', label_ar: 'إنشاء أول عقار', required: true, waiver_policy: 'NON_WAIVABLE', sort_order: 2, waived: false, waiver_reason: null, waived_at: null, waiver_authority: null, evidence_reference: null },
  { code: 'unit', label_ar: 'إنشاء أول وحدة', required: true, waiver_policy: 'ADMIN_WAIVABLE', sort_order: 3, waived: false, waiver_reason: null, waived_at: null, waiver_authority: null, evidence_reference: null },
  { code: 'contract', label_ar: 'إنشاء أول عقد', required: true, waiver_policy: 'ADMIN_WAIVABLE', sort_order: 4, waived: false, waiver_reason: null, waived_at: null, waiver_authority: null, evidence_reference: null },
  { code: 'invoice', label_ar: 'إصدار أول فاتورة', required: false, waiver_policy: 'ADMIN_WAIVABLE', sort_order: 5, waived: false, waiver_reason: null, waived_at: null, waiver_authority: null, evidence_reference: null },
];

const onboardingControls: { current: OnboardingControls } = {
  current: {
    isVisible: true,
    isLoading: false,
    completed: false,
    requirements,
    complete: () => undefined,
    waive: () => undefined,
    reset: () => undefined,
    dismissLater: () => undefined,
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
    onboardingControls.current = { ...onboardingControls.current, isVisible: true, requirements };
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

    expect(html).toContain('جهّز مكتبك لأول عملية إيجار');
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

describe('OnboardingChecklist canonical gates (GAP-005)', () => {
  beforeEach(() => {
    useOwnersSpy.mockClear();
    useOwnersSpy.mockReturnValue({ data: [] });
    onboardingControls.current = { ...onboardingControls.current, isVisible: true, requirements };
  });

  it('marks identity/authority steps as mandatory (no waiver action) and operational steps as admin-waivable', () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup />,
    );

    // Two NON_WAIVABLE steps → two "إلزامي" tags; three ADMIN_WAIVABLE steps → three waiver buttons.
    expect((html.match(/إلزامي/g) ?? []).length).toBe(2);
    expect((html.match(/تخطٍّ بموافقة/g) ?? []).length).toBe(3);
  });

  it('keeps the completion button disabled while any required step is unfinished', () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup />,
    );

    expect(html).toContain('أكمل الخطوات المطلوبة أولاً');
    expect(html).not.toContain('اعتماد اكتمال الإعداد');
  });

  it('keeps progress valid when a configured catalog has optional steps only', () => {
    onboardingControls.current = {
      ...onboardingControls.current,
      requirements: requirements.filter((requirement) => !requirement.required),
    };

    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={emptyProgress} canManageSetup />,
    );

    expect(html).toContain('aria-valuenow="100"');
    expect(html).not.toContain('NaN');
  });

  it('enables completion once every required step is satisfied', () => {
    useOwnersSpy.mockReturnValue({ data: [{ id: 'owner-1' }] });
    const progress = { hasProperty: true, hasUnit: true, hasContract: true, hasInvoice: false };

    const html = renderToStaticMarkup(
      <OnboardingChecklist progress={progress} canManageSetup />,
    );

    expect(html).toContain('اعتماد اكتمال الإعداد');
  });
});
