/**
 * DataTable — product-facing alias for EntityTable.
 * Keeps the ADR-008 table implementation as the single source of truth
 * while matching the design-system naming used across product docs.
 */
export {
  EntityTable as DataTable,
  type ColumnDef,
  type SortState,
  type SortDirection,
  type PaginationState,
  type EntityTableProps as DataTableProps,
} from './entity-table';
