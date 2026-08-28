import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, CircleDashed, Upload, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useOptionalAuth } from '@/hooks/use-auth';
import { ATTACHMENTS_ACCEPT } from '@/lib/attachments-contract';
import { getActionableSupabaseErrorMessage } from '@/lib/supabase-error';
import { usePropertyOwners } from '@/features/owners/useOwners';
import { useOwnerAgreements } from '@/features/owners/useOwnerAgreements';
import { useUnits } from '@/features/units/use-units';
import {
  listContextualDocuments,
  uploadContextualDocument,
  type ContextualDocumentRow,
} from '@/services/documents/contextualDocumentsService';
import { derivePropertyWorkflowHealth, type PropertyWorkflowHealth } from '../property-service';
import { useProperty } from '../use-properties';
import {
  derivePropertyOnboardingWorkflow,
  isPropertyOnboardingComplete,
  type PropertyOnboardingStepId,
} from './property-onboarding-workflow';

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
 * Compatibility banner retained for list/detail callers that only need the
 * owner/agreement readiness signal. The full property page uses the canonical
 * seven-step workflow below.
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

function stepActionLabel(stepId: PropertyOnboardingStepId): string | null {
  if (stepId === 'OWNER_AND_AGREEMENT') return 'الملكية والاتفاقية';
  if (stepId === 'UNITS') return 'إدارة الوحدات';
  if (stepId === 'DOCUMENTS') return 'رفع مستند';
  if (stepId === 'INSPECTION') return 'رفع محضر الفحص';
  if (stepId === 'RISK_ASSESSMENT') return 'رفع تقييم المخاطر';
  if (stepId === 'HANDOVER') return 'رفع محضر التسليم';
  return null;
}

/**
 * D12 canonical property handover workflow. It is one operational workspace,
 * not seven disconnected cards and not a second backend state machine.
 * Existing authorities provide truth: property data, owner/agreement links,
 * units, and company-scoped property documents. Inspection/risk/handover are
 * satisfied only by deliberately titled evidence documents.
 */
export function PropertyOnboardingWorkflow({ propertyId }: Readonly<{ propertyId: string }>) {
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const canWriteDocuments = auth?.canAccess('documents.write') ?? false;
  const queryClient = useQueryClient();
  const readiness = usePropertyOnboardingReadiness(propertyId);
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const documentsQueryKey = ['contextual-documents', 'property', propertyId] as const;
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey,
    queryFn: () => listContextualDocuments('property', propertyId),
    enabled: Boolean(propertyId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => uploadContextualDocument({
      file,
      title: title ?? file.name,
      category: 'other',
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      toast.success('تم حفظ إثبات استلام العقار');
    },
    onError: (error) => toast.error(getActionableSupabaseErrorMessage(error, 'تعذر رفع إثبات الاستلام')),
  });

  const documents = (documentsQuery.data ?? []) as ContextualDocumentRow[];
  const steps = derivePropertyOnboardingWorkflow({
    property: propertyQuery.data,
    ownerAndAgreementReady: readiness.status === 'ready',
    unitCount: unitsQuery.data?.length ?? 0,
    documents,
  });
  const completeCount = steps.filter((step) => step.complete).length;
  const workflowComplete = isPropertyOnboardingComplete(steps);
  const isLoading = propertyQuery.isLoading || unitsQuery.isLoading || documentsQuery.isLoading || readiness.status === 'loading';

  const navigateTo = (stepId: PropertyOnboardingStepId) => {
    if (stepId !== 'OWNER_AND_AGREEMENT' && stepId !== 'UNITS') return;
    (navigate as unknown as (opts: unknown) => void)({
      to: '/properties/$propertyId',
      params: { propertyId },
      search: { tab: stepId === 'OWNER_AND_AGREEMENT' ? 'ownership' : 'units' } as never,
    });
  };

  return (
    <Card data-property-onboarding-workflow>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>استلام وتجهيز العقار</CardTitle>
            <CardDescription className="mt-1">
              رحلة واحدة من بيانات العقار إلى محضر التسليم قبل اعتباره جاهزاً للتشغيل.
            </CardDescription>
          </div>
          <StatusBadge tone={workflowComplete ? 'success' : 'warning'}>
            {isLoading ? 'جارٍ التحقق…' : workflowComplete ? 'جاهز للتشغيل' : `${completeCount} / 7 مكتمل`}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="divide-y divide-border/60 rounded-2xl border border-border/60" aria-label="خطوات استلام وتجهيز العقار">
          {steps.map((step, index) => {
            const actionLabel = stepActionLabel(step.id);
            const supportsUpload = ['DOCUMENTS', 'INSPECTION', 'RISK_ASSESSMENT', 'HANDOVER'].includes(step.id);
            return (
              <li key={step.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black tabular-nums">
                    {index + 1}
                  </span>
                  {step.complete ? (
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <CircleDashed className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold">{step.label}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </div>
                </div>

                <div className="flex min-h-11 shrink-0 items-center gap-2">
                  <StatusBadge tone={step.complete ? 'success' : 'neutral'}>
                    {step.complete ? 'مكتمل' : 'مطلوب'}
                  </StatusBadge>

                  {!step.complete && actionLabel && (step.id === 'OWNER_AND_AGREEMENT' || step.id === 'UNITS') ? (
                    <Button type="button" variant="secondary" className="min-h-11" onClick={() => navigateTo(step.id)}>
                      {actionLabel}
                    </Button>
                  ) : null}

                  {!step.complete && actionLabel && supportsUpload && canWriteDocuments ? (
                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-input bg-background px-3 text-sm font-semibold transition hover:bg-muted focus-within:ring-4 focus-within:ring-primary/20">
                      <Upload className="me-2 size-4" aria-hidden="true" />
                      {uploadMutation.isPending ? 'جارٍ الرفع…' : actionLabel}
                      <input
                        type="file"
                        className="sr-only"
                        accept={ATTACHMENTS_ACCEPT}
                        disabled={uploadMutation.isPending}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          if (!file) return;
                          uploadMutation.mutate({ file, title: step.evidenceTitle });
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
