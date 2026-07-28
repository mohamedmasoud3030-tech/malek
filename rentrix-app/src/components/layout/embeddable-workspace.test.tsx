// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmbeddableWorkspace } from './embeddable-workspace';

/**
 * The rendering contract every finance workspace shares.
 *
 * This is the component that decides whether a workspace owns a page shell, so
 * it is the single place where "no duplicated layout / no duplicated header"
 * has to hold. Testing it directly (rather than only through the hub, which
 * mocks its section bodies) is what keeps the guarantee honest.
 */

afterEach(cleanup);

describe('EmbeddableWorkspace — standalone mode', () => {
  it('owns the page shell when not embedded', () => {
    const { container } = render(
      <EmbeddableWorkspace title="عنوان" description="وصف">
        <p>محتوى</p>
      </EmbeddableWorkspace>,
    );

    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'عنوان' })).toBeTruthy();
    expect(screen.getByText('وصف')).toBeTruthy();
    expect(screen.getByText('محتوى')).toBeTruthy();
  });

  it('renders header actions inside the page header', () => {
    const { container } = render(
      <EmbeddableWorkspace
        title="عنوان"
        primaryAction={<button type="button">إجراء رئيسي</button>}
        secondaryActions={<button type="button">إجراء ثانوي</button>}
      >
        <p>محتوى</p>
      </EmbeddableWorkspace>,
    );

    const header = container.querySelector('[data-page-header]');
    expect(header?.textContent).toContain('إجراء رئيسي');
    expect(header?.textContent).toContain('إجراء ثانوي');
  });
});

describe('EmbeddableWorkspace — embedded mode', () => {
  it('renders no page layout and no page header', () => {
    const { container } = render(
      <EmbeddableWorkspace embedded title="عنوان" description="وصف">
        <p>محتوى</p>
      </EmbeddableWorkspace>,
    );

    expect(container.querySelector('[data-page-layout]')).toBeNull();
    expect(container.querySelector('[data-page-header]')).toBeNull();
  });

  it('does not repeat the title, because the hub header already shows it', () => {
    render(
      <EmbeddableWorkspace embedded title="عنوان مكرر" description="وصف مكرر">
        <p>محتوى</p>
      </EmbeddableWorkspace>,
    );

    expect(screen.queryByRole('heading', { name: 'عنوان مكرر' })).toBeNull();
    expect(screen.queryByText('وصف مكرر')).toBeNull();
  });

  it('still renders the workspace content', () => {
    render(
      <EmbeddableWorkspace embedded title="عنوان">
        <p>محتوى مهم</p>
      </EmbeddableWorkspace>,
    );

    expect(screen.getByText('محتوى مهم')).toBeTruthy();
  });

  it('keeps page actions reachable instead of dropping them with the header', () => {
    render(
      <EmbeddableWorkspace
        embedded
        title="عنوان"
        primaryAction={<button type="button">إجراء رئيسي</button>}
        secondaryActions={<button type="button">إجراء ثانوي</button>}
      >
        <p>محتوى</p>
      </EmbeddableWorkspace>,
    );

    expect(screen.getByRole('button', { name: 'إجراء رئيسي' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'إجراء ثانوي' })).toBeTruthy();
  });

  it('omits the action rail entirely when a workspace has no actions', () => {
    const { container } = render(
      <EmbeddableWorkspace embedded title="عنوان">
        <p>محتوى</p>
      </EmbeddableWorkspace>,
    );

    expect(container.querySelector('[data-workspace-actions]')).toBeNull();
  });
});

describe('EmbeddableWorkspace — mode parity', () => {
  it('renders identical content in both modes, differing only by the shell', () => {
    const content = <p data-testid="body">نفس المحتوى</p>;

    const standalone = render(<EmbeddableWorkspace title="عنوان">{content}</EmbeddableWorkspace>);
    const standaloneBody = standalone.getByTestId('body').textContent;
    cleanup();

    const embedded = render(<EmbeddableWorkspace embedded title="عنوان">{content}</EmbeddableWorkspace>);
    const embeddedBody = embedded.getByTestId('body').textContent;

    expect(embeddedBody).toBe(standaloneBody);
  });
});
