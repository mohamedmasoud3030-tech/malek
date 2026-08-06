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
    <section className="dashboard-action-panel" aria-label="إجراءات سريعة" data-dashboard-action-panel>
      <SectionHeader
        title="إجراءات سريعة"
        description="اختصارات واضحة ضمن صلاحياتك فقط"
      />
      <div className="dashboard-action-grid" data-dashboard-action-grid>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.to} to={action.to} className="dashboard-action-card">
              <span className="dashboard-action-card__icon" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <span className="dashboard-action-card__text">
                <span className="dashboard-action-card__label">{action.label}</span>
                <span className="dashboard-action-card__description">{action.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
