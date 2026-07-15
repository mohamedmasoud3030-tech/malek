/**
 * @vitest-environment happy-dom
 *
 * Validates that PropertyFormCoreFields accepts a typed form without
 * requiring `as unknown as` casts at the call-site.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useForm } from 'react-hook-form';
import { PropertyFormCoreFields } from './property-form-core-fields';

/* ── Test harness component ─────────────────────────────────────────── */

interface TestFormValues {
  title: string;
  type: string;
  address: string;
  status: string;
  purchase_value: number | null;
  current_value: number | null;
  notes: string;
}

function Harness() {
  const form = useForm<TestFormValues>({
    defaultValues: { title: '', type: '', address: '', status: 'active', purchase_value: null, current_value: null, notes: '' },
  });
  return (
    <form data-testid="harness-form">
      <PropertyFormCoreFields register={form.register} errors={form.formState.errors} />
    </form>
  );
}

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('PropertyFormCoreFields', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    document.body.removeChild(container);
  });

  it('renders all seven core fields without type-cast regressions', async () => {
    await act(async () => { root.render(<Harness />); });

    const labels = Array.from(container.querySelectorAll('label'));
    const labelText = labels.map((l) => l.textContent).join(' ');

    // All 7 fields must render
    expect(labelText).toContain('اسم العقار');
    expect(labelText).toContain('نوع العقار');
    expect(labelText).toContain('العنوان');
    expect(labelText).toContain('الحالة');
    expect(labelText).toContain('قيمة الشراء');
    expect(labelText).toContain('القيمة الحالية');
    expect(labelText).toContain('ملاحظات');
  });

  it('renders status select with all property status options', async () => {
    await act(async () => { root.render(<Harness />); });

    const statusSelect = container.querySelector('select') as HTMLSelectElement;
    expect(statusSelect).toBeTruthy();

    const optionTexts = Array.from(statusSelect.options).map((o) => o.textContent);
    expect(optionTexts).toEqual(expect.arrayContaining(['نشط', 'غير نشط', 'صيانة', 'مباع']));
  });

  it('does not render agreement-specific fields (owner, commission)', async () => {
    await act(async () => { root.render(<Harness />); });

    const text = container.textContent ?? '';
    expect(text).not.toContain('المالك');
    expect(text).not.toContain('نوع الاتفاقية');
    expect(text).not.toContain('العمولة');
  });
});
