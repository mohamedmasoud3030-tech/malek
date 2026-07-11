import { Bell, CalendarClock, CreditCard, Wrench, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatContractDate } from '@/features/contracts/contractDisplayFormatters';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { Link } from '@tanstack/react-router';
import type { ContractListItem } from '@/features/contracts/services/contractService';

export interface AlertCenterProps {
  expiringContracts: ContractListItem[];
  overdueInvoices: Array<{
    id: string;
    contract_id: string;
    amount: number;
    paid_amount?: number;
    due_date: string;
    tenant_name?: string;
    invoice_number?: string;
  }>;
  urgentMaintenance: Array<{
    id: string;
    title: string;
    priority: string;
    property_id?: string;
    unit_id?: string;
    property_title?: string;
    unit_number?: string;
  }>;
  className?: string;
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function AlertCenter({
  expiringContracts,
  overdueInvoices,
  urgentMaintenance,
  className = '',
}: AlertCenterProps) {
  const settings = useCompanySettingsContract();

  const expiringDaysThreshold = 30;
  const contractAlerts = expiringContracts
    .filter((c) => {
      const days = getDaysUntil(c.end_date);
      return days >= 0 && days <= expiringDaysThreshold;
    })
    .slice(0, 5);

  const invoiceAlerts = overdueInvoices.slice(0, 5);
  const maintenanceAlerts = urgentMaintenance
    .filter((m) => m.priority === 'urgent' || m.priority === 'high')
    .slice(0, 5);

  const hasAlerts =
    contractAlerts.length > 0 || invoiceAlerts.length > 0 || maintenanceAlerts.length > 0;

  if (!hasAlerts) {
    return (
      <Card className={`border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 ${className}`}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-200">لا توجد تنبيهات عاجلة</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400/80">
              كل شيء يسير بسلاسة — لا توجد متأخرات أو عقود تنتهي قريباً أو طلبات صيانة عاجلة.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Card className="border-primary/10 bg-gradient-to-l from-primary/10 via-card to-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            <CardTitle className="text-base">مركز التنبيهات</CardTitle>
          </div>
          <div className="flex gap-1.5">
            {contractAlerts.length > 0 && (
              <StatusBadge tone="gold">{contractAlerts.length} عقد ينتهي</StatusBadge>
            )}
            {invoiceAlerts.length > 0 && (
              <StatusBadge tone="red">{invoiceAlerts.length} متأخرات</StatusBadge>
            )}
            {maintenanceAlerts.length > 0 && (
              <StatusBadge tone="gold">{maintenanceAlerts.length} صيانة</StatusBadge>
            )}
          </div>
        </CardHeader>
      </Card>

      {contractAlerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-amber-600" />
              العقود المنتهية قريباً
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link to="/contracts">عرض الكل</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {contractAlerts.map((contract) => {
              const days = getDaysUntil(contract.end_date);
              return (
                <div
                  key={contract.id}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-amber-950/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{contract.people?.full_name ?? 'مستأجر'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {contract.properties?.title} / {contract.units?.unit_number}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-amber-600">
                      {days === 0 ? 'ينتهي اليوم' : `${days} يوم`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatContractDate(settings, contract.end_date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {invoiceAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-red-600" />
              الفواتير المتأخرة
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link to="/arrears">عرض الكل</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {invoiceAlerts.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-xl border border-red-200 bg-white p-3 dark:border-red-800 dark:bg-red-950/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{invoice.tenant_name ?? 'مستأجر'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    فاتورة #{invoice.invoice_number}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-red-600">
                    {formatMoney(settings, invoice.amount - (invoice.paid_amount ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    مستحق منذ{' '}
                    {Math.max(
                      0,
                      Math.ceil(
                        (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24),
                      ),
                    )}{' '}
                    يوم
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {maintenanceAlerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench className="size-4 text-orange-600" />
              طلبات صيانة عاجلة
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link to="/maintenance">عرض الكل</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {maintenanceAlerts.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-orange-200 bg-white p-3 dark:border-orange-800 dark:bg-orange-950/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.property_title ?? 'عقار'} / {item.unit_number ?? 'وحدة'}
                  </p>
                </div>
                <StatusBadge
                  tone={item.priority === 'urgent' ? 'red' : 'gold'}
                  className="shrink-0"
                >
                  {item.priority === 'urgent' ? 'عاجل' : 'مرتفع'}
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
