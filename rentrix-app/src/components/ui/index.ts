// UI primitives — import from here for clean paths
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Badge, StatusBadgePill, statusPresets, type BadgeVariant, type BadgeStatus } from "./badge";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants } from "./card";
export { DetailFields, type DetailField } from "./detail-fields";
export { EntityForm, getResponsiveFormSurface, type ResponsiveFormSurface } from "./entity-form";export { Input, inputVariants, type InputProps } from "./input";
export { Select } from "./select";
export { Skeleton } from "./skeleton";
export { Alert, AlertTitle, AlertDescription, alertVariants } from "./alert";
export { EmptyState, OfflineState, NoPermissionState } from "./state-surfaces";
export { StatusBadge } from "./status-badge";
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
  TableLoading,
  TableEmpty,
  TableError,
} from "./table";
export { Textarea } from "./textarea";
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogPortal, DialogTitle, DialogTrigger } from "./dialog";
export { BottomSheet } from "./bottom-sheet";

// Shared product surfaces
export { SearchInput } from "./search-input";
export { SectionHeader } from "./section-header";
export { ConfirmDialog } from "./confirm-dialog";
export { FilterTabs } from "./filter-tabs";
export { FilterBar } from "./filter-bar";
export { ActiveFilterBar, type ActiveFilterItem } from "./active-filter-bar";
export { KpiCard } from "./kpi-card";
export { ResponsiveCardGrid } from "./responsive-card-grid";
export { SelectionCard, type SelectionCardProps } from "./selection-card";
export { ActionMenu, type ActionMenuItem } from "./action-menu";
export {
  buildPropertyActions,
  buildContractActions,
  buildInvoiceActions,
  buildReceiptActions,
  buildReportActions,
} from "./entity-action-presets";
export { LoadingState } from "./loading-state";
export { ErrorState } from "./error-state";

// ADR-008 Phase A — unified entity table
export {
  EntityTable,
  type ColumnDef,
  type SortState,
  type SortDirection,
  type PaginationState,
  type EntityTableProps,
} from "./entity-table";
export {
  DataTable,
  type DataTableProps,
} from "./data-table";

// ADR-008 Phase B — unified entity card
export {
  EntityCard,
  entityCardTypeMap,
  entityCardContactMeta,
  type EntityCardProps,
  type EntityCardMetaItem,
  type EntityCardAction,
} from "./entity-card";
