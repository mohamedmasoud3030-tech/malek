/**
 * DataTable — product-facing alias for EntityTable.
 * Keeps the canonical MALEK register implementation as the single source of
 * truth while exposing the product-facing design-system naming.
 */
export {
  EntityTable as DataTable,
  CompactResponsiveTable,
  type ColumnDef,
  type ColumnPriority,
  type SortState,
  type SortDirection,
  type PaginationState,
  type RowSelectionState,
  type EntityTableProps as DataTableProps,
} from './entity-table';
