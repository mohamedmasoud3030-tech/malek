/**
 * EnterpriseStats — Enterprise UX Foundation (Wave 4A)
 *
 * Responsive KPI band for module pages. Wraps the shared `KpiCard` primitive
 * in a responsive grid with a built-in loading skeleton. Values arrive
 * pre-formatted — no calculations happen here.
 */

import type { LucideIcon } from 'lucide-react';
import { KpiCard, type KpiAccent } from '@/components/ui/kpi-card';
import { EnterpriseLoadingState } from './enterprise-loading-state';
import { cn } from '@/lib/utils';

export interface EnterpriseStatItem {
  key: string;
  label: string;
  /** Pre-formatted display value (module owns formatting). */
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accent?: KpiAccent;
}

export interface EnterpriseStatsProps {
  items: EnterpriseStatItem[];
  isLoading?: boolean;
  /** Fixed column count (auto = 2 on mobile, up to 4 on desktop). */
  columns?: 'auto' | 2 | 3 | 4;
  className?: string;
}

const gridClasses: Record<NonNullable<EnterpriseStatsProps['columns']>, string> = {
  auto: 'grid-cols-2 lg:grid-cols-4',
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

export function EnterpriseStats({
  items,
  isLoading = false,
  columns = 'auto',
  className,
}: EnterpriseStatsProps) {
  if (isLoading) {
    return <EnterpriseLoadingState context="stats" rows={columns === 3 ? 3 : 4} className={className} />;
  }

  if (items.length === 0) return null;

  return (
    <div
      data-enterprise-stats
      role="group"
      aria-label="مؤشرات الأداء"
      className={cn('grid gap-3 sm:gap-4', gridClasses[columns], className)}
    >
      {items.map((item) => (
        <KpiCard
          key={item.key}
          label={item.label}
          value={item.value}
          sub={item.sub}
          icon={item.icon}
          trend={item.trend}
          trendValue={item.trendValue}
          accent={item.accent}
        />
      ))}
    </div>
  );
}
