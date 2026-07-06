import { describe, expect, it } from 'vitest';
import { getResponsiveFormSurface } from './entity-form';

describe('responsive form overlay surface selection', () => {
  it('uses a bottom sheet for mobile form workflows', () => {
    expect(getResponsiveFormSurface(true)).toBe('bottom-sheet');
  });

  it('keeps the desktop dialog surface above the mobile breakpoint', () => {
    expect(getResponsiveFormSurface(false)).toBe('dialog');
  });
});
