import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityTable, type ColumnDef } from './entity-table';

type TestRow = { id: string; label: string };

const rows: TestRow[] = [{ id: 'row-1', label: 'برج الواحة' }];
const columns: ColumnDef<TestRow>[] = [{ key: 'label', header: 'العقار', render: (row) => row.label }];

describe('Visual Wave 1 — table wrapper accessibility contract', () => {
  it('marks the actual table, exposes a named keyboard-focusable overflow region, and keeps row focus visible', () => {
    const html = renderToStaticMarkup(
      <EntityTable
        aria-label="جدول الاختبار"
        rows={rows}
        columns={columns}
        keyOf={(row) => row.id}
        onRowClick={() => undefined}
      />,
    );

    expect(html).toContain('data-entity-table-wrapper="true"');
    expect(html).toContain('data-entity-table-scroll="true"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-entity-table="true"');
    expect(html).toContain('focus-visible:ring-primary/35');
  });
});
