// @vitest-environment happy-dom
import { act, useEffect, useMemo } from 'react';
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
import { contractSchema, type ContractFormValues } from '@/features/contracts/contractSchema';
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
  const controller = {
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
    agreementCoverageQuery: { data: null, isLoading: false, isError: false, refetch: vi.fn() } as never,
    selectedProperty: properties[0],
    currentLinkedUnitId: null,
    handleSubmit,
  } as unknown as ContractFormController;
  return controller;
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

/** Mirrors the real submission path: schema.parse(values) before persisting. */
async function parseAndStore(values: ContractFormValues, store: (parsed: ContractFormValues) => void) {
  store(contractSchema.parse(values));
}

/** Flush pending microtasks inside act so async step transitions settle. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function setSelect(host: HTMLElement, label: string, value: string) {
  const selects = Array.from(host.querySelectorAll<HTMLSelectElement>('select'));
  const target = selects.find((select) => select.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`select not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setDate(host: HTMLElement, label: string, value: string) {
  const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input'));
  const target = inputs.find((input) => input.type === 'date' && input.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`date input not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setNumber(host: HTMLElement, label: string, value: string) {
  const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input'));
  const target = inputs.find((input) => input.type === 'number' && input.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`number input not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function setTextarea(host: HTMLElement, label: string, value: string) {
  const areas = Array.from(host.querySelectorAll<HTMLTextAreaElement>('textarea'));
  const target = areas.find((area) => area.closest('label')?.textContent?.includes(label));
  if (!target) throw new Error(`textarea not found: ${label}`);
  fireEvent.change(target, { target: { value } });
  await flush();
}

async function clickButton(host: HTMLElement, text: string) {
  const button = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  fireEvent.click(button);
  await flush();
}

function stepLabel(host: HTMLElement): string {
  return Array.from(host.querySelectorAll('[data-mobile-form-stepper-header] span'))
    .map((span) => span.textContent ?? '')
    .join(' | ');
}

describe('contract form mobile stepper — behavioral', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let submitted: ContractFormValues | null;

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
      root.render(<Harness onSubmit={async (values) => { await parseAndStore(values, (parsed) => { submitted = parsed; }); }} />);
    });
  };

  it('Next validates the current step and an invalid step cannot advance', async () => {
    await renderForm();
    expect(stepLabel(host)).toContain('الخطوة 1 من 4');
    await clickButton(host, 'التالي');
    // Empty parties step stays on step 1 with a field error.
    expect(stepLabel(host)).toContain('الخطوة 1 من 4');
    expect(host.textContent).toContain('اختر العقار');
  });

  it('valid steps advance and Back returns while entered state survives Next → Back', async () => {
    await renderForm();
    await setSelect(host, 'العقار', 'prop-1');
    await setSelect(host, 'الوحدة', '11111111-1111-4111-8111-111111111111');
    await setSelect(host, 'المستأجر', '22222222-2222-4222-8222-222222222222');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 2 من 4');

    await setDate(host, 'تاريخ البداية', '2026-01-01');
    await setDate(host, 'تاريخ النهاية', '2026-12-31');
    await setNumber(host, 'قيمة الإيجار', '120');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 3 من 4');

    await setTextarea(host, 'ملاحظات العقد', 'ملاحظة محفوظة');
    // Back to step 2, then forward — the note and all entries must survive.
    await clickButton(host, 'السابق');
    expect(stepLabel(host)).toContain('الخطوة 2 من 4');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 3 من 4');
    const noteArea = Array.from(host.querySelectorAll<HTMLTextAreaElement>('textarea')).find((a) => a.closest('label')?.textContent?.includes('ملاحظات العقد'));
    expect(noteArea?.value).toBe('ملاحظة محفوظة');

    // Property selection survives as well (controlled RHF state).
    const propertySelect = Array.from(host.querySelectorAll<HTMLSelectElement>('select')).find((s) => s.closest('label')?.textContent?.includes('العقار'));
    expect(propertySelect?.value).toBe('prop-1');
  });

  it('reaches the review step and submits with unchanged semantics (schema parse → payload)', async () => {
    await renderForm();
    await setSelect(host, 'العقار', 'prop-1');
    await setSelect(host, 'الوحدة', '11111111-1111-4111-8111-111111111111');
    await setSelect(host, 'المستأجر', '22222222-2222-4222-8222-222222222222');
    await clickButton(host, 'التالي');
    await setDate(host, 'تاريخ البداية', '2026-01-01');
    await setDate(host, 'تاريخ النهاية', '2026-12-31');
    await setNumber(host, 'قيمة الإيجار', '120');
    await clickButton(host, 'التالي');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 4 من 4');

    await clickButton(host, 'حفظ العقد');
    expect(submitted).not.toBeNull();
    expect(submitted?.property_id).toBe('prop-1');
    expect(submitted?.unit_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(submitted?.tenant_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(submitted?.rent_amount).toBe(120);
    expect(submitted?.end_date).toBe('2026-12-31');
  });

  it('a failed final validation returns the user to the step owning the error', async () => {
    await renderForm();
    await setSelect(host, 'العقار', 'prop-1');
    await setSelect(host, 'الوحدة', '11111111-1111-4111-8111-111111111111');
    await setSelect(host, 'المستأجر', '22222222-2222-4222-8222-222222222222');
    await clickButton(host, 'التالي');
    await setDate(host, 'تاريخ البداية', '2026-01-01');
    await setDate(host, 'تاريخ النهاية', '2026-12-31');
    await setNumber(host, 'قيمة الإيجار', '120');
    await clickButton(host, 'التالي');
    await clickButton(host, 'التالي');
    expect(stepLabel(host)).toContain('الخطوة 4 من 4');

    // While on the review step, corrupt the rent amount (period step owns it)
    // then submit: the final full-schema validation fails and the stepper must
    // return the user to the step owning the error.
    const rentInput = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      .find((input) => input.closest('label')?.textContent?.includes('قيمة الإيجار'));
    if (!rentInput) throw new Error('rent input not found');
    fireEvent.change(rentInput, { target: { value: '' } });
    await flush();

    await clickButton(host, 'حفظ العقد');
    // Let the async resolver + error-jump effect settle.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(stepLabel(host)).toContain('الخطوة 2 من 4');
    expect(host.textContent).toContain('قيمة الإيجار مطلوبة');
  });
});
