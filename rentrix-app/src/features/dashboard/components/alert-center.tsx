import { Bell, CalendarClock, CheckCircle2, CreditCard, Wrench } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ContractListItem } from '@/features/contracts/services/contractService';

export interface AlertCenterProps {
  expiringContracts: ContractListItem[];
  overdueInvoices: Array<{
    id: string;
    amount: number;
    paid_amount?: number;
    due_date: string;
    tenant_name?: string | null;
    invoice_number?: string | null;
  }>;
  urgentMaintenance: Array<{
    id: string;
    title: string | null;
    priority: string | null;
    property_id?: string | null;
    unit_id?: string | null;
    property_title?: string;
    unit_number?: string;
  }>;
  className?: string;
}

function getDaysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function AlertCenter({
  expiringContracts,
  overdueInvoices,
  urgentMaintenance,
  className = '',
}: AlertCenterProps) {
  const contractCount = expiringContracts.filter((contract) => {
    const days = getDaysUntil(contract.end_date);
    return days >= 0 && days <= 30;
  }).length;
  const overdueCount = overdueInvoices.length;
  const maintenanceCount = urgentMaintenance.filter(
    (request) => request.priority === 'urgent' || request.priority === 'high',
  ).length;
  const total = contractCount + overdueCount + maintenanceCount;

  if (total === 0) {
    return (
      <Card className={`border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 ${className}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-200">لا توجد أعمال عاجلة</p>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80">انتقل إلى المؤشرات لمراجعة الأداء الحالي.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priorities = [
    {
      label: 'عقود تنتهي قريباً',
      description: 'راجع التجديد أو الإخلاء',
      count: contractCount,
      to: '/contracts',
      icon: CalendarClock,
      tone: 'gold' as const,
      surface: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/25',
    },
    {
      label: 'فواتير متأخرة',
      description: 'ابدأ متابعة التحصيل',
      count: overdueCount,
      to: '/arrears',
      icon: CreditCard,
      tone: 'red' as const,
      surface: 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/25',
    },
    {
      label: 'صيانة عاجلة',
      description: 'راجع الطلبات ذات الأولوية',
      count: maintenanceCount,
      to: '/maintenance',
      icon: Wrench,
      tone: 'gold' as const,
      surface: 'border-orange-200 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/25',
    },
  ];

  return (
    <section className={`space-y-3 ${className}`} aria-label="الأولوية الآن">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-base font-black">الأولوية الآن</h2>
          </div>
          <p className="mt-1 text-xs font-bold text-muted-foreground">{total} حالة ظاهرة تحتاج قراراً أو متابعة</p>
        </div>
        <StatusBadge tone="red">{total} متابعة</StatusBadge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {priorities.filter((priority) => priority.count > 0).map((priority) => {
          const Icon = priority.icon;
          return (
            <Link key={priority.to} to={priority.to} className="min-w-0">
              <Card className={`h-full transition hover:-translate-y-0.5 hover:shadow-md ${priority.surface}`}>
                <CardContent className="flex min-h-24 items-center gap-3 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/75">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black">{priority.label}</p>
                      <StatusBadge tone={priority.tone}>{priority.count}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">{priority.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
