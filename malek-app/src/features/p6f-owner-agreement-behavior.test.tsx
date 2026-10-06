// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AgreementSubmitPayload = {
  owner_id: string;
  property_id: string;
  starts_on: string;
  ends_on: string;
  collection_role: 'OWNER_IS_CREDITOR' | 'OFFICE_IS_CREDITOR';
  commission_type: 'RATE' | 'FIXED_MONTHLY';
  commission_value: number;
};

const agreementMutation = vi.hoisted(() => {
  const state = { payload: null as AgreementSubmitPayload | null };
  const spy = vi.fn(async (payload: AgreementSubmitPayload) => {
    state.payload = payload;
    return { id: 'agreement-1' };
  });
  return { state, spy };
});
const ownershipState = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false, isError: false }));
const ownersState = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false, isError: false }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'property_owners') return ownershipState;
    if (queryKey[0] === 'owners') return ownersState;
    return { data: [], isLoading: false, isError: false };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/features/owners/useOwnerAgreements', () => ({
  useOwnerAgreements: () => ({ data: [], isLoading: false, isError: false }),
  useOwnerAgreementVersions: () => ({ data: [], isLoading: false, isError: false }),
  useCreateOwnerAgreement: () => ({ mutateAsync: agreementMutation.spy, isPending: false }),
  useCreateOwnerAgreementVersion: () => ({ mutateAsync: vi.fn(async () => ({})), isPending: false }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OwnerAgreementsManager } from '@/features/owners/OwnerAgreementsManager';

const OWNER_ID = 'owner-1';
const PROPERTY_ID = 'prop-1';

function baseOwner() {
  return {
    id: OWNER_ID,
    full_name: 'مالك تجريبي',
    display_name: null,
    phone: null,
    email: null,
    national_id: null,
    tax_number: null,
    address: null,
    notes: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function baseLink() {
  return {
    id: 'link-1',
    property_id: PROPERTY_ID,
    owner_id: OWNER_ID,
    ownership_percentage: 100,
    is_primary: true,
    starts_on: '2026-06-01',
    ends_on: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    owner: baseOwner(),
  };
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

async function clickButton(text: string) {
  const button = Array.from(document.body.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  fireEvent.click(button);
  await flush();
}

async function setSelect(label: string, value: string) {
  const target = Array.from(document.body.querySelectorAll<HTMLSelectElement>('select'))
    .find((select) => select.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`select not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setDate(label: string, value: string) {
  const target = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="date"]'))
    .find((input) => input.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`date input not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setNumber(label: string, value: string) {
  const target = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="number"]'))
    .find((input) => input.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`number input not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

function stepLabel(): string {
  return Array.from(document.body.querySelectorAll('[data-mobile-form-stepper-header] span'))
    .map((span) => span.textContent ?? '')
    .join(' | ');
}

describe('owner agreement mobile stepper — behavioral', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    agreementMutation.spy.mockClear();
    agreementMutation.state.payload = null;
    ownershipState.data = [baseLink()];
    ownersState.data = [baseOwner()];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderManager = async () => {
    await act(async () => { root.render(<OwnerAgreementsManager propertyId={PROPERTY_ID} />); });
    await clickButton('إضافة اتفاقية');
  };

  it('keeps owner and dates together and preserves them when moving back', async () => {
    await renderManager();
    expect(stepLabel()).toContain('الخطوة 1 من 3');
    await setSelect('المالك', OWNER_ID);
    await setDate('تاريخ البداية', '2026-07-01');
    await setDate('تاريخ النهاية', '2026-12-31');
    await clickButton('التالي');
    expect(stepLabel()).toContain('الخطوة 2 من 3');
    await clickButton('السابق');
    expect(stepLabel()).toContain('الخطوة 1 من 3');
    const ownerSelect = Array.from(document.body.querySelectorAll<HTMLSelectElement>('select')).find((select) => select.closest('label')?.textContent?.includes('المالك'));
    expect(ownerSelect?.value).toBe(OWNER_ID);
  });

  it('blocks an invalid date range on the first step', async () => {
    await renderManager();
    await setSelect('المالك', OWNER_ID);
    await setDate('تاريخ البداية', '2026-07-01');
    await setDate('تاريخ النهاية', '2025-12-31');
    await clickButton('التالي');
    expect(stepLabel()).toContain('الخطوة 1 من 3');
    expect(document.body.textContent).toContain('تاريخ نهاية الاتفاقية يجب ألا يسبق البداية');
  });

  it('blocks an owner whose ownership does not cover the chosen period', async () => {
    await renderManager();
    await setSelect('المالك', OWNER_ID);
    await setDate('تاريخ البداية', '2026-01-01');
    await setDate('تاريخ النهاية', '2026-12-31');
    await clickButton('التالي');
    expect(stepLabel()).toContain('الخطوة 1 من 3');
    expect(document.body.textContent).toContain('لا تغطي ملكيته الفترة المختارة كاملة');
  });

  it('keeps collection and commission explicit and submits them through the existing mutation', async () => {
    await renderManager();
    await setSelect('المالك', OWNER_ID);
    await setDate('تاريخ البداية', '2026-07-01');
    await setDate('تاريخ النهاية', '2026-12-31');
    await clickButton('التالي');
    expect(stepLabel()).toContain('الخطوة 2 من 3');

    await setSelect('من يطالب المستأجر بالإيجار؟', 'OFFICE_IS_CREDITOR');
    await setSelect('طريقة عمولة المكتب', 'FIXED_MONTHLY');
    await setNumber('العمولة الشهرية', '25');
    await clickButton('التالي');

    expect(stepLabel()).toContain('الخطوة 3 من 3');
    expect(document.body.textContent).toContain('راجع الاتفاقية');
    expect(document.body.textContent).toContain('المكتب هو الدائن');
    expect(document.body.textContent).toContain('مبلغ شهري ثابت');

    await clickButton('حفظ الاتفاقية');
    await flush();
    expect(agreementMutation.spy).toHaveBeenCalledTimes(1);
    expect(agreementMutation.state.payload).toMatchObject({
      owner_id: OWNER_ID,
      property_id: PROPERTY_ID,
      starts_on: '2026-07-01',
      ends_on: '2026-12-31',
      collection_role: 'OFFICE_IS_CREDITOR',
      commission_type: 'FIXED_MONTHLY',
      commission_value: 25,
    });
  });
});
