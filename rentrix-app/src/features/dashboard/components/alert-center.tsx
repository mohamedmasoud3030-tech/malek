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
  const contractCount = expiringContracts.filter((c) => {
    const days = getDaysUntil(c.end_date);
    return days >= 0 && days <= 30;
  }).length;
  const overdueCount = overdueInvoices.length;
  const maintenanceCount = urgentMaintenance.filter(
    (r) => r.priority === 'urgent' || r.priority === 'high',
  ).length;
  const total = contractCount + overdueCount + maintenanceCount;

  if (total === 0) {
    return (
      <Card className={`border-success/20 bg-success/5 dark:bg-success/8 ${className}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-success">لا توجد أعمال عاجلة</p>
            <p className="text-[0.8125rem] text-muted-foreground">انتقل إلى المؤشرات لمراجعة الأداء الحالي.</p>
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
      tone: 'warning' as const,
    },
    {
      label: 'فواتير متأخرة',
      description: 'ابدأ متابعة التحصيل',
      count: overdueCount,
      to: '/arrears',
      icon: CreditCard,
      tone: 'danger' as const,
    },
    {
      label: 'صيانة عاجلة',
      description: 'راجع الطلبات ذات الأولوية',
      count: maintenanceCount,
      to: '/maintenance',
      icon: Wrench,
      tone: 'warning' as const,
    },
  ];

  return (
    <section className={`space-y-3 ${className}`} aria-label="الأولوية الآن">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-[0.9375rem] font-semibold">الأولوية الآن</h2>
          </div>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{total} حالة تحتاج قراراً أو متابعة</p>
        </div>
        <StatusBadge tone="danger">{total} متابعة</StatusBadge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {priorities.filter((p) => p.count > 0).map((priority) => {
          const Icon = priority.icon;
          return (
            <Link key={priority.to} to={priority.to} className="min-w-0">
              <Card className="h-full transition-shadow hover:shadow-card-hover">
                <CardContent className="flex min-h-24 items-center gap-3 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{priority.label}</p>
                      <StatusBadge tone={priority.tone}>{priority.count}</StatusBadge>
                    </div>
                    <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{priority.description}</p>
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
