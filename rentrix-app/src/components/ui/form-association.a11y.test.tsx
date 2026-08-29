// @vitest-environment happy-dom
/**
 * Form-association accessibility contract (DESIGN_SYSTEM_GUIDE §6).
 *
 * Guards the three shared field shells against the two failure modes that are
 * invisible on screen and therefore easy to reintroduce:
 *
 *  1. supporting copy (description/hint/error) folded into the control's
 *     accessible NAME instead of being exposed as its DESCRIPTION;
 *  2. supporting copy rendered with an id nothing points at, so it is never
 *     announced at all.
 *
 * Both are WCAG 1.3.1 / 3.3.1 / 3.3.3 failures that no visual review catches.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EntityForm } from './entity-form';
import { FormField } from './form-field';
import { TextField } from './text-field';
import { Input } from './input';
import { Select } from './select';
import { Textarea } from './textarea';

afterEach(cleanup);

/** Resolves the text an assistive technology announces as the description. */
function describedText(control: Element): string[] {
  const ids = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? '');
}

describe('EntityForm.Field — name/description separation', () => {
  it('names the control with the label alone', () => {
    render(
      <EntityForm.Field label="اسم المستأجر" description="الاسم كما في البطاقة" error="هذا الحقل مطلوب">
        <Input />
      </EntityForm.Field>,
    );

    // Would throw if the name had absorbed the description/error copy.
    expect(screen.getByLabelText('اسم المستأجر')).toBeTruthy();
  });

  it('exposes description and error as description, not as name', () => {
    render(
      <EntityForm.Field label="رقم العقد" description="يجب أن يكون فريدًا." error="رقم العقد مطلوب">
        <Input />
      </EntityForm.Field>,
    );

    const control = screen.getByLabelText('رقم العقد');
    expect(describedText(control)).toEqual(
      expect.arrayContaining(['يجب أن يكون فريدًا.', 'رقم العقد مطلوب']),
    );
  });

  it('marks an errored field invalid so the state is not colour-only', () => {
    render(
      <EntityForm.Field label="المبلغ" error="القيمة غير صالحة">
        <Input />
      </EntityForm.Field>,
    );

    expect(screen.getByLabelText('المبلغ').getAttribute('aria-invalid')).toBe('true');
  });

  it('leaves a plain field free of dangling description references', () => {
    render(<EntityForm.Field label="رقم الهاتف"><Input /></EntityForm.Field>);

    const control = screen.getByLabelText('رقم الهاتف');
    expect(control.getAttribute('aria-describedby')).toBeNull();
    expect(control.getAttribute('aria-invalid')).toBeNull();
  });

  it('keeps select and textarea children associated', () => {
    render(
      <>
        <EntityForm.Field label="الحالة"><Select><option>نشط</option></Select></EntityForm.Field>
        <EntityForm.Field label="ملاحظات"><Textarea /></EntityForm.Field>
      </>,
    );

    expect(screen.getByLabelText('الحالة').tagName).toBe('SELECT');
    expect(screen.getByLabelText('ملاحظات').tagName).toBe('TEXTAREA');
  });

  it('never overrides an explicit accessible name supplied by the caller', () => {
    render(
      <EntityForm.Field label="مرئي">
        <Input aria-label="اسم صريح" />
      </EntityForm.Field>,
    );

    expect(screen.getByLabelText('اسم صريح')).toBeTruthy();
  });

  it('still associates a label when the child is not a single control', () => {
    render(
      <EntityForm.Field label="مجموعة">
        <div><Input /></div>
      </EntityForm.Field>,
    );

    expect(document.querySelector('input')?.closest('label')).toBeTruthy();
  });
});

describe('FormField — description reaches the control', () => {
  it('binds the error to the control and marks it invalid', () => {
    render(
      <FormField label="اسم العقار" htmlFor="property-name" required error="هذا الحقل مطلوب">
        <Input id="property-name" />
      </FormField>,
    );

    const control = screen.getByLabelText(/اسم العقار/);
    expect(describedText(control)).toContain('هذا الحقل مطلوب');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-required')).toBe('true');
  });

  it('binds the hint to the control', () => {
    render(
      <FormField label="الاسم" htmlFor="trade-name" hint="الاسم التجاري">
        <Input id="trade-name" />
      </FormField>,
    );

    expect(describedText(screen.getByLabelText('الاسم'))).toContain('الاسم التجاري');
  });

  it('labels the control even when the call site omits htmlFor', () => {
    render(
      <FormField label="القناة">
        <Select><option>واتساب</option></Select>
      </FormField>,
    );

    expect(screen.getByLabelText('القناة').tagName).toBe('SELECT');
  });

  it('leaves a plain field free of dangling description references', () => {
    render(<FormField label="عادي" htmlFor="plain"><Input id="plain" /></FormField>);

    expect(screen.getByLabelText('عادي').getAttribute('aria-describedby')).toBeNull();
  });
});

describe('TextField — the composed field shell stays correct', () => {
  it('routes the description to the control', () => {
    render(<TextField label="البريد الإلكتروني" description="سيُستخدم للتنبيهات" />);

    const control = screen.getByLabelText('البريد الإلكتروني');
    expect(describedText(control)).toContain('سيُستخدم للتنبيهات');
  });

  it('never advertises a description that is not rendered', () => {
    // The description paragraph is replaced by the message, so its id must
    // leave aria-describedby with it.
    render(<TextField label="البريد الإلكتروني" description="سيُستخدم للتنبيهات" error="بريد غير صالح" />);

    const control = screen.getByLabelText('البريد الإلكتروني');
    expect(describedText(control)).toEqual(['بريد غير صالح']);
    expect(control.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps every described id resolvable across message tones', () => {
    render(
      <>
        <TextField label="حقل تحذير" description="وصف" warning="تحذير" />
        <TextField label="حقل نجاح" description="وصف" success="تم" />
      </>,
    );

    for (const label of ['حقل تحذير', 'حقل نجاح']) {
      const control = screen.getByLabelText(label);
      const ids = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(document.getElementById(id), `dangling ${id}`).not.toBeNull();
    }
  });
});
