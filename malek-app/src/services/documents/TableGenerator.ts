import type { DocumentTable } from './types';

export const TableGenerator = {
  build(columns: string[], rows: string[][], totals?: string[]): DocumentTable {
    return { columns, rows, totals };
  },
};
