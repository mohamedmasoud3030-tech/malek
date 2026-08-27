import { useDialogNavigate } from '@/app/router/background-location';
import { FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { groupAgreementsByTemporalStatus } from '../ownerAgreementService';
import { useOwnerAgreementsForOwner } from '../useOwnerAgreements';

const commissionTypeLabels = { RATE: 'نسبة من التحصيل', FIXED_MONTHLY: 'مبلغ شهري ثابت' } as const;

/**
 * Owner-dossier view of the management agreements across this owner's
 * properties. Read-only: creating agreements and versions stays with the
 * property workspace (single management authority); each row links there.
 */
export function OwnerAgreementsSection({ ownerId }: Readonly<{ ownerId: string }>) {
  const companySettings = useCompanySettingsContract();
  const agreementsQuery = useOwnerAgreementsForOwner(ownerId);
  const dialogNavigate = useDialogNavigate();
  const agreements = agreementsQuery.data ?? [];

  if (agreementsQuery.isLoading) {
    return (
      <Card data-owner-agreements-section>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="size-5 text-primary" aria-hidden="true" />
            اتفاقيات الإدارة
          </CardTitle>
          <CardDescription>جارٍ تحميل اتفاقيات الإدارة لعقارات المالك…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { current, scheduled, ended } = groupAgreementsByTemporalStatus(agreements);

  const temporalBadge = (group: 'current' | 'scheduled' | 'ended') =>
    group === 'current'
      ? { tone: 'success' as const, label: 'سارية' }
      : group === 'scheduled'
        ? { tone: 'info' as const, label: 'قادمة' }
        : { tone: 'neutral' as const, label: 'منتهية' };

  const rows = [
    ...current.map((agreement) => ({ agreement, group: 'current' as const })),
    ...scheduled.map((agreement) => ({ agreement, group: 'scheduled' as const })),
    ...ended.map((agreement) => ({ agreement, group: 'ended' as const })),
  ];

  return (
    <Card data-owner-agreements-section>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="size-5 text-primary" aria-hidden="true" />
          اتفاقيات الإدارة
        </CardTitle>
        <CardDescription>
          الاتفاقيات المسجلة على عقارات هذا المالك؛ الإنشاء والتعديل يتم من قسم الملكية في ملف العقار.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="لا توجد اتفاقيات إدارة"
            description="اربط المالك بعقاره وأنشئ اتفاقية الإدارة من قسم الملكية في ملف العقار."
          />
        ) : (
          <ul className="space-y-2" aria-label="اتفاقيات إدارة المالك">
            {rows.map(({ agreement, group }) => {
              const badge = temporalBadge(group);
              return (
                <li
                  key={agreement.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {agreement.property?.title ?? 'عقار غير محدد'}
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {commissionTypeLabels[agreement.commission_type]} ·{' '}
                      {agreement.commission_type === 'RATE'
                        ? `${formatCompanyNumber(companySettings, agreement.commission_value)}%`
                        : formatCompanyMoney(companySettings, agreement.commission_value)}
                      {' · '}
                      {formatCompanyDate(companySettings, agreement.starts_on)} —{' '}
                      {agreement.ends_on
                        ? formatCompanyDate(companySettings, agreement.ends_on)
                        : 'مفتوحة'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 shrink-0"
                    onClick={() =>
                      dialogNavigate({
                        to: '/properties/$propertyId',
                        params: { propertyId: agreement.property_id },
                        search: { tab: 'ownership' } as never,
                      })
                    }
                  >
                    فتح قسم الملكية
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
