import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WriteErrorCard } from './error-state';

describe('WriteErrorCard', () => {
  it('never exposes raw provider/Error.message copy', () => {
    const html = renderToStaticMarkup(
      <WriteErrorCard
        error={new Error('permission denied for table commissions (SQLSTATE 42501)')}
        fallbackMessage="تعذر حفظ التغيير على العمولة."
      />,
    );

    expect(html).toContain('تعذر حفظ التغيير على العمولة.');
    expect(html).not.toContain('permission denied');
    expect(html).not.toContain('SQLSTATE');
    expect(html).not.toContain('commissions');
  });

  it('uses the operation-specific fallback without duplicate suffix on unknown backend errors', () => {
    const html = renderToStaticMarkup(
      <WriteErrorCard error={new Error('RPC_FAILED internal_schema.abc')} fallbackMessage="تعذر حفظ التغيير على السجل." />,
    );

    expect(html).toContain('تعذر حفظ التغيير على السجل.');
    expect(html).not.toContain('RPC_FAILED');
    expect(html).not.toContain('internal_schema');
  });

  it('keeps the fixed Arabic write-error title and alert semantics', () => {
    const html = renderToStaticMarkup(<WriteErrorCard error={undefined} fallbackMessage="تعذر حفظ التغيير." />);

    expect(html).toContain('لم يتم حفظ التغيير');
    expect(html).toContain('تعذر حفظ التغيير.');
    expect(html).toContain('role="alert"');
  });
});
