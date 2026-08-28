import { HandCoins, Percent, Receipt, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface OfficePulseProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/**
 * Four stable, office-owned performance signals. Tenant/owner money is never
 * presented here as office revenue: collections are cash collected on behalf
 * of the operating model, while the net cash signal stays explicitly labelled
 * as collections less recorded expenses.
 */
export function OfficePulse({ snapshot, isLoading, settings }: OfficePulseProps) {
  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل نبض المكتب" />;
  }

  const collected = snapshot?.collections.collectedAmount ?? 0;
  const expenses = snapshot?.expenses.totalAmount ?? 0;
  const netCash = snapshot?.netCash ?? 0;
  const collectionRate = snapshot?.collections.collectionRate ?? 0;

  return (
    <div data-dashboard-office-pulse>
      <ResponsiveCardGrid gap="sm" aria-label="نبض المكتب">
        <KpiCard
          label="التحصيل هذا الشهر"
          value={formatCompanyMoney(settings, collected)}
          sub="ضمن الفترة الحالية"
          icon={HandCoins}
          accent="emerald"
          compact
        />
        <KpiCard
          label="المصروفات المسجلة"
          value={formatCompanyMoney(settings, expenses)}
          sub="ضمن الفترة الحالية"
          icon={Receipt}
          accent="slate"
          compact
        />
        <KpiCard
          label="صافي السيولة التشغيلية"
          value={formatCompanyMoney(settings, netCash)}
          sub="التحصيل ناقص المصروفات المسجلة"
          icon={TrendingUp}
          accent={netCash >= 0 ? 'emerald' : 'rose'}
          compact
        />
        <KpiCard
          label="نسبة التحصيل"
          value={`${collectionRate}%`}
          sub="من استحقاقات الفترة الحالية"
          icon={Percent}
          accent={collectionRate >= 80 ? 'emerald' : collectionRate >= 50 ? 'amber' : 'rose'}
          compact
        />
      </ResponsiveCardGrid>
    </div>
  );
}
