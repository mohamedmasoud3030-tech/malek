import { ArrowUpLeft, FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildReportActions } from '@/components/ui/entity-action-presets';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';

type ReportCardProps = Readonly<{
  id?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  isLoading?: boolean;
  onExportCsv?: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
}>;

type SafeLinkProps = Readonly<{
  href: string;
  label: string;
}>;

export function SafeAnchor({ href, label }: SafeLinkProps) {
  return (
    <a className="inline-flex items-center gap-1 font-bold text-primary hover:underline" href={href}>
      {label}
      <ArrowUpLeft className="size-3" />
    </a>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-4 p-4" role="status" aria-live="polite" aria-label="جارٍ تحميل هذا التقرير">
      <ResponsiveCardGrid desktopColumns={4}>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </ResponsiveCardGrid>
      <Skeleton className="h-40" />
    </div>
  );
}

export function ReportCard({
  id,
  title,
  description,
  action,
  children,
  isLoading = false,
  onExportCsv,
  onPrint,
  onExportPdf,
}: ReportCardProps) {
  const menuItems = buildReportActions({
    onExcel: onExportCsv,
    onPrint: onPrint ?? (() => window.print()),
    onPdf: onExportPdf,
  });

  const exportActions = !isLoading && (onExportCsv || onExportPdf || onPrint || menuItems.length > 0) ? (
    <div className="flex flex-wrap items-center gap-2" data-print-actions>
      {onExportCsv ? (
        <Button variant="secondary" onClick={onExportCsv}>
          <FileSpreadsheet className="me-2 size-4" />
          Excel / CSV
        </Button>
      ) : null}
      {onExportPdf ? (
        <Button variant="secondary" onClick={onExportPdf}>
          <FileDown className="me-2 size-4" />
          PDF
        </Button>
      ) : null}
      <Button variant="secondary" onClick={onPrint ?? (() => window.print())}>
        <Printer className="me-2 size-4" />
        طباعة
      </Button>
      <ActionMenu items={menuItems} label="إجراءات التقرير" />
      {action}
    </div>
  ) : isLoading ? null : action;

  return (
    <Card id={id} className="scroll-mt-28 overflow-hidden border-border/60 print-document">
      <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <CardTitle className="text-sm font-bold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {exportActions}
      </CardHeader>
      <CardContent className="p-0">{isLoading ? <SectionSkeleton /> : children}</CardContent>
    </Card>
  );
}
