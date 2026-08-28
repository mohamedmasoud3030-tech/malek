import { Link } from '@tanstack/react-router';
import { HandCoins } from 'lucide-react';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import {
  DashboardSignalHeader,
  DashboardSignalPanel,
  dashboardSectionActionClass,
} from './dashboard-signal-primitives';

interface OwnerObligationsSectionProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/** Owner funds are a liability/settlement signal, never office profit. */
export function OwnerObligationsSection({ snapshot, isLoading, settings }: OwnerObligationsSectionProps) {
  const payable = snapshot?.ownerFunds.netPayable ?? 0;
  const drafts = snapshot?.ownerFunds.settlementsDraft ?? 0;
  const approved = snapshot?.ownerFunds.settlementsApproved ?? 0;
  const pending = drafts + approved;
  const tone = pending > 0 ? 'warning' : payable > 0 ? 'info' : 'success';

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
      <Link
        to="/owner-settlements"
        data-dashboard-owner-obligations-link
        className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border/70 bg-muted/20 px-3 py-3 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 sm:px-4"
        aria-label="مستحقات الملاك — انتقل إلى تسويات الملاك"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold text-muted-foreground">صافي المستحق الآن</span>
          <span dir="ltr" className="mt-1 block truncate text-xl font-black tracking-tight text-foreground">
            {isLoading ? '—' : formatCompanyMoney(settings, payable)}
          </span>
        </span>
        <span className="max-w-36 text-end text-[11px] font-semibold leading-5 text-muted-foreground">
          {isLoading ? 'جارٍ التحميل' : pending > 0 ? `${pending} تسوية معلقة` : 'لا توجد تسويات معلقة'}
        </span>
      </Link>
    </DashboardSignalPanel>
  );
}
