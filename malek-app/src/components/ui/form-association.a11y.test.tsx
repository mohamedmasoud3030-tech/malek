// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EntityForm } from './entity-form';
import { Input } from './input';
import { Select } from './select';
import { Textarea } from './textarea';

afterEach(cleanup);

function describedText(control: Element): string[] {
  const ids = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? '');
}

/**
 * The retired `FormField` shell was merged into the single canonical field
 * contract. These cases keep its required/hint and error association
 * coverage alive against `EntityForm.Field`.
 */
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

  it('binds errors and required state to the control', () => {
    render(<EntityForm.Field label="اسم العقار" required error="هذا الحقل مطلوب"><Input /></EntityForm.Field>);
    const control = screen.getByLabelText(/اسم العقار/);
    expect(describedText(control)).toContain('هذا الحقل مطلوب');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-required')).toBe('true');
  });

  it('binds hints to the control', () => {
    render(<EntityForm.Field label="الاسم" hint="الاسم التجاري"><Input /></EntityForm.Field>);
    expect(describedText(screen.getByLabelText('الاسم'))).toContain('الاسم التجاري');
  });
});
