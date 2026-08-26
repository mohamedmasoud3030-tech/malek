import { Link } from '@tanstack/react-router';
import { ArrowLeft, FileSpreadsheet, ReceiptText, WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { CollectionSummaryReport } from '@/features/financials/reports/financialReportsService';
import type { FinanceSectionDefinition, FinanceViewDefinition } from '../shell/financeShellModel';

type FinanceWorkspaceHeroProps = Readonly<{
  activeSection: FinanceSectionDefinition | null;
  activeView: FinanceViewDefinition | null;
  summary: CollectionSummaryReport | undefined;
  isLoading: boolean;
  onOpenCollections: () => void;
}>;

function Metric({
  label,
  value,
  helper,
}: Readonly<{ label: string; value: ReactNode; helper: string }>) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/65 bg-background/80 p-3 shadow-sm backdrop-blur-sm sm:p-4">
      <p className="text-[11px] font-black tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 min-h-7 text-lg font-black leading-7 text-foreground sm:text-xl">{value}</div>
      <p className="mt-1 truncate text-xs font-bold text-muted-foreground">{helper}</p>
    </div>
  );
}

export function FinanceWorkspaceHero({
  activeSection,
  activeView,
  summary,
  isLoading,
  onOpenCollections,
}: FinanceWorkspaceHeroProps) {
  return (
    <section
      aria-label="مركز قيادة المالية"
      className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-bl from-primary/[0.09] via-card to-card shadow-card"
      data-finance-cockpit
    >
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-black text-primary">
              مركز المالية
            </span>
            {activeSection ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-border/70 bg-background/70 px-3 text-xs font-bold text-muted-foreground">
                {activeSection.label}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-balance text-2xl font-black leading-9 text-foreground sm:text-3xl">
            كل حركة المال في مساحة تشغيل واحدة
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
            راقب المستحقات والتحصيل والمصروفات وأموال الملاك والبنوك، ثم انتقل مباشرة إلى العمل المطلوب بدون الرجوع لقوائم متفرقة.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={onOpenCollections} className="min-h-11">
              <ReceiptText className="me-2 size-4" aria-hidden="true" />
              فتح التحصيل
            </Button>
            <Button variant="secondary" asChild className="min-h-11">
              <Link to="/reports">
                <FileSpreadsheet className="me-2 size-4" aria-hidden="true" />
                المحاسبة والتقارير
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/55 p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-muted-foreground">المساحة المفتوحة الآن</p>
              <p className="mt-1 truncate text-base font-black">{activeView?.label ?? activeSection?.label ?? 'المالية'}</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <WalletCards className="size-5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-bold text-muted-foreground">
            <span>التنقل يحافظ على الروابط والصلاحيات</span>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="border-t border-primary/10 bg-background/35 p-3 sm:p-4">
        <ResponsiveCardGrid desktopColumns={3} gap="sm" aria-label="ملخص مالي للشهر الحالي">
          <Metric
            label="المحصّل هذا الشهر"
            value={isLoading ? <Skeleton className="h-6 w-28" /> : formatMoney(summary?.paid ?? 0)}
            helper={`${summary?.receiptsCount ?? 0} إيصالات مسجلة`}
          />
          <Metric
            label="المتبقي للتحصيل"
            value={isLoading ? <Skeleton className="h-6 w-28" /> : formatMoney(summary?.outstanding ?? 0)}
            helper={`${summary?.invoicesCount ?? 0} فواتير في النطاق`}
          />
          <Metric
            label="قيمة الفواتير"
            value={isLoading ? <Skeleton className="h-6 w-28" /> : formatMoney(summary?.invoiced ?? 0)}
            helper="ملخص تشغيلي للشهر الحالي"
          />
        </ResponsiveCardGrid>
      </div>
    </section>
  );
}
