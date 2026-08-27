import { useQuery } from '@tanstack/react-query';
import { RefreshCw, UserCog, UsersRound } from 'lucide-react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/empty-state';
import { AccessDenied } from '@/components/layout/access-denied';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Textarea } from '@/components/ui/textarea';
import { getPermissionLabel } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { canManageGovernedUser, getRoleLabel } from '../user-roles-model';
import { fetchGovernedUsers, type GovernedUser } from '../user-roles-service';
import { usePermissionRequestReview, type PermissionRequest } from '../use-permission-request-review';

function UserAccessCard({ user, currentUserId }: Readonly<{
  user: GovernedUser;
  currentUserId: string | null | undefined;
}>) {
  const isCurrentUser = !canManageGovernedUser(currentUserId, user.id);
  const displayName = user.fullName?.trim() || user.name || user.email;
  return (
    <Card className="rounded-2xl">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{displayName}</CardTitle>
            <CardDescription className="mt-1 truncate" dir="ltr">{user.email}</CardDescription>
          </div>
          {isCurrentUser ? (
            <Badge variant="info">حسابك</Badge>
          ) : (
            <Badge variant={user.isActive ? 'success' : 'warning'} dot>{user.isActive ? 'نشط' : 'موقوف'}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
          <span className="font-bold">الدور الحالي</span>
          <Badge variant="outline">{getRoleLabel(user.role ?? 'USER')}</Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          الدور معروض للمراجعة فقط. تغييرات الوصول تتم من خلال طلبات الصلاحية المعتمدة.
        </p>
      </CardContent>
    </Card>
  );
}

function requestStatusLabel(status: PermissionRequest['status'], grantActive?: boolean) {
  if (status === 'PENDING') return 'قيد المراجعة';
  if (status === 'APPROVED') return grantActive === false ? 'موافق عليه سابقًا — تم إلغاؤه' : 'موافق عليه';
  return 'مرفوض';
}

function requestScopeLabel(resourceRoute: string | null | undefined) {
  if (!resourceRoute) return 'عام';
  if (resourceRoute.startsWith('/financials')) return 'المال';
  if (resourceRoute.startsWith('/properties')) return 'المحفظة';
  if (resourceRoute.startsWith('/contracts') || resourceRoute.startsWith('/tenants') || resourceRoute.startsWith('/people')) return 'التأجير';
  if (resourceRoute.startsWith('/maintenance') || resourceRoute.startsWith('/utilities')) return 'الخدمات';
  if (resourceRoute.startsWith('/reports') || resourceRoute.startsWith('/accounting')) return 'التقارير';
  if (resourceRoute.startsWith('/settings')) return 'الإعدادات';
  return 'قسم محدد';
}

function formatRequestTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'وقت غير متاح'
    : new Intl.DateTimeFormat('ar-OM-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function PermissionRequestsQueue() {
  const {
    requestsQuery,
    requests,
    decisionMutation,
    revokeMutation,
    rejecting,
    setRejecting,
    decisionReason,
    setDecisionReason,
  } = usePermissionRequestReview();

  return (
    <section id="permission-requests" className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="permission-requests-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="permission-requests-heading" className="text-base font-black">طلبات الصلاحية</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">راجع صاحب الطلب والصلاحية والسبب ثم وافق أو ارفض.</p>
        </div>
        <Button variant="secondary" onClick={() => void requestsQuery.refetch()} disabled={requestsQuery.isFetching}>
          <RefreshCw className={requestsQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
          تحديث
        </Button>
      </div>

      {requestsQuery.isPending ? <LoadingState variant="section" label="جارٍ تحميل طلبات الصلاحية..." /> : null}
      {requestsQuery.isError ? (
        <DataErrorScreen
          title="تعذر تحميل طلبات الصلاحية"
          fallbackMessage="تحقق من الاتصال ثم أعد المحاولة."
          error={requestsQuery.error}
          action={<Button variant="secondary" onClick={() => void requestsQuery.refetch()}>إعادة المحاولة</Button>}
        />
      ) : null}
      {!requestsQuery.isPending && !requestsQuery.isError && requests.length === 0 ? (
        <EmptyState title="لا توجد طلبات صلاحية" description="لا توجد طلبات تحتاج مراجعة الآن." />
      ) : null}

      {!requestsQuery.isPending && !requestsQuery.isError && requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map((request) => (
            <article key={request.id} className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{getPermissionLabel(request.permission)}</p>
                  <Badge variant={request.status === 'APPROVED' && request.grant_active !== false ? 'success' : request.status === 'REJECTED' ? 'warning' : 'info'}>
                    {requestStatusLabel(request.status, request.grant_active)}
                  </Badge>
                </div>
                <p className="text-sm">
                  {request.requester_name?.trim() || request.requester_email || 'مستخدم مسجل'}
                  {request.requester_email && request.requester_name ? <span dir="ltr" className="ms-2 text-xs text-muted-foreground">{request.requester_email}</span> : null}
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  النطاق: {requestScopeLabel(request.resource_route)} · السبب: {request.reason || 'لم يذكر سببًا'} · {formatRequestTime(request.created_at)}
                </p>
                {request.decision_reason ? <p className="text-xs font-semibold text-muted-foreground">سبب القرار: {request.decision_reason}</p> : null}
              </div>
              {request.status === 'PENDING' ? (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={decisionMutation.isPending} onClick={() => decisionMutation.mutate({ request, decision: 'APPROVED', reason: 'تمت المراجعة والموافقة' })}>موافقة</Button>
                  <Button variant="danger" disabled={decisionMutation.isPending} onClick={() => { setRejecting(request); setDecisionReason(''); }}>رفض</Button>
                </div>
              ) : request.status === 'APPROVED' && request.grant_active !== false ? (
                <Button variant="secondary" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(request)}>إلغاء الصلاحية</Button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <EntityForm.Overlay
        open={Boolean(rejecting)}
        onOpenChange={(open) => { if (!open && !decisionMutation.isPending) setRejecting(null); }}
        title="رفض طلب الصلاحية"
        description="اكتب سببًا واضحًا ليعرف صاحب الطلب ما الذي يحتاج تعديله قبل إعادة الطلب."
        className="max-w-lg"
        visualVariant="operational"
      >
        <EntityForm.Root
          aria-busy={decisionMutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!rejecting || !decisionReason.trim() || decisionMutation.isPending) return;
            decisionMutation.mutate({ request: rejecting, decision: 'REJECTED', reason: decisionReason.trim() });
          }}
        >
          <EntityForm.Section title="سبب القرار">
            <EntityForm.Field label="سبب الرفض *">
              <Textarea
                id="permission-rejection-reason"
                required
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                rows={4}
                autoFocus
              />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel="تأكيد الرفض"
            submitVariant="danger"
            onCancel={() => setRejecting(null)}
            isSubmitting={decisionMutation.isPending}
            submitDisabled={decisionMutation.isPending || !decisionReason.trim()}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </section>
  );
}

export function UserRolesWorkspace() {
  const { canAccess, user } = useAuth();
  const canManageUsers = canAccess('users.manage');
  const canReviewRequests = canAccess('permission_requests.review');
  const usersQuery = useQuery({ queryKey: ['governance-users'], queryFn: fetchGovernedUsers, enabled: canManageUsers });

  if (!canManageUsers && !canReviewRequests) {
    return <AccessDenied message="لا تملك صلاحية إدارة المستخدمين أو مراجعة طلبات الصلاحية." />;
  }

  return (
    <section className="space-y-5" aria-label="المستخدمون والصلاحيات">
      {canManageUsers ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserCog className="size-5" /></span>
              <div>
                <h2 className="font-black">المستخدمون</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">راجع الحسابات وأدوارها الحالية، ثم استخدم طلبات الصلاحية للتغييرات الإضافية.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => void usersQuery.refetch()} disabled={usersQuery.isFetching}>
              <RefreshCw className={usersQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
              تحديث
            </Button>
          </div>

          {usersQuery.isPending ? <LoadingState variant="section" label="جارٍ تحميل المستخدمين..." /> : null}
          {usersQuery.isError ? (
            <DataErrorScreen
              title="تعذر تحميل المستخدمين"
              fallbackMessage="تحقق من الاتصال ثم أعد المحاولة."
              error={usersQuery.error}
              action={<Button variant="secondary" onClick={() => void usersQuery.refetch()}>إعادة المحاولة</Button>}
            />
          ) : null}
          {usersQuery.data && usersQuery.data.length === 0 ? (
            <EmptyState title="لا يوجد مستخدمون" description="لا توجد حسابات متاحة الآن." />
          ) : null}
          {usersQuery.data && usersQuery.data.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersRound className="size-4" />
                {usersQuery.data.length} مستخدمين
              </div>
              <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="بطاقات المستخدمين">
                {usersQuery.data.map((governedUser) => (
                  <UserAccessCard key={governedUser.id} user={governedUser} currentUserId={user?.id} />
                ))}
              </ResponsiveCardGrid>
            </>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          يمكنك مراجعة طلبات الصلاحية المتاحة لحسابك.
        </div>
      )}
      {canReviewRequests ? <PermissionRequestsQueue /> : null}
    </section>
  );
}
