import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DataErrorScreen } from './data-error-screen';
import { EmptyState } from './ui/state-surfaces';
import { RouteErrorFallback } from './error-boundary';
import { LoadingState } from './ui/loading-state';

const copy = {
  dataErrorTitle: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
  fallback: '\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639',
  diagnostic: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0635\u062f\u0631',
  emptyTitle: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a',
  emptyDescription: '\u0627\u0628\u062f\u0623 \u0628\u0625\u0636\u0627\u0641\u0629 \u0623\u0648\u0644 \u0633\u062c\u0644.',
  alertTitle: '\u062a\u0639\u0630\u0631 \u0639\u0631\u0636 \u0627\u0644\u0646\u062a\u0627\u0626\u062c',
  alertDescription: '\u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u0627\u062d\u0642\u064b\u0627.',
  routeLoading: '\u062c\u0627\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644',
  routeErrorTitle: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629',
  retry: '\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629',
};

vi.mock('@/lib/runtime-diagnostics', () => ({
  getEnvDiagnostics: vi.fn(() => []),
  parseSupabaseDiagnostics: vi.fn((error: unknown) => error instanceof Error
    ? [{
        code: 'SUPABASE_TEST',
        messageAr: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0635\u062f\u0631',
        technical: error.message,
      }]
    : []),
}));

describe('shared recovery-state semantics', () => {
  it('announces a data error assertively and keeps the fallback copy visible', () => {
    const html = renderToStaticMarkup(
      <DataErrorScreen title={copy.dataErrorTitle} fallbackMessage={copy.fallback} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain(copy.dataErrorTitle);
    expect(html).toContain(copy.fallback);
  });

  it('renders the first diagnostic message without exposing technical details', () => {
    const html = renderToStaticMarkup(
      <DataErrorScreen
        title={copy.dataErrorTitle}
        fallbackMessage={copy.fallback}
        error={new Error('test supabase failure')}
      />,
    );

    expect(html).toContain(copy.diagnostic);
    expect(html).not.toContain('test supabase failure');
  });

  it('announces an empty state politely by default', () => {
    const html = renderToStaticMarkup(
      <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(copy.emptyTitle);
    expect(html).toContain(copy.emptyDescription);
  });

  it('supports assertive alert semantics for exceptional empty states', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title={copy.alertTitle}
        description={copy.alertDescription}
        role="alert"
        ariaLive="assertive"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  it('announces route loading politely with an Arabic accessible label', () => {
    const html = renderToStaticMarkup(<LoadingState variant="route" />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="');
  });

  it('announces route errors assertively and keeps the retry action visible', () => {
    const html = renderToStaticMarkup(
      <RouteErrorFallback error={new Error('route load failed')} reset={vi.fn()} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain(copy.routeErrorTitle);
    expect(html).toContain(copy.retry);
    expect(html).toContain('route load failed');
  });
});
