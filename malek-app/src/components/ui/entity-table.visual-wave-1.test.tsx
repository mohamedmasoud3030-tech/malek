import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityTable, type ColumnDef } from './entity-table';

type Row = { id: string; name: string; amount: string };
const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'الاسم', priority: 'identity', render: (row) => row.name },
  { key: 'amount', header: 'المبلغ', priority: 'primary', render: (row) => row.amount },
  { key: 'actions', header: 'إجراءات', priority: 'actions', render: () => <button type="button">إجراء</button> },
];

describe('shared responsive register accessibility contract', () => {
  it('keeps one labelled table in a keyboard-reachable horizontal scroll region on desktop', () => {
    const html = renderToStaticMarkup(<EntityTable aria-label="جدول الاختبار" rows={[{ id: '1', name: 'اسم عربي طويل', amount: '100' }]} columns={columns} keyOf={(row) => row.id} />);
    expect(html).toContain('<table');
    expect(html).toContain('data-entity-table-scroll');
    expect(html).toContain('role="region"');
    expect(html).toContain('mobile-scroll-x');
    expect(html).toContain('xl:sticky xl:start-0');
    expect(html).toContain('xl:sticky xl:end-0');
  });
});
