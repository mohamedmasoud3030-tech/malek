import { Link } from '@tanstack/react-router';
import { Building2, FileText, ReceiptText, Wrench } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { useAuth } from '@/hooks/use-auth';

// The permission type is inferred through the reviewed use-auth hook seam so
// the Dashboard keeps zero new cross-feature edges (architecture guard).
type CanAccessFn = ReturnType<typeof useAuth>['canAccess'];
type QuickActionPermission = Parameters<CanAccessFn>[0];

const QUICK_ACTIONS = [
  {
    label: 'عقد جديد',
    description: 'إنشاء عقد إيجار',
    to: '/contracts/new',
    icon: FileText,
    permission: 'contracts.write',
  },
  {
    label: 'قبض دفعة',
    description: 'تسجيل تحصيل',
    to: '/invoices',
    icon: ReceiptText,
    permission: 'financial.payments.create',
  },
  {
    label: 'إضافة عقار',
    description: 'تسجيل أصل جديد',
    to: '/properties/new',
    icon: Building2,
    permission: 'properties.write',
  },
  {
    label: 'طلب صيانة',
    description: 'إنشاء أو متابعة طلب',
    to: '/maintenance',
    icon: Wrench,
    permission: 'maintenance.view',
  },
] as const satisfies ReadonlyArray<{
  label: string;
  description: string;
  to: string;
  icon: typeof FileText;
  permission: QuickActionPermission;
}>;

/** Pure predicate split for tests and the E2E layout fixture. */
export function filterQuickActionsByPermission(canAccess: CanAccessFn) {
  return QUICK_ACTIONS.filter((action) => canAccess(action.permission));
}

interface QuickActionsProps {
  /**
   * Optional override for the auth predicate, used only by the E2E layout
   * fixture which renders outside an authenticated session. Production
   * rendering always derives permissions from useAuth().
   */
  canAccessOverride?: CanAccessFn;
}

/**
 * Quick Actions are permission-aware: an action is only offered when the
 * current role may actually complete it. Roles with no actionable permission
 * (e.g. USER) get no dead ends — the section is omitted honestly instead of
 * showing actions that would fail later.
 */
export function QuickActions({ canAccessOverride }: QuickActionsProps = {}) {
  const { canAccess } = useAuth();
  const actions = filterQuickActionsByPermission(canAccessOverride ?? canAccess);

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="إجراءات سريعة">
      <SectionHeader
        title="إجراءات سريعة"
        description="أكثر الإجراءات التشغيلية استخداماً ضمن صلاحياتك"
      />
      <div className="grid grid-cols-2 gap-3" data-dashboard-action-grid>
        {actions.map((action) => {
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
