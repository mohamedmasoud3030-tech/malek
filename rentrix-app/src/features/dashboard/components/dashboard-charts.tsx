import { Link } from '@tanstack/react-router';
import { ArrowUpLeft } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface DashboardChartsProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/**
 * Compact portfolio context for Today.
 * Collection and cash figures already have an authoritative home in Money and
 * the hero; this strip keeps only occupancy context without another report.
 */
export function DashboardCharts({ snapshot, isLoading, settings: _settings }: DashboardChartsProps) {
  if (isLoading) {
    return <LoadingState variant="section" label="جارٍ تحميل حالة المحفظة" />;
  }

  const items = [
    { label: 'الوحدات', value: snapshot?.portfolio.units ?? 'غير متاح' },
    { label: 'مشغولة', value: snapshot?.occupancy.occupiedUnits ?? 'غير متاح' },
    { label: 'شاغرة', value: snapshot?.occupancy.vacantUnits ?? 'غير متاح', warning: (snapshot?.occupancy.vacantUnits ?? 0) > 0 },
    { label: 'الإشغال', value: typeof snapshot?.occupancy.occupancyRate === 'number' ? `${snapshot.occupancy.occupancyRate}%` : 'غير متاح' },
  ];

  return (
    <Link to="/properties" className="dashboard-portfolio-strip" data-dashboard-analytics-link aria-label="فتح المحفظة">
      <dl aria-label="ملخص حالة المحفظة">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd data-warning={item.warning ? 'true' : undefined} dir="ltr">{item.value}</dd>
          </div>
        ))}
      </dl>
      <span className="dashboard-portfolio-strip__link">
        التفاصيل
        <ArrowUpLeft className="size-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
