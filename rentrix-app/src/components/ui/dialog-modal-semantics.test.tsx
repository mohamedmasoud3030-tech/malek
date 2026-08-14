// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle } from './dialog';

afterEach(() => cleanup());

/**
 * WP-06 / GAP-020 regression.
 *
 * Radix emits role="dialog" but never aria-modal. WAI-ARIA APG requires
 * aria-modal="true" on a modal dialog so assistive technology announces the
 * modal boundary. The Browser Readiness desktop shard asserts this on the
 * mobile navigation drawer; this unit test locks the shared primitive so the
 * attribute cannot regress for any dialog surface in the app.
 */
describe('DialogContent modal semantics', () => {
  it('exposes aria-modal="true" on every modal dialog surface', () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false} aria-describedby={undefined}>
          <DialogTitle>نافذة معيارية</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('keeps aria-modal="true" on right-anchored drawer content', () => {
    render(
      <Dialog open>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          data-mobile-drawer
          className="fixed bottom-0 left-auto right-0 top-0 h-dvh w-[88vw]"
        >
          <DialogTitle>القائمة الرئيسية</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveAttribute('data-mobile-drawer');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
  });

  it('allows an explicit override to win over the default', () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false} aria-describedby={undefined} aria-modal="false">
          <DialogTitle>نافذة غير حاجزة</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
  });
});
