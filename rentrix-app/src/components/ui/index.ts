// UI primitives — import from here for clean paths
export { Button } from "./button";
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

// New shared components
export { SearchInput } from "./search-input";
export { SectionHeader } from "./section-header";
export { ConfirmDialog } from "./confirm-dialog";
export { StatCard } from "./stat-card";
export { FilterTabs } from "./filter-tabs";
export { KpiCard } from "./kpi-card";
export { InlineStatCard } from "./inline-stat-card";

// ADR-008 Phase A — unified entity table
export { EntityTable, type ColumnDef, type SortState, type SortDirection, type PaginationState, type EntityTableProps } from "./entity-table";

// ADR-008 Phase B — unified entity card
export { EntityCard, entityCardTypeMap, entityCardContactMeta, type EntityCardProps, type EntityCardMetaItem, type EntityCardAction } from "./entity-card";
