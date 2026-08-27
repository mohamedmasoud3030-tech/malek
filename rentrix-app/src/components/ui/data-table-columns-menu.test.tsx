import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTableColumnsMenu } from './data-table-columns-menu';

const columns = [
  { key: 'identity', label: 'رقم العقد', locked: true },
  { key: 'tenant', label: 'المستأجر' },
] as const;

describe('DataTableColumnsMenu touch targets', () => {
  it('keeps the launcher, reset, and column options at least 44px high and wide where needed', () => {
    const html = renderToStaticMarkup(
      <DataTableColumnsMenu columns={columns} visibleKeys={['identity', 'tenant']} onChange={() => undefined} />,
    );

    expect(html).toContain('hidden md:block');
    expect(html).toContain('min-h-11 min-w-11');
    expect(html).toContain('aria-label="إظهار كل الأعمدة"');
    expect(html).toContain('size-11');
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
