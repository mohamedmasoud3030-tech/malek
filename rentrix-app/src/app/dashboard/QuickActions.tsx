import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  Building2,
  FileText,
  ReceiptText,
  WalletCards,
  Wrench,
} from 'lucide-react';
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
    label: 'صيانة',
    description: 'طلب أو متابعة',
    to: '/maintenance',
    icon: Wrench,
    accent: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800',
  },
  {
    label: 'تقرير',
    description: 'مركز التقارير',
    to: '/reports',
    icon: BarChart3,
    accent: 'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800',
  },
  {
    label: 'المالية',
    description: 'نظرة شاملة',
    to: '/financials',
    icon: WalletCards,
    accent: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800',
  },
] as const;

export function QuickActions() {
  return (
    <section className="space-y-3">
      <SectionHeader title="إجراءات سريعة" description="اختصارات يومية لإدارة المحفظة والتحصيل" />
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.to} to={action.to} className="min-w-0">
              <div
                className={cn(
                  'flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border/50 p-3 text-center ring-1 ring-inset transition',
                  'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
                  action.accent,
                )}
              >
                <Icon className="size-5 shrink-0 sm:size-6" />
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-black leading-tight sm:text-xs">
                    {action.label}
                  </span>
                  <span className="mt-0.5 hidden truncate text-[10px] font-bold opacity-70 sm:block">
                    {action.description}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
