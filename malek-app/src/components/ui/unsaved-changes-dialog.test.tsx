// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

afterEach(cleanup);

describe('UnsavedChangesDialog', () => {
  it('keeps the canonical warning copy and delegates discard/cancel actions', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(<UnsavedChangesDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    expect(screen.getByRole('heading', { name: 'تغييرات غير محفوظة' })).toBeTruthy();
    expect(screen.getByText('هناك تغييرات لم تحفظ. إذا غادرت الآن سوف تفقد هذه التغييرات.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تجاهل التغييرات' }));
    fireEvent.click(screen.getByRole('button', { name: 'مواصلة التعديل' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
