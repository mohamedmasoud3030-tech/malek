import { BarChart3, Building2, FileSpreadsheet, ReceiptText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useFinancialCashflowReport, useFinancialPeriodSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { buildReportCsvFilename, downloadCsv, toFinancialSummaryCsv } from '../reports-page.helpers';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

type OccupancyRow = Readonly<{
  property: string;
  occupied: number;
  vacant: number;
}>;

export function OverviewSection({
  summary,
  cashflowRows,
  receiptRows,
  occupancyRows,
  canExportReports,
  isLoading,
}: Readonly<{
  summary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  cashflowRows: NonNullable<ReturnType<typeof useFinancialCashflowReport>['data']>['rows'];
  receiptRows: readonly ReceiptRow[];
  occupancyRows: readonly OccupancyRow[];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const emptySummary = {
    invoiced: 0,
    paid: 0,
    outstanding: 0,
    expenses: 0,
    netCash: 0,
    invoicesCount: 0,
    paymentsCount: 0,
    expensesCount: 0,
  };
  const report = summary ?? emptySummary;
  const occupancy = occupancyRows.reduce(
    (totals, row) => ({
      occupied: totals.occupied + row.occupied,
      vacant: totals.vacant + row.vacant,
    }),
    { occupied: 0, vacant: 0 },
  );
  const totalUnits = occupancy.occupied + occupancy.vacant;
  const occupancyRate = totalUnits > 0 ? Math.round((occupancy.occupied / totalUnits) * 100) : 0;
  const latestReceipts = receiptRows.slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="overflow-hidden lg:col-span-6">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold">حركة السيولة</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">التحصيل مقابل المصروفات خلال الفترة.</p>
            </div>
          </div>
          {canExportReports ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0 gap-2 text-xs"
              onClick={() => downloadCsv(buildReportCsvFilename('financial-summary'), toFinancialSummaryCsv(report))}
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              CSV
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : cashflowRows.length === 0 ? (
            <p className="grid h-56 place-items-center text-center text-sm text-muted-foreground">
              لا توجد بيانات شهرية كافية لعرض حركة السيولة.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowRows} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={54} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" name="المحصّل" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="المصروفات" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden lg:col-span-3">
        <CardHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-sm font-bold">الإشغال الآن</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">صورة المحفظة الحالية.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="flex h-56 flex-col justify-between">
              <div>
                <p className="text-4xl font-bold tabular-nums" dir="ltr">{occupancyRate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">نسبة الإشغال الكلية</p>
              </div>

              <div className="space-y-3">
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${occupancyRate}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                    <p className="text-lg font-bold tabular-nums" dir="ltr">{occupancy.occupied}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">مشغولة</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                    <p className="text-lg font-bold tabular-nums" dir="ltr">{occupancy.vacant}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">غير مشغولة</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden lg:col-span-3">
        <CardHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="size-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-sm font-bold">آخر التحصيلات</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">أحدث 3 إيصالات في النطاق.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : latestReceipts.length === 0 ? (
            <p className="grid h-56 place-items-center px-4 text-center text-sm text-muted-foreground">
              لا توجد تحصيلات حديثة داخل الفترة.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {latestReceipts.map((receipt) => (
                <div key={receipt.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{receipt.tenant_name || 'مستأجر غير مسمى'}</p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">إيصال {receipt.receipt_number}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums" dir="ltr">{formatMoney(receipt.amount)}</p>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{receipt.payment_date}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
