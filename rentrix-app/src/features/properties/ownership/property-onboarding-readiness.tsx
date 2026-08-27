import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UserRoundCog } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePropertyOwners } from '@/features/owners/useOwners';
import { useOwnerAgreements } from '@/features/owners/useOwnerAgreements';
import { derivePropertyWorkflowHealth, type PropertyWorkflowHealth } from '../property-service';

export type PropertyOnboardingReadiness =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'incomplete'; health: PropertyOnboardingGap; ownerName: string | null }>
  | Readonly<{ status: 'ready' }>;

/** Operational gaps that keep a property from being ready to run. */
export type PropertyOnboardingGap = Exclude<PropertyWorkflowHealth, 'ready'>;

/**
 * Property onboarding readiness derived from the same pure authority as the
 * portfolio register (`derivePropertyWorkflowHealth`), over the owner links
 * and operating agreements the property workspace already reads. There is no
 * separate onboarding state machine here — the banner is guidance only and
 * financial/ownership authority stays with the existing services.
 */
export function usePropertyOnboardingReadiness(propertyId: string): PropertyOnboardingReadiness {
  const ownersQuery = usePropertyOwners(propertyId);
  const agreementsQuery = useOwnerAgreements(propertyId);

  return useMemo(() => {
    if (ownersQuery.isLoading || agreementsQuery.isLoading) {
      return { status: 'loading' } as const;
    }
    const derived = derivePropertyWorkflowHealth({
      property_owners: ownersQuery.data ?? [],
      owner_agreements: agreementsQuery.data ?? [],
    });
    if (derived.workflow_health === 'ready') {
      return { status: 'ready' } as const;
    }
    return {
      status: 'incomplete' as const,
      health: derived.workflow_health as PropertyOnboardingGap,
      ownerName: derived.current_owner_name,
    };
  }, [ownersQuery.isLoading, ownersQuery.data, agreementsQuery.isLoading, agreementsQuery.data]);
}

const readinessCopy: Record<
  PropertyOnboardingGap,
  { title: string; description: string; action: string }
> = {
  missing_owner: {
    title: 'العقار غير مرتبط بمالك ساري',
    description: 'اربط العقار بمالكه من قسم الملكية ثم أنشئ اتفاقية الإدارة ليكمل العقار جاهزيته للتشغيل.',
    action: 'إكمال بيانات الملكية',
  },
  owner_unavailable: {
    title: 'المالك المرتبط غير نشط',
    description: 'راجع بيانات المالك أو اربط مالكاً بديلاً قبل إنشاء اتفاقية الإدارة.',
    action: 'مراجعة الملكية',
  },
  missing_agreement: {
    title: 'لا توجد اتفاقية إدارة سارية',
    description: 'العقار مرتبط بمالك دون اتفاقية إدارة سارية؛ أنشئ الاتفاقية لتغطية الإدارة والتحصيل.',
    action: 'إنشاء اتفاقية إدارة',
  },
};

/**
 * Guided property-onboarding banner shown only while the property is not
 * operationally ready (missing owner / inactive owner / missing current
 * agreement). Ready properties render nothing — no dead space.
 */
export function PropertyOnboardingReadinessBanner({ propertyId }: Readonly<{ propertyId: string }>) {
  const readiness = usePropertyOnboardingReadiness(propertyId);
  const navigate = useNavigate();

  if (readiness.status !== 'incomplete') return null;
  const copy = readinessCopy[readiness.health];

  const openOwnership = () =>
    (navigate as unknown as (opts: unknown) => void)({
      to: '/properties/$propertyId',
      params: { propertyId },
      search: { tab: 'ownership' } as never,
    });

  return (
    <Alert
      variant="warning"
      data-property-onboarding-banner={readiness.health}
      aria-label="جاهزية العقار للتشغيل"
      title={copy.title}
      description={
        readiness.health === 'owner_unavailable' && readiness.ownerName
          ? `المالك «${readiness.ownerName}» غير نشط حالياً — ${copy.description}`
          : copy.description
      }
      action={
        <Button type="button" className="min-h-11" onClick={openOwnership}>
          <UserRoundCog className="me-2 size-4" aria-hidden="true" />
          {copy.action}
        </Button>
      }
    />
  );
}
