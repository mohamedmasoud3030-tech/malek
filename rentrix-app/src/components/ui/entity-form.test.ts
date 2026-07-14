import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntityForm, getResponsiveFormSurface } from './entity-form';

describe('responsive form overlay surface selection', () => {
  it('uses a bottom sheet for mobile form workflows', () => {
    expect(getResponsiveFormSurface(true)).toBe('bottom-sheet');
  });

  it('keeps the desktop dialog surface above the mobile breakpoint', () => {
    expect(getResponsiveFormSurface(false)).toBe('dialog');
  });
});

describe('shared entity form composition', () => {
  it('renders one semantic label shell for feature form controls', () => {
    const html = renderToStaticMarkup(createElement(
      EntityForm.Field,
      { label: 'الاسم', children: createElement('input', { name: 'name' }) },
    ));

    expect(html).toContain('<label');
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
    expect(html).toContain('رقم العقد مطلوب');
  });
});