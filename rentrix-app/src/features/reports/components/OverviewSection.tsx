import { Building2, ReceiptText, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useFinancialCashflowReport, useFinancialPeriodSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { buildReportCsvFilename, downloadCsv, toFinancialSummaryCsv } from '../reports-page.helpers';
import { ReportCard } from './common';

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
  const emptySummary = { invoiced: 0, paid: 0, outstanding: 0, expenses: 0, netCash: 0, invoicesCount: 0, paymentsCount: 0, expensesCount: 0 };
  const report = summary ?? emptySummary;
  const occupancy = occupancyRows.reduce(
    (totals, row) => ({ occupied: totals.occupied + row.occupied, vacant: totals.vacant + row.vacant }),
    { occupied: 0, vacant: 0 },
  );
  const totalUnits = occupancy.occupied + occupancy.vacant;
  const occupancyRate = totalUnits > 0 ? Math.round((occupancy.occupied / totalUnits) * 100) : 0;
  const latestReceipts = receiptRows.slice(0, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportCard
        title="حركة التحصيل والمصروفات"
        description="مقارنة شهرية تساعد على قراءة اتجاه السيولة خلال الفترة المحددة."
        onExportCsv={canExportReports ? () => downloadCsv(buildReportCsvFilename('financial-summary'), toFinancialSummaryCsv(report)) : undefined}
        isLoading={isLoading}
      >
        <div className="h-80 p-4">
          {cashflowRows.length === 0 ? (
            <p className="grid h-full place-items-center text-sm font-semibold text-muted-foreground">لا توجد بيانات شهرية كافية لعرض التدفق النقدي للفترة.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="المحصّل" fill="#0f766e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="المصروفات" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ReportCard>

      <Card className="overflow-hidden border-border/70 shadow-card">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/10 text-info">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-sm font-black">صورة الإشغال الآن</CardTitle>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">وضع الوحدات عبر جميع العقارات المسجلة.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black tabular-nums tracking-tight" dir="ltr">{occupancyRate}%</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">نسبة الإشغال الكلية</p>
                </div>
                <div className="text-end text-xs font-semibold text-muted-foreground">
                  <p><span className="font-black text-success">{occupancy.occupied}</span> مشغولة</p>
                  <p className="mt-1"><span className="font-black text-warning">{occupancy.vacant}</span> شاغرة أو غير مشغولة</p>
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-info transition-[width] duration-300" style={{ width: `${occupancyRate}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                  <p className="text-xl font-black tabular-nums text-success" dir="ltr">{occupancy.occupied}</p>
                  <p className="mt-1 text-[11px] font-bold text-muted-foreground">وحدة مشغولة</p>
                </div>
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-3">
                  <p className="text-xl font-black tabular-nums text-warning" dir="ltr">{occupancy.vacant}</p>
                  <p className="mt-1 text-[11px] font-bold text-muted-foreground">وحدة متاحة أو صيانة</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-card xl:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
              <ReceiptText className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-sm font-black">آخر التحصيلات المسجلة</CardTitle>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">أحدث إيصالات داخل نطاق التقرير الحالي.</p>
            </div>
          </div>
          <WalletCards className="size-5 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : latestReceipts.length === 0 ? (
            <p className="p-8 text-center text-sm font-semibold text-muted-foreground">لا توجد تحصيلات حديثة داخل الفترة المحددة.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {latestReceipts.map((receipt) => (
                <div key={receipt.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{receipt.tenant_name || 'مستأجر غير مسمى'}</p>
                    <p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">إيصال {receipt.receipt_number}</p>
                  </div>
                  <p className="hidden text-xs font-semibold text-muted-foreground sm:block">{receipt.payment_date}</p>
                  <p className="text-sm font-black tabular-nums text-success" dir="ltr">{formatMoney(receipt.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
