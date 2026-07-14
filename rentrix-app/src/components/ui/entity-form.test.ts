// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityForm, focusFirstInvalidField, getResponsiveFormSurface } from './entity-form';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('responsive form overlay surface selection', () => {
  it('uses a bottom sheet for mobile form workflows by default', () => {
    expect(getResponsiveFormSurface(true)).toBe('bottom-sheet');
  });

  it('keeps the desktop dialog surface above the mobile breakpoint', () => {
    expect(getResponsiveFormSurface(false)).toBe('dialog');
  });

  it('allows long mobile forms to choose the full-page contract explicitly', () => {
    expect(getResponsiveFormSurface(true, 'auto', 'full-page')).toBe('full-page');
    expect(getResponsiveFormSurface(false, 'full-page')).toBe('full-page');
  });
});

describe('shared entity form composition', () => {
  it('renders one semantic label shell for feature form controls', () => {
    const html = renderToStaticMarkup(createElement(
      EntityForm.Field,
      { label: 'الاسم', children: createElement('input', { name: 'name' }) },
    ));

    expect(html).toContain('<label');
    expect(html).toContain('data-entity-form-field');
    expect(html).toContain('الاسم');
    expect(html).toContain('<input name="name"/>');
  });

  it('owns optional field guidance and accessible validation errors', () => {
    const html = renderToStaticMarkup(createElement(
      EntityForm.Field,
      {
        label: 'رقم العقد',
        description: 'يجب أن يكون فريدًا.',
        error: 'رقم العقد مطلوب',
        children: createElement('input', { name: 'contract_number' }),
      },
    ));

    expect(html).toContain('يجب أن يكون فريدًا.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-field-error');
    expect(html).toContain('رقم العقد مطلوب');
  });

  it('focuses and centers the first invalid field after validation fails', () => {
    const form = document.createElement('form');
    const firstValid = document.createElement('input');
    const firstInvalid = document.createElement('input');
    const laterInvalid = document.createElement('input');
    firstInvalid.setAttribute('aria-invalid', 'true');
    laterInvalid.setAttribute('aria-invalid', 'true');
    firstInvalid.scrollIntoView = vi.fn();
    form.append(firstValid, firstInvalid, laterInvalid);
    document.body.appendChild(form);

    const focused = focusFirstInvalidField(form, 'auto');

    expect(focused).toBe(firstInvalid);
    expect(document.activeElement).toBe(firstInvalid);
    expect(firstInvalid.scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'auto' });
  });

  it('leaves focus unchanged when the form has no invalid controls', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    form.appendChild(input);
    document.body.appendChild(form);
    input.focus();

    expect(focusFirstInvalidField(form, 'auto')).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});