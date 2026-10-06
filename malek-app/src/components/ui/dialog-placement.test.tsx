// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle } from './dialog';

afterEach(() => cleanup());

describe('DialogContent placement', () => {
  it('keeps centered dialogs on the shared midpoint transform', () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>نافذة وسطية</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveStyle({
      transform: 'translate3d(-50%, -50%, 0)',
    });
  });

  it('anchors right-side mobile drawers without midpoint translation or inherited padding', () => {
    render(
      <Dialog open>
        <DialogContent
          showCloseButton={false}
          className="fixed bottom-0 left-auto right-0 top-0 h-dvh w-[88vw]"
        >
          <DialogTitle>القائمة الرئيسية</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveStyle({
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: 'auto',
      transform: 'none',
      padding: '0px',
    });
  });
});
