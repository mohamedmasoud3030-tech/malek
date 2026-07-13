import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getResponsiveFormSurface } from './entity-form';
import { EntityForm } from './entity-form';

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
});
