import { Link } from '@tanstack/react-router';
import { Building2, FileText, ReceiptText, Wrench } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { cn } from '@/lib/utils';

const QUICK_ACTIONS = [
  {
    label: 'عقد جديد',
    description: 'إنشاء عقد إيجار',
    to: '/contracts/new',
    icon: FileText,
    accent: 'bg-primary/10 text-primary ring-primary/15',
  },
  {
    label: 'قبض دفعة',
    description: 'تسجيل تحصيل',
    to: '/invoices',
    icon: ReceiptText,
    accent: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800',
  },
  {
    label: 'إضافة عقار',
    description: 'تسجيل أصل جديد',
    to: '/properties/new',
    icon: Building2,
    accent: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800',
  },
  {
    label: 'طلب صيانة',
    description: 'إنشاء أو متابعة طلب',
    to: '/maintenance',
    icon: Wrench,
    accent: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800',
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
              <div
                className={cn(
                  'flex min-h-24 items-center gap-3 rounded-2xl border border-border/50 p-3 text-start ring-1 ring-inset transition sm:p-4',
                  'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
                  action.accent,
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/70">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-black leading-tight">{action.label}</span>
                  <span className="mt-1 block text-xs font-bold opacity-70">{action.description}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
