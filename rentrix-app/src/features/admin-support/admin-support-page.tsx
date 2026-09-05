import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Search, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/ui/state-surfaces';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AuthorizationRole } from '@/features/auth/permissions';
import {
  getSupportOperationsSnapshot,
  proposeUserAccessChange,
  triageSupportRequest,
  type MaskedUserInvestigation,
  type SupportOperationsRequest,
} from './admin-support-service';

const queryKey = ['admin-support-operations'] as const;
const statusLabels: Record<SupportOperationsRequest['status'], string> = {
  ACKNOWLEDGED: 'تم الاستلام',
  IN_REVIEW: 'قيد المراجعة',
  WAITING_USER: 'بانتظار المستخدم',
  RESOLVED: 'تم الحل',
  CLOSED: 'مغلق',
};

const roles: readonly AuthorizationRole[] = [
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'OPERATIONS',
  'USER',
  'VIEWER',
];

function nextStatuses(
  request: SupportOperationsRequest,
): readonly SupportOperationsRequest['status'][] {
  if (request.status === 'ACKNOWLEDGED') return ['IN_REVIEW'];
  if (request.status === 'IN_REVIEW') return ['WAITING_USER', 'RESOLVED'];
  if (request.status === 'WAITING_USER') return ['IN_REVIEW'];
  return [];
}

function SupportPageHeader() {
  return (
    <PageHeader
      title="عمليات الدعم والتحقيق"
      description="أدوات محدودة حسب الشركة: طلبات الدعم، بحث مستخدمين مقنّع للمسؤول، وسجل أحداث غير قابل للتعديل. لا انتحال أو تصدير أو إجراءات مالية."
    />
  );
}

export function AdminSupportOperationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [triageTarget, setTriageTarget] = useState<{
    request: SupportOperationsRequest;
    status: SupportOperationsRequest['status'];
    idempotencyKey: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [publicNote, setPublicNote] = useState('');
  const [proposalTarget, setProposalTarget] = useState<MaskedUserInvestigation | null>(null);
  const [proposalRole, setProposalRole] = useState<AuthorizationRole>('USER');
  const [proposalActive, setProposalActive] = useState(true);
  const [proposalReason, setProposalReason] = useState('');
  const [proposalKey, setProposalKey] = useState('');

  const snapshotQuery = useQuery({
    queryKey: [...queryKey, submittedSearch],
    queryFn: () => getSupportOperationsSnapshot(submittedSearch),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const triageMutation = useMutation({
    mutationFn: triageSupportRequest,
    onSuccess: async () => {
      setTriageTarget(null);
      setReason('');
      setPublicNote('');
      await refresh();
      toast.success('تم تسجيل حالة الدعم وحدث التدقيق.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'تعذر تحديث الطلب.'),
  });
  const proposalMutation = useMutation({
    mutationFn: proposeUserAccessChange,
    onSuccess: async (result) => {
      setProposalTarget(null);
      setProposalReason('');
      await refresh();
      toast.success(`تم إنشاء مقترح غير منفذ: ${result.status}`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'تعذر إنشاء المقترح.'),
  });

  if (snapshotQuery.isPending) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <SupportPageHeader />
        <LoadingState variant="route" label="جارٍ تحميل أدوات عمليات الدعم الآمنة..." />
      </PageLayout>
    );
  }

  if (snapshotQuery.isError) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <SupportPageHeader />
        <DataErrorScreen
          title="تعذر تحميل عمليات الدعم"
          fallbackMessage="تعذر الوصول إلى بيانات الدعم. تحقق من الاتصال ثم أعد المحاولة."
          error={snapshotQuery.error}
          action={<Button onClick={() => void snapshotQuery.refetch()}>إعادة المحاولة</Button>}
        />
      </PageLayout>
    );
  }

  const snapshot = snapshotQuery.data;
  if (!snapshot.capabilities.view) {
    return <AccessDenied message="لا تملك صلاحية عرض عمليات الدعم." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <SupportPageHeader />

      <ResponsiveCardGrid gap="sm" aria-label="ملخص عمليات الدعم">
        <KpiCard
          label="طلبات مفتوحة"
          value={snapshot.summary.openRequests}
          icon={Search}
          accent="sky"
          compact
        />
        <KpiCard
          label="عالية أو حرجة"
          value={snapshot.summary.criticalHigh}
          icon={AlertTriangle}
          accent={snapshot.summary.criticalHigh > 0 ? 'rose' : 'emerald'}
          compact
        />
        <KpiCard
          label="بانتظار المستخدم"
          value={snapshot.summary.waitingUser}
          icon={ShieldCheck}
          accent="amber"
          compact
        />
        <KpiCard
          label="اتصالات DEAD"
          value={snapshot.summary.communicationDead}
          icon={AlertTriangle}
          accent={snapshot.summary.communicationDead > 0 ? 'rose' : 'slate'}
          compact
        />
      </ResponsiveCardGrid>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            تحقيق محدود
          </CardTitle>
          <CardDescription>
            ابحث بمرجع دعم، أو — للمسؤول فقط — بثلاثة أحرف على الأقل من اسم/بريد المستخدم. النتائج مقنّعة ولا يدخل البحث في الرابط.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EntityForm.Root
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setSubmittedSearch(search.trim().slice(0, 100));
            }}
          >
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              aria-label="بحث عمليات الدعم"
              placeholder="MS-... أو 3 أحرف من المستخدم"
            />
            <Button type="submit" variant="secondary">بحث</Button>
            {submittedSearch ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setSubmittedSearch('');
                }}
              >
                مسح
              </Button>
            ) : null}
          </EntityForm.Root>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="support-queue-title">
        <div>
          <h2 id="support-queue-title" className="text-xl font-bold">قائمة طلبات الدعم</h2>
          <p className="text-sm text-muted-foreground">
            لا تظهر أوصاف المستخدم الخاصة. الحد {snapshot.limits.requestRows} صفاً ولا توجد إجراءات جماعية.
          </p>
        </div>
        {snapshot.requests.length === 0 ? (
          <EmptyState
            title="لا توجد طلبات دعم مطابقة"
            description={submittedSearch ? 'غيّر عبارة البحث أو امسحها لعرض الطلبات المتاحة.' : 'لا توجد طلبات دعم متاحة ضمن نطاق صلاحياتك الحالي.'}
          />
        ) : (
          <ResponsiveCardGrid desktopColumns={2} gap="md" aria-label="طلبات الدعم">
            {snapshot.requests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle dir="ltr" className="text-base">{request.reference}</CardTitle>
                      <CardDescription>{request.category} · {request.route}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          request.urgency === 'CRITICAL'
                            ? 'danger'
                            : request.urgency === 'HIGH'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {request.urgency}
                      </Badge>
                      <Badge variant="info">{statusLabels[request.status]}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>الدور: {request.requesterRole}</span>
                    <span>الإصدار: {request.appVersion}</span>
                  </div>
                  {request.publicNote ? (
                    <p className="rounded-xl bg-muted/40 p-3 text-sm">{request.publicNote}</p>
                  ) : null}
                  {snapshot.capabilities.triage && nextStatuses(request).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses(request).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setTriageTarget({
                              request,
                              status,
                              idempotencyKey: crypto.randomUUID(),
                            });
                            setReason('');
                            setPublicNote('');
                          }}
                        >
                          {statusLabels[status]}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </ResponsiveCardGrid>
        )}
      </section>

      {snapshot.capabilities.userLookup ? (
        <section className="space-y-3" aria-labelledby="masked-users-title">
          <div>
            <h2 id="masked-users-title" className="text-xl font-bold">بحث المستخدمين المقنّع</h2>
            <p className="text-sm text-muted-foreground">
              قراءة فقط. أي تغيير وصول ينشئ مقترحاً غير منفذ لمدة 7 أيام.
            </p>
          </div>
          {submittedSearch.length < 3 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                أدخل 3 أحرف على الأقل لبحث المستخدمين.
              </CardContent>
            </Card>
          ) : snapshot.users.length === 0 ? (
            <EmptyState
              title="لا توجد نتائج مستخدمين مطابقة"
              description="جرّب عبارة بحث أخرى من ثلاثة أحرف على الأقل."
            />
          ) : (
            <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="نتائج بحث المستخدمين المقنّعة">
              {snapshot.users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{user.nameMasked}</p>
                      <p dir="ltr" className="truncate text-xs text-muted-foreground">{user.emailMasked}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{user.appRole}</Badge>
                      <Badge variant={user.isActive ? 'success' : 'warning'}>
                        {user.isActive ? 'نشط' : 'متوقف'}
                      </Badge>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setProposalTarget(user);
                        setProposalKey(crypto.randomUUID());
                        setProposalRole(user.appRole);
                        setProposalActive(user.isActive);
                        setProposalReason('');
                      }}
                    >
                      معاينة تغيير الوصول
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </ResponsiveCardGrid>
          )}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="investigation-audit-title">
        <div>
          <h2 id="investigation-audit-title" className="text-xl font-bold">أحداث عمليات الدعم</h2>
          <p className="text-sm text-muted-foreground">
            معاينة مقنّعة لسجل append-only؛ لا تظهر معرفات الأهداف أو الأسباب.
          </p>
        </div>
        {snapshot.audit.length === 0 ? (
          <EmptyState
            title="لا توجد أحداث دعم متاحة"
            description="لا توجد أحداث ضمن نطاق صلاحياتك الحالي."
          />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {snapshot.audit.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words font-bold">{event.action}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {event.actorMasked} · {event.targetType}
                    </p>
                  </div>
                  <Badge variant="outline">{event.outcome}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-warning">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>
            غير متاح عمداً: الانتحال، التصدير، الإجراءات الجماعية، تعديل السجلات، رد الأموال، الإلغاءات المالية، أو تنفيذ تغييرات الوصول. استخدم المسارات المتخصصة والموافقات الرسمية.
          </p>
        </CardContent>
      </Card>

      <EntityForm.Overlay
        open={triageTarget !== null}
        onOpenChange={(open) => {
          if (!open && !triageMutation.isPending) setTriageTarget(null);
        }}
        title="تأكيد تغيير حالة الدعم"
        description={triageTarget ? `${triageTarget.request.reference} ← ${statusLabels[triageTarget.status]}` : ''}
        className="max-w-lg"
      >
        <EntityForm.Root
          aria-busy={triageMutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!triageTarget || reason.trim().length < 10 || triageMutation.isPending) return;
            triageMutation.mutate({
              requestId: triageTarget.request.id,
              status: triageTarget.status,
              publicNote,
              reason,
              idempotencyKey: triageTarget.idempotencyKey,
            });
          }}
        >
          <EntityForm.Section
            title="تفاصيل القرار"
            description="لا تكتب أسماء أو بريد أو هاتف أو معرفات سجلات أو تفاصيل مالية."
          >
            <EntityForm.Field label="سبب داخلي إلزامي">
              <Textarea
                required
                minLength={10}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </EntityForm.Field>
            <EntityForm.Field label="ملاحظة آمنة للمستخدم (اختيارية)">
              <Textarea
                maxLength={500}
                value={publicNote}
                onChange={(event) => setPublicNote(event.target.value)}
              />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel="تأكيد وتسجيل التدقيق"
            onCancel={() => setTriageTarget(null)}
            isSubmitting={triageMutation.isPending}
            submitDisabled={!triageTarget || reason.trim().length < 10 || triageMutation.isPending}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={proposalTarget !== null}
        onOpenChange={(open) => {
          if (!open && !proposalMutation.isPending) setProposalTarget(null);
        }}
        title="مقترح تغيير وصول — غير منفذ"
        description="هذه الخطوة لا تغيّر الدور أو حالة الحساب. التنفيذ عالي التأثير غير موجود حتى اعتماد المالك وضوابط إعادة التحقق والمراجع الثاني."
        className="max-w-lg"
      >
        <EntityForm.Root
          aria-busy={proposalMutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!proposalTarget || proposalReason.trim().length < 10 || proposalMutation.isPending) return;
            proposalMutation.mutate({
              targetUserId: proposalTarget.id,
              proposedRole: proposalRole,
              proposedActive: proposalActive,
              reason: proposalReason,
              idempotencyKey: proposalKey,
            });
          }}
        >
          <EntityForm.Section title="المستخدم والتغيير المقترح">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p>{proposalTarget?.nameMasked}</p>
              <p dir="ltr" className="text-xs text-muted-foreground">{proposalTarget?.emailMasked}</p>
            </div>
            <EntityForm.Field label="الدور المقترح">
              <Select
                value={proposalRole}
                onChange={(event) => setProposalRole(event.target.value as AuthorizationRole)}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </Select>
            </EntityForm.Field>
            <label className="flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-bold">
              <span>الحساب نشط</span>
              <input
                type="checkbox"
                className="size-5"
                checked={proposalActive}
                onChange={(event) => setProposalActive(event.target.checked)}
              />
            </label>
            <EntityForm.Field label="سبب المقترح">
              <Textarea
                required
                minLength={10}
                maxLength={500}
                value={proposalReason}
                onChange={(event) => setProposalReason(event.target.value)}
              />
            </EntityForm.Field>
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              <ShieldCheck className="size-4 shrink-0" />
              <p>
                لا يوجد زر تنفيذ. المقترح ينتهي تلقائياً بعد 7 أيام ويُمنع على الحساب الحالي وآخر مسؤول.
              </p>
            </div>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel="حفظ المقترح فقط"
            onCancel={() => setProposalTarget(null)}
            isSubmitting={proposalMutation.isPending}
            submitDisabled={!proposalTarget || proposalReason.trim().length < 10 || proposalMutation.isPending}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </PageLayout>
  );
}
