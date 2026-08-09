import { useQuery } from '@tanstack/react-query';
import { Building2, DoorOpen, FileText, UserRoundCog, WalletCards } from 'lucide-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { getOwnerDisplayName } from '../services/owner-service';
import { listOwnerSettlements } from '../services/owner-settlements-service';
import { useOwnerDetailSnapshot } from '../useOwners';

export function OwnerPreviewDialog({
  ownerId,
  open,
  onOpenChange,
}: Readonly<{
  ownerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const settings = useCompanySettingsContract();
  const { authorization } = useAuth();
  const canViewSettlements = canAccess(authorization, 'financial.owner_settlements.view');
  const detailQuery = useOwnerDetailSnapshot(ownerId ?? '');
  const settlementsQuery = useQuery({
    queryKey: ['owner-settlements', 'preview', ownerId],
    queryFn: listOwnerSettlements,
    enabled: Boolean(ownerId) && canViewSettlements,
  });
  const snapshot = detailQuery.data;
  const owner = snapshot?.owner;
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={owner ? getOwnerDisplayName(owner) : 'معاينة المالك'}
      description="بيانات المالك وعلاقاته التشغيلية والمالية من المكوّن الموحد، بدون فتح صفحة تفاصيل مستقلة."
    >
      {detailQuery.isLoading ? <LoadingState label="جارٍ تحميل ملف المالك" /> : null}
      {detailQuery.isError ? (
        <ErrorState
          title="تعذر تحميل ملف المالك"
          description={detailQuery.error instanceof Error ? detailQuery.error.message : 'حدث خطأ أثناء تحميل بيانات المالك.'}
          onRetry={() => { void detailQuery.refetch(); }}
        />
      ) : null}
      {snapshot && owner ? (
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserRoundCog className="size-6" aria-hidden="true" />
              </div>
              <CardTitle className="text-base">بيانات المالك</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailFields
                columns={3}
                fields={[
                  { label: 'الهاتف', value: owner.phone ? <span dir="ltr">{owner.phone}</span> : 'غير موثق' },
                  { label: 'البريد الإلكتروني', value: owner.email ? <span dir="ltr">{owner.email}</span> : 'غير موثق' },
                  { label: 'الحالة', value: <StatusBadge tone={owner.is_active ? 'success' : 'neutral'} dot>{owner.is_active ? 'نشط' : 'غير نشط'}</StatusBadge> },
                ]}
              />
            </CardContent>
          </Card>

          <ResponsiveCardGrid>
            <KpiCard label="العقارات" value={formatCompanyNumber(settings, snapshot.properties.length)} icon={Building2} accent="primary" />
            <KpiCard label="الوحدات" value={formatCompanyNumber(settings, snapshot.units.length)} icon={DoorOpen} accent="sky" />
            <KpiCard label="العقود النشطة" value={formatCompanyNumber(settings, snapshot.contracts.filter((contract) => contract.status === 'active').length)} icon={FileText} accent="emerald" />
            <KpiCard label="الرصيد المستحق" value={formatCompanyMoney(settings, snapshot.financialSummary.outstandingBalance)} icon={WalletCards} accent="amber" />
          </ResponsiveCardGrid>

          <Card>
            <CardHeader><CardTitle className="text-base">العقارات المرتبطة</CardTitle></CardHeader>
            <CardContent>
              {snapshot.properties.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {snapshot.properties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => (navigate as unknown as (opts: unknown) => void)({ to: '/properties/$propertyId', params: { propertyId: property.id }, state: { backgroundLocation: location } as unknown as Record<string, unknown> })}
                      className="min-h-11 rounded-xl border border-border/70 bg-muted/20 p-4 text-start transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <p className="font-black">{property.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{property.address || 'بدون عنوان موثق'}</p>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">لا توجد عقارات مرتبطة بهذا المالك.</p>}
            </CardContent>
          </Card>

          {canViewSettlements && settlementsQuery.data ? (
            <Card>
              <CardHeader><CardTitle className="text-base">أحدث التسويات</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {settlementsQuery.data.filter((item) => item.owner_id === owner.id).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
                    <span className="font-bold">{item.property_title}</span>
                    <span className="ms-auto font-black" dir="ltr">{formatCompanyMoney(settings, item.net_payable_amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
