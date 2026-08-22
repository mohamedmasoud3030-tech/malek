// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

import { ContractFormFields } from '@/features/contracts/components/ContractFormFields';
import { contractSchema, type ContractFormValues, type ContractPayload } from '@/features/contracts/contractSchema';
import type { useContractForm } from '@/features/contracts/useContractForm';

type ContractFormController = ReturnType<typeof useContractForm>;

const defaultValues: ContractFormValues = {
  property_id: '',
  unit_id: '',
  tenant_id: '',
  start_date: '',
  end_date: '',
  rent_amount: 0,
  payment_cycle: 'monthly',
  billing_day: 1,
  grace_days: 0,
  payment_terms_id: '',
  status: 'draft',
  cancellation_reason: '',
  notes: '',
  attachment_url: null,
};

function createController(handleSubmit: (values: ContractFormValues) => Promise<void>) {
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema, undefined, { raw: true }),
    defaultValues,
  });
  const properties = [{ id: 'prop-1', title: 'برج الواحة' }];
  const people = [{ id: '22222222-2222-4222-8222-222222222222', full_name: 'مستأجر تجريبي' }];
  const units = [{ id: '11111111-1111-4111-8111-111111111111', property_id: 'prop-1', unit_number: 'A-101', status: 'available', rent_amount: 100 }];
  return {
    form,
    isEdit: false,
    submitting: false,
    contractQuery: { data: undefined, isLoading: false, isError: false } as never,
    propertiesQuery: { data: { rows: properties }, isLoading: false, isError: false } as never,
    peopleQuery: { data: { rows: people }, isLoading: false, isError: false } as never,
    paymentTermsQuery: { data: [] } as never,
    unitsQuery: { data: units, isLoading: false, isError: false } as never,
    unitConflictsQuery: { data: [], isLoading: false, isError: false } as never,
    unitConflictsByUnitId: new Map() as never,
    unitDraftsQuery: { data: [], isLoading: false, isError: false } as never,
    unitDraftsByUnitId: new Map() as never,
    agreementCoverageQuery: { data: null, isLoading: false, isError: false, refetch: vi.fn() } as never,
    selectedProperty: properties[0],
    currentLinkedUnitId: null,
    handleSubmit,
  } as unknown as ContractFormController;
}

function Harness({ onSubmit }: { onSubmit: (values: ContractFormValues) => Promise<void> }) {
  const controller = createController(onSubmit);
  return (
    <ContractFormFields
      controller={controller}
      onSubmit={controller.form.handleSubmit(controller.handleSubmit)}
      onCancel={() => undefined}
    />
  );
}

async function parseAndStore(values: ContractFormValues, store: (parsed: ContractPayload) => void) {
  store(contractSchema.parse(values));
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

async function setSelect(host: HTMLElement, label: string, value: string) {
  const target = Array.from(host.querySelectorAll<HTMLSelectElement>('select'))
    .find((select) => select.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`select not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setDate(host: HTMLElement, label: string, value: string) {
  const target = Array.from(host.querySelectorAll<HTMLInputElement>('input'))
    .find((input) => input.type === 'date' && input.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`date input not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setNumber(host: HTMLElement, label: string, value: string) {
  const target = Array.from(host.querySelectorAll<HTMLInputElement>('input'))
    .find((input) => input.type === 'number' && input.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`number input not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setTextarea(host: HTMLElement, label: string, value: string) {
  const target = Array.from(host.querySelectorAll<HTMLTextAreaElement>('textarea'))
    .find((area) => area.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`textarea not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function clickButton(host: HTMLElement, text: string) {
  const button = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  fireEvent.click(button);
  await flush();
}

function stepLabel(host: HTMLElement): string {
  return Array.from(host.querySelectorAll('[data-mobile-form-stepper-header] span'))
    .map((span) => span.textContent ?? '')
    .join(' | ');
}

async function fillRequiredPartiesAndFinancials(host: HTMLElement) {
  await setSelect(host, 'العقار', 'prop-1');
  await setSelect(host, 'الوحدة', '11111111-1111-4111-8111-111111111111');
  await setSelect(host, 'المستأجر', '22222222-2222-4222-8222-222222222222');
  await clickButton(host, 'التالي');
  await setDate(host, 'تاريخ البداية', '2026-01-01');
  await setDate(host, 'تاريخ النهاية', '2026-12-31');
  await setNumber(host, 'قيمة الدفعة التعاقدية', '120');
  await setNumber(host, 'يوم الفوترة', '5');
  await setNumber(host, 'أيام السماح', '3');
}

describe('contract form mobile stepper — behavioral', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let submitted: ContractPayload | null;

  beforeEach(() => {
    submitted = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderForm = async () => {
    await act(async () => {
      root.render(<Harness onSubmit={async (values) => {
        await parseAndStore(values, (parsed) => { submitted = parsed; });
      }} />);
    });
  };

  it('Next validates the current step and an invalid step cannot advance', async () => {
    await renderForm();
    expect(stepLabel(host)).toContain('الخطوة 1 من 4');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 1 من 4');
    expect(host.textContent).toContain('اختر العقار');
  });

  it('valid steps advance and Back preserves entered state', async () => {
    await renderForm();
    await fillRequiredPartiesAndFinancials(host);
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 3 من 4');

    await setTextarea(host, 'ملاحظات العقد', 'ملاحظة محفوظة');
    await clickButton(host, 'السابق');
    expect(stepLabel(host)).toContain('الخطوة 2 من 4');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 3 من 4');

    const noteArea = Array.from(host.querySelectorAll<HTMLTextAreaElement>('textarea'))
      .find((area) => area.closest('label')?.textContent?.includes('ملاحظات العقد'));
    expect(noteArea?.value).toBe('ملاحظة محفوظة');
  });

  it('shows the schedule review and submits the current billing semantics', async () => {
    await renderForm();
    await fillRequiredPartiesAndFinancials(host);
    await clickButton(host, 'التالي');
    await clickButton(host, 'التالي');

    expect(stepLabel(host)).toContain('الخطوة 4 من 4');
    expect(host.textContent).toContain('مراجعة دورة السداد المتوقعة');
    expect(host.textContent).toContain('قيمة الدفعة التعاقدية لكل دورة');
    expect(host.textContent).toContain('عدد دورات السداد المتوقع');
    expect(host.textContent).toContain('الخادم');

    await clickButton(host, 'حفظ العقد');
    expect(submitted).not.toBeNull();
    expect(submitted?.rent_amount).toBe(120);
    expect(submitted?.billing_day).toBe(5);
    expect(submitted?.grace_days).toBe(3);
    expect(submitted?.end_date).toBe('2026-12-31');
  });

  it('a failed payment amount returns the user to the financial step', async () => {
    await renderForm();
    await fillRequiredPartiesAndFinancials(host);
    await clickButton(host, 'التالي');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 4 من 4');

    await setNumber(host, 'قيمة الدفعة التعاقدية', '');
    await clickButton(host, 'حفظ العقد');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(stepLabel(host)).toContain('الخطوة 2 من 4');
    expect(host.textContent).toContain('قيمة الدفعة التعاقدية مطلوبة');
  });

  it('a failed billing policy field returns the user to the financial step', async () => {
    await renderForm();
    await fillRequiredPartiesAndFinancials(host);
    await clickButton(host, 'التالي');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 4 من 4');

    await setNumber(host, 'يوم الفوترة', '29');
    await clickButton(host, 'حفظ العقد');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(stepLabel(host)).toContain('الخطوة 2 من 4');
    expect(host.textContent).toContain('يوم الفوترة يجب أن يكون بين 1 و28');
  });
});
