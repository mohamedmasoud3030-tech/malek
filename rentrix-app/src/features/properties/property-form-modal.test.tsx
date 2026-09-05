// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import axe from 'axe-core';

const createPropertyWithAgreementMock = vi.fn();
const owners = [
  { id: '11111111-1111-4111-8111-111111111111', display_name: 'مالك تجريبي', full_name: 'مالك تجريبي' },
];

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./use-properties', () => ({
  useProperty: () => ({ data: undefined, isLoading: false }),
  useUpdateProperty: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSoftDeleteProperty: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock('@/features/owners/useOwners', () => ({
  useOperationalOwners: () => ({ data: owners, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useCreatePropertyWithAgreement: () => ({ isPending: false, mutateAsync: createPropertyWithAgreementMock }),
}));

import { PropertyFormModal } from './property-form-modal';

const STEP_NAV_SELECTOR = 'nav[aria-label="خطوات إنشاء العقار"]';

function setInputValue(input: HTMLInputElement, value: string) {
  // Assign through the native setter only: writing `input.value` first would sync
  // React's change tracker and swallow the change event react-hook-form needs.
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function currentStepButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(`${STEP_NAV_SELECTOR} button`));
}

function activeStepIndexes(): number[] {
  return currentStepButtons()
    .map((button, index) => (button.getAttribute('aria-current') === 'step' ? index : -1))
    .filter((index) => index >= 0);
}

function click(button: HTMLButtonElement | undefined) {
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function fillStepOneIdentity() {
  setInputValue(document.querySelector<HTMLInputElement>('input[name="title"]')!, 'عمارة الاختبار');
  setInputValue(document.querySelector<HTMLInputElement>('input[name="type"]')!, 'سكني');
  setInputValue(document.querySelector<HTMLInputElement>('input[name="address"]')!, 'مسقط، الغبرة');
}

describe('PropertyFormModal — create wizard DOM', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    createPropertyWithAgreementMock.mockResolvedValue({ id: 'property-new' });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onClose = vi.fn();
    act(() => {
      root.render(<PropertyFormModal open onClose={onClose} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
  });

  it('opens as a labelled dialog with the wizard explained to assistive technology', () => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain('إضافة عقار جديد');
  });

  it('tracks the wizard with a labelled step list and exactly one current step', () => {
    const steps = currentStepButtons();
    expect(steps).toHaveLength(3);
    expect(activeStepIndexes()).toEqual([0]);
    // A tablist would promise arrow-key selection and a tabpanel this widget does
    // not own, because the steps are gated by validation.
    const nav = document.querySelector(STEP_NAV_SELECTOR);
    expect(nav?.getAttribute('role')).toBeNull();
    expect(document.querySelector('[role="tablist"], [role="tab"], [role="tabpanel"]')).toBeNull();
  });

  it('refuses a gated step, explains the missing fields, and never leaves inactive fields mounted', () => {
    const steps = currentStepButtons();
    click(steps[1]);

    expect(activeStepIndexes()).toEqual([0]);
    const alert = document.querySelector<HTMLElement>('[role="alert"]');
    expect(alert?.textContent).toContain('اسم العقار');
    expect(alert?.textContent).toContain('العنوان');
    // Step 2 belongs to another owner-selection surface; it is not present but
    // hidden, which would let stale fields be submitted with an invalid step.
    expect(document.querySelector('select[name="owner_id"], input[name="owner_id"]')).toBeNull();
    expect(document.body.textContent).not.toContain('2. المالك');
  });

  it('advances once the identity fields are valid and moves the current-step marker', () => {
    fillStepOneIdentity();
    click(currentStepButtons()[1]);

    expect(activeStepIndexes()).toEqual([1]);
    expect(document.body.textContent).toContain('2. المالك');
    // The previous step is unmounted, so the review surface cannot show a mix of
    // two steps' values.
    expect(document.querySelector('input[name="title"]')).toBeNull();
  });

  it('keeps the gated steps unreachable until the owner and commission are complete', () => {
    fillStepOneIdentity();
    click(currentStepButtons()[1]);
    click(currentStepButtons()[2]);

    expect(activeStepIndexes()).toEqual([1]);
    expect(document.body.textContent).toContain('يرجى اختيار المالك');
  });

  it('closes through the dialog affordances the user actually has', () => {
    const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'إلغاء',
    );
    click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('carries no WCAG violations in the rendered wizard', async () => {
    // Scoped to the dialog: the modal legitimately hides the background surface
    // from assistive technology while it is open.
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const results = await axe.run(dialog, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
    });
    const report = results.violations.map((violation) => `${violation.id}: ${violation.help}`);
    expect(report, report.join('\n')).toEqual([]);
  });
});
