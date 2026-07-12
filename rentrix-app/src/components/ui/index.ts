// UI primitives — import from here for clean paths
export { Button } from "./button";
export { IconButton } from "./icon-button";
export { Badge } from "./badge";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
export { DetailFields, type DetailField } from "./detail-fields";
export { EntityForm, getResponsiveFormSurface, type ResponsiveFormSurface } from "./entity-form";
export { Input } from "./input";
export { Select } from "./select";
export { Skeleton } from "./skeleton";
export { StatusBadge } from "./status-badge";
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
export { Textarea } from "./textarea";
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogPortal, DialogTitle, DialogTrigger } from "./dialog";
export {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalPortal,
  ModalTitle,
  ModalTrigger,
} from "./modal";

// Shared product surfaces
export { SearchInput } from "./search-input";
export { SectionHeader } from "./section-header";
export { ConfirmDialog } from "./confirm-dialog";
export { StatCard } from "./stat-card";
export { FilterTabs } from "./filter-tabs";
export { FilterBar } from "./filter-bar";
export { KpiCard } from "./kpi-card";
export { InlineStatCard } from "./inline-stat-card";
export { ResponsiveCardGrid } from "./responsive-card-grid";
export { MobileCard } from "./mobile-card";
export { DatePicker } from "./date-picker";
export { Drawer } from "./drawer";
export { FormField } from "./form-field";
export { ActionMenu, type ActionMenuItem } from "./action-menu";
export {
  buildPropertyActions,
  buildContractActions,
  buildInvoiceActions,
  buildReceiptActions,
  buildReportActions,
} from "./entity-action-presets";
export { Dropdown, type DropdownOption } from "./dropdown";
export { LoadingState } from "./loading-state";
export { ErrorState } from "./error-state";
export { EmptyState } from "./empty-state";

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
