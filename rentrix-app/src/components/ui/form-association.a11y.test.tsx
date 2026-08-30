// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EntityForm } from './entity-form';
import { FormField } from './form-field';
import { Input } from './input';
import { Select } from './select';
import { Textarea } from './textarea';

afterEach(cleanup);

function describedText(control: Element): string[] {
  const ids = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? '');
}

describe('EntityForm.Field — canonical field association', () => {
  it('keeps supporting copy as description and marks errors invalid', () => {
    render(<EntityForm.Field label="رقم العقد" description="يجب أن يكون فريدًا." error="رقم العقد مطلوب"><Input /></EntityForm.Field>);
    const control = screen.getByLabelText('رقم العقد');
    expect(describedText(control)).toEqual(expect.arrayContaining(['يجب أن يكون فريدًا.', 'رقم العقد مطلوب']));
    expect(control.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps select and textarea associated', () => {
    render(<><EntityForm.Field label="الحالة"><Select><option>نشط</option></Select></EntityForm.Field><EntityForm.Field label="ملاحظات"><Textarea /></EntityForm.Field></>);
    expect(screen.getByLabelText('الحالة').tagName).toBe('SELECT');
    expect(screen.getByLabelText('ملاحظات').tagName).toBe('TEXTAREA');
  });
});

describe('FormField — canonical lightweight field shell', () => {
  it('binds errors and required state to the control', () => {
    render(<FormField label="اسم العقار" htmlFor="property-name" required error="هذا الحقل مطلوب"><Input id="property-name" /></FormField>);
    const control = screen.getByLabelText(/اسم العقار/);
    expect(describedText(control)).toContain('هذا الحقل مطلوب');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-required')).toBe('true');
  });

  it('binds hints to the control', () => {
    render(<FormField label="الاسم" htmlFor="trade-name" hint="الاسم التجاري"><Input id="trade-name" /></FormField>);
    expect(describedText(screen.getByLabelText('الاسم'))).toContain('الاسم التجاري');
  });
});
