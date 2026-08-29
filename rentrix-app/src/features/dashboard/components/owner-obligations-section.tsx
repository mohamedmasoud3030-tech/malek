import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, HandCoins } from 'lucide-react';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import {
  DashboardSignalHeader,
  DashboardSignalLoading,
  DashboardSignalPanel,
  dashboardSectionActionClass,
} from './dashboard-signal-primitives';

interface OwnerObligationsSectionProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/**
 * Owner obligations — the office's liability towards owners. Owner funds are
 * never office profit; the numbers are the snapshot KPIs rendered as-is, and
 * the next action is the canonical settlements workspace.
 */
export const OwnerObligationsSection = memo(function OwnerObligationsSection({ snapshot, isLoading, settings }: OwnerObligationsSectionProps) {
  const payable = snapshot?.ownerFunds.netPayable ?? 0;
  const drafts = snapshot?.ownerFunds.settlementsDraft ?? 0;
  const approved = snapshot?.ownerFunds.settlementsApproved ?? 0;
  const pending = drafts + approved;
  const tone = approved > 0 ? 'danger' : drafts > 0 ? 'warning' : payable > 0 ? 'info' : 'success';
  const urgency = approved > 0
    ? `${approved} تسوية معتمدة جاهزة للصرف الآن`
    : drafts > 0
      ? `${drafts} تسوية بانتظار الاعتماد`
      : payable > 0
        ? 'لا توجد تسويات معلقة'
        : 'لا توجد مستحقات معلقة';

  return (
    <DashboardSignalPanel labelledBy="owner-obligations-title" className="h-full">
      <DashboardSignalHeader
        id="owner-obligations-title"
        title="مستحقات الملاك"
        meta="التزامات المكتب تجاه الملاك"
        icon={HandCoins}
        tone={tone}
        trailing={<Link to="/owner-settlements" className={dashboardSectionActionClass}>عرض الكل</Link>}
      />

      {isLoading ? (
        <DashboardSignalLoading label="جارٍ تحميل مستحقات الملاك" />
      ) : (
        <Link
          to="/owner-settlements"
          data-dashboard-owner-obligations-link
          className="grid min-w-0 gap-3 border-t border-border/70 bg-muted/20 p-3 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 sm:p-4"
          aria-label={`مستحقات الملاك ${formatCompanyMoney(settings, payable)} — انتقل إلى تسويات الملاك`}
        >
          <span className="flex min-w-0 items-end justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-muted-foreground">صافي المستحق الآن</span>
              <span dir="ltr" className="mt-1 block truncate text-2xl font-black tracking-tight text-foreground">
                {formatCompanyMoney(settings, payable)}
              </span>
            </span>
            <ArrowLeft className="mb-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </span>

          <span className="grid min-w-0 grid-cols-2 gap-2" data-dashboard-owner-obligations-breakdown>
            <span className="min-w-0 rounded-lg bg-card px-2.5 py-2">
              <span className="block text-[11px] font-bold text-muted-foreground">بانتظار الاعتماد</span>
              <span className={`mt-0.5 block text-lg font-black tabular-nums ${drafts > 0 ? 'text-warning' : 'text-foreground'}`}>{drafts}</span>
            </span>
            <span className="min-w-0 rounded-lg bg-card px-2.5 py-2">
              <span className="block text-[11px] font-bold text-muted-foreground">معتمدة بانتظار الصرف</span>
              <span className={`mt-0.5 block text-lg font-black tabular-nums ${approved > 0 ? 'text-danger' : 'text-foreground'}`}>{approved}</span>
            </span>
          </span>

          <span className="block truncate text-[11px] font-bold text-muted-foreground">{urgency}</span>
        </Link>
      )}
    </DashboardSignalPanel>
  );
});
