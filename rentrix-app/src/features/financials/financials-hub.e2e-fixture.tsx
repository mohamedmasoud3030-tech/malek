import { ClipboardList, FileCheck, FileText, Landmark, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

/**
 * Static marketing/demo capture of the real financials hub — same page
 * header and tab chrome as production, with showcase invoices instead of
 * live PGlite queries. Rendered only behind VITE_E2E.
 */
const financialTabs = [
  ['invoices', 'الفواتير والتحصيل', 'مراجعة وتسجيل دفعات الفواتير', FileText],
  ['receipts', 'السدادات والإيصالات', 'سجل الإيصالات وطباعة سندات القبض', ReceiptText],
  ['expenses', 'المصروفات التشغيلية', 'تسجيل ومراجعة نفقات العقارات', WalletCards],
  ['arrears', 'جدول المتأخرات والديون', 'متابعة الذمم وأعمار الديون', ClipboardList],
  ['reconciliation', 'مطابقة كشف البنك', 'مطابقة السجلات مع الحسابات البنكية', Landmark],
  ['deposits', 'تأمين وأمانات المستأجرين', 'تتبع مبالغ أمانات وعقود التأمين', FileCheck],
] as const;

type FinancialsTabId = (typeof financialTabs)[number][0];

type FixtureInvoice = {
  id: string;
  number: string;
  tenant: string;
  property: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'partial' | 'overdue' | 'issued';
};

const invoiceStatusMeta: Record<FixtureInvoice['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  paid: { label: 'مدفوعة', tone: 'success' },
  partial: { label: 'سداد جزئي', tone: 'info' },
  overdue: { label: 'متأخرة', tone: 'danger' },
  issued: { label: 'صادرة', tone: 'warning' },
};

const fixtureInvoices: FixtureInvoice[] = [
  { id: 'i-01', number: 'INV-2026-0142', tenant: 'أحمد الحارثي', property: 'برج الواحة — 301', dueDate: '2026-07-05', amount: 420, status: 'paid' },
  { id: 'i-02', number: 'INV-2026-0143', tenant: 'سارة القتبية', property: 'فيلات الموج — V-2', dueDate: '2026-07-01', amount: 950, status: 'paid' },
  { id: 'i-03', number: 'INV-2026-0144', tenant: 'محفوظ التجارية ش.م.م', property: 'عمارة النور — G-04', dueDate: '2026-07-05', amount: 600, status: 'partial' },
  { id: 'i-04', number: 'INV-2026-0138', tenant: 'ناصر الريامي', property: 'برج الواحة — 205', dueDate: '2026-06-15', amount: 380, status: 'overdue' },
  { id: 'i-05', number: 'INV-2026-0129', tenant: 'شركة أفق الخليج', property: 'برج مطرح — 705', dueDate: '2026-06-01', amount: 1200, status: 'overdue' },
  { id: 'i-06', number: 'INV-2026-0151', tenant: 'منيرة السيابية', property: 'برج مطرح — 302', dueDate: '2026-08-01', amount: 880, status: 'issued' },
  { id: 'i-07', number: 'INV-2026-0150', tenant: 'خميس الحضرمي', property: 'مجمع السلام — B-12', dueDate: '2026-07-20', amount: 700, status: 'issued' },
];

const fmt = (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: 0 })} ر.ع.`;

export function FinancialsHubE2EFixture() {
  const [activeTab, setActiveTab] = useState<FinancialsTabId>('invoices');

  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-financials-workspace>
      <PageLayout dir="rtl" size="wide">
        <PageHeader
          title="مركز إدارة الماليات والمحاسبة"
          description="منظومة موحدة لإدارة الفواتير المستحقة، التحصيلات، الإيصالات المعتمدة، المصروفات التشغيلية، ومطابقة البنك."
          secondaryActions={(
            <>
              <Button variant="secondary">الفواتير</Button>
              <Button variant="secondary">الإيصالات</Button>
              <Button variant="secondary">المصاريف</Button>
              <Button variant="secondary">مطابقة البنك</Button>
            </>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={FileText} label="إجمالي فواتير يوليو" value={fmt(5130)} sub="7 فواتير صادرة" trend="up" trendValue="+12%" />
          <KpiCard icon={TrendingUp} label="المحصّل هذا الشهر" value={fmt(1370)} sub="سداد كامل وجزئي" trend="up" trendValue="+8%" />
          <KpiCard icon={ClipboardList} label="متأخرات قائمة" value={fmt(1580)} sub="فاتورتان تجاوزتا الاستحقاق" trend="down" trendValue="2 فاتورة" />
          <KpiCard icon={WalletCards} label="مصروفات تشغيلية" value={fmt(730)} sub="صيانة ومرافق وعمولات" trend="neutral" trendValue="—" />
        </div>

        <Card>
          <CardContent className="space-y-5 p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" role="tablist" aria-label="أقسام المالية الموحدة">
              {financialTabs.map(([tab, label, description, Icon]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-right transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5',
                    activeTab === tab ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className={cn('block truncate text-[11px] font-medium', activeTab === tab ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {activeTab === 'invoices' ? (
                <DataTable
                  aria-label="جدول الفواتير"
                  rows={fixtureInvoices}
                  keyOf={(row) => row.id}
                  columns={[
                    { key: 'number', header: 'رقم الفاتورة', render: (row) => <span className="font-mono text-xs font-bold">{row.number}</span> },
                    { key: 'tenant', header: 'المستأجر', render: (row) => row.tenant },
                    { key: 'property', header: 'العقار / الوحدة', render: (row) => row.property },
                    { key: 'dueDate', header: 'تاريخ الاستحقاق', render: (row) => row.dueDate },
                    { key: 'amount', header: 'المبلغ', render: (row) => <span className="font-bold">{fmt(row.amount)}</span> },
                    {
                      key: 'status',
                      header: 'الحالة',
                      render: (row) => (
                        <StatusBadge tone={invoiceStatusMeta[row.status].tone} dot>
                          {invoiceStatusMeta[row.status].label}
                        </StatusBadge>
                      ),
                    },
                  ]}
                />
              ) : (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="p-5 text-sm font-semibold text-muted-foreground">
                    هذا القسم يعمل بالكامل داخل التطبيق — المعروض هنا تبويب الفواتير كمثال حي.
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    </main>
  );
}
