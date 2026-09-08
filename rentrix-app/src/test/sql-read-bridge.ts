import type { PGlite } from '@electric-sql/pglite';

/** Test-only PostgREST subset. Executes actual scoped SQL (including RLS),
 * rather than returning canned rows or ignoring caller filters/pagination. */
export function createSqlReadBridge(db: PGlite) {
  const identifier = (name: string) => {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Unsupported test identifier');
    return `"${name}"`;
  };
  return (table: string) => {
    if (!['payments', 'invoices', 'receipts', 'receipt_allocations', 'contracts'].includes(table)) throw new Error('Unsupported test table');
    let columns = '*';
    const predicates: string[] = [];
    const parameters: unknown[] = [];
    const order: string[] = [];
    let offset = 0;
    let limit = 1000;
    const builder = {
      select(value: string) { columns = value === '*' ? '*' : value.split(',').map(name => identifier(name.trim())).join(','); return builder; },
      eq(column: string, value: unknown) { parameters.push(String(value)); predicates.push(`${identifier(column)}::text = $${parameters.length}`); return builder; },
      gte(column: string, value: string) { parameters.push(value); predicates.push(`${identifier(column)}::text >= $${parameters.length}`); return builder; },
      lte(column: string, value: string) { parameters.push(value); predicates.push(`${identifier(column)}::text <= $${parameters.length}`); return builder; },
      in(column: string, values: string[]) { parameters.push(values); predicates.push(`${identifier(column)}::text = any($${parameters.length}::text[])`); return builder; },
      is(column: string, value: null) { if (value !== null) throw new Error('Unsupported IS'); predicates.push(`${identifier(column)} is null`); return builder; },
      order(column: string, options?: { ascending?: boolean }) { order.push(`${identifier(column)} ${options?.ascending === false ? 'desc' : 'asc'}`); return builder; },
      range(from: number, to: number) { offset = from; limit = to - from + 1; return builder; },
      returns() { return builder; },
      then(resolve: (value: { data: unknown[] | null; error: unknown }) => unknown, reject?: (error: unknown) => unknown) {
        const sql = `select to_jsonb(row) as value from (select ${columns} from public.${identifier(table)}${predicates.length ? ` where ${predicates.join(' and ')}` : ''}${order.length ? ` order by ${order.join(',')}` : ''} limit ${limit} offset ${offset}) row`;
        return db.query<{ value: unknown }>(sql, parameters).then(
          result => ({ data: result.rows.map(row => row.value), error: null }),
          error => ({ data: null, error }),
        ).then(resolve, reject);
      },
    };
    return builder;
  };
}
