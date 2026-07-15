import { Link } from '@tanstack/react-router';
import { Building2, FileText, ReceiptText, Wrench } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';

const QUICK_ACTIONS = [
  {
    label: 'عقد جديد',
    description: 'إنشاء عقد إيجار',
    to: '/contracts/new',
    icon: FileText,
  },
  {
    label: 'قبض دفعة',
    description: 'تسجيل تحصيل',
    to: '/invoices',
    icon: ReceiptText,
  },
  {
    label: 'إضافة عقار',
    description: 'تسجيل أصل جديد',
    to: '/properties/new',
    icon: Building2,
  },
  {
    label: 'طلب صيانة',
    description: 'إنشاء أو متابعة طلب',
    to: '/maintenance',
    icon: Wrench,
  },
] as const;

export function QuickActions() {
  return (
    <section className="space-y-3" aria-label="إجراءات سريعة">
      <SectionHeader
        title="إجراءات سريعة"
        description="أكثر الإجراءات التشغيلية استخداماً"
      />
      <div className="grid grid-cols-2 gap-3" data-dashboard-action-grid>
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.to} to={action.to} className="min-w-0">
              <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-card transition-all hover:border-primary/25 hover:shadow-card-hover active:opacity-85 sm:p-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-bold leading-tight">{action.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{action.description}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
