import { Link } from '@tanstack/react-router';
import { Layers3 } from 'lucide-react';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

const BUCKET_CONFIG = [
  {
    key: 'days_1_30',
    label: '1–30 يوم',
    borderClass: 'dashboard-aging-bucket--warning',
    textClass: 'text-warning',
  },
  {
    key: 'days_31_60',
    label: '31–60 يوم',
    borderClass: 'dashboard-aging-bucket--danger-soft',
    textClass: 'text-danger/80',
  },
  {
    key: 'days_61_90',
    label: '61–90 يوم',
    borderClass: 'dashboard-aging-bucket--danger',
    textClass: 'text-danger',
  },
  {
    key: 'days_90_plus',
    label: '+90 يوم',
    borderClass: 'dashboard-aging-bucket--danger',
    textClass: 'text-danger font-bold',
  },
] as const;

interface ArrearsBreakdownProps {
  snapshot: DashboardSnapshot | undefined;
  settings: CompanySettingsContract;
}

export function ArrearsBreakdown({ snapshot, settings }: ArrearsBreakdownProps) {
  const totalOverdue = snapshot?.arrears.totalOverdue ?? 0;
  if (totalOverdue === 0) return null;

  return (
    <Link to="/arrears" className="dashboard-aging-card" data-dashboard-analytics-link>
      <article>
        <div className="dashboard-aging-card__header">
          <span className="dashboard-aging-card__icon" aria-hidden="true">
            <Layers3 className="size-4" />
          </span>
          <div>
            <h3 className="dashboard-aging-card__title">أعمار الذمم</h3>
            <p className="dashboard-aging-card__description">فئات ثابتة للمقارنة والمتابعة</p>
          </div>
        </div>
        <div className="dashboard-aging-grid">
          {BUCKET_CONFIG.map(({ key, label, borderClass, textClass }) => {
            const total = snapshot?.arrears.agedReceivables.buckets[key]?.total ?? 0;
            const count = snapshot?.arrears.agedReceivables.buckets[key]?.invoiceCount ?? 0;
            return (
              <div key={key} className={`dashboard-aging-bucket ${borderClass}`}>
                <p className="dashboard-aging-bucket__label">{label}</p>
                <p className={`dashboard-aging-bucket__value ${textClass}`} dir="ltr">
                  {formatCompanyMoney(settings, total)}
                </p>
                <p className="dashboard-aging-bucket__count">{count} فاتورة</p>
              </div>
            );
          })}
        </div>
      </article>
    </Link>
  );
}
