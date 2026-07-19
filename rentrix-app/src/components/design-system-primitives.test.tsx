import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DetailFields } from '@/components/ui/detail-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { AsyncContentState } from '@/components/async-content-state';

describe('DetailFields', () => {
  it('renders provided values and falls back to an em dash for empty ones', () => {
    const html = renderToStaticMarkup(
      <DetailFields
        fields={[
          { label: 'المستأجر', value: 'أحمد' },
          { label: 'ملاحظات', value: null },
          { label: 'العقار', value: undefined },
        ]}
      />,
    );
    expect(html).toContain('أحمد');
    expect(html).toContain('المستأجر');
    const dashCount = html.split('—').length - 1;
    expect(dashCount).toBe(2);
  });

  it('spans wide fields across two columns', () => {
    const html = renderToStaticMarkup(<DetailFields fields={[{ label: 'ملاحظات', value: 'نص طويل', wide: true }]} />);
    expect(html).toContain('md:col-span-2');
  });
});

describe('StatusBadge semantic tones', () => {
  it('renders the same visual treatment for a product tone and its legacy color alias', () => {
    const product = renderToStaticMarkup(<StatusBadge tone="emerald">نشط</StatusBadge>);
    const legacy = renderToStaticMarkup(<StatusBadge tone="green">نشط</StatusBadge>);
    expect(product).toBe(legacy);
  });

  it('maps every semantic tone without throwing', () => {
    const semanticTones = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'] as const;
    for (const tone of semanticTones) {
      expect(() => renderToStaticMarkup(<StatusBadge tone={tone}>x</StatusBadge>)).not.toThrow();
    }
  });
});

describe('AsyncContentState', () => {
  it('never renders the empty state while loading or erroring', () => {
    const loading = renderToStaticMarkup(
      <AsyncContentState status="loading" emptyTitle="EMPTY_MARKER">
        ready
      </AsyncContentState>,
    );
    expect(loading).not.toContain('EMPTY_MARKER');
    expect(loading).not.toContain('ready');

    const error = renderToStaticMarkup(
      <AsyncContentState status="error" errorTitle="ERROR_MARKER" emptyTitle="EMPTY_MARKER">
        ready
      </AsyncContentState>,
    );
    expect(error).toContain('ERROR_MARKER');
    expect(error).not.toContain('EMPTY_MARKER');
    expect(error).not.toContain('ready');
  });

  it('renders children only when ready', () => {
    const ready = renderToStaticMarkup(<AsyncContentState status="ready">CHILD_MARKER</AsyncContentState>);
    expect(ready).toContain('CHILD_MARKER');
  });

  it('renders the empty state with the provided title and description', () => {
    const empty = renderToStaticMarkup(
      <AsyncContentState status="empty" emptyTitle="EMPTY_TITLE" emptyDescription="EMPTY_DESC">
        ready
      </AsyncContentState>,
    );
    expect(empty).toContain('EMPTY_TITLE');
    expect(empty).toContain('EMPTY_DESC');
    expect(empty).not.toContain('ready');
  });
});
