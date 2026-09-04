import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { EmptyState } from '@/components/ui/state-surfaces';
import { AccessDenied } from '@/components/layout/access-denied';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Textarea } from '@/components/ui/textarea';
import { getPermissionLabel, type AppPermission } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { canManageGovernedUser, getOfficePersona, getRoleLabel } from '../user-roles-model';
import { fetchGovernedUsers, type GovernedUser } from '../user-roles-service';
import { useEmployeePermissionManagement, type EmployeePermissionEntry } from '../use-employee-permission-management';
import { usePermissionRequestReview, type PermissionRequest } from '../use-permission-request-review';

const employeeCapabilityGroups: readonly Readonly<{
  title: string;
  permissions: readonly AppPermission[];
}>[] = [
  { title: 'العقارات والوحدات', permissions: ['properties.view', 'properties.create', 'properties.edit', 'properties.archive'] },
  { title: 'العقود والمستأجرون', permissions: ['contracts.view', 'contracts.create', 'contracts.edit', 'contracts.approve', 'contracts.cancel'] },
  { title: 'الصيانة والخدمات', permissions: ['maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.approve', 'maintenance.cancel'] },
  { title: 'التحصيل والمالية', permissions: ['financial.workspace.view', 'financial.payments.create'] },
  { title: 'المصروفات', permissions: ['expenses.view', 'expenses.write'] },
  { title: 'التقارير', permissions: ['financial.reports.view', 'financial.reports.export'] },
] as const;

function UserAccessCard({
  user,
  currentUserId,
  permissions,
  onTogglePermission,
  pendingPermission,
}: Readonly<{
  user: GovernedUser;
  currentUserId: string | null | undefined;
  permissions: readonly EmployeePermissionEntry[];
  onTogglePermission: (userId: string, permission: AppPermission, allowed: boolean) => void;
  pendingPermission: string | null;
}>) {
  const isCurrentUser = !canManageGovernedUser(currentUserId, user.id);
  const isOwner = getOfficePersona(user.role ?? null) === 'OWNER';
  const displayName = user.fullName?.trim() || user.name || user.email;
  const permissionByKey = new Map(permissions.map((entry) => [entry.permission, entry]));

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
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
          <span className="font-bold">نوع الحساب</span>
          <Badge variant="outline">{getRoleLabel(user.role ?? 'USER')}</Badge>
        </div>

        {isOwner ? (
          <div className="rounded-xl bg-primary/5 p-3 text-sm leading-6 text-muted-foreground">
            صاحب المكتب لديه كل الصلاحيات تلقائيًا ولا يحتاج إعدادًا يدويًا.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black">
              <ShieldCheck className="size-4 text-primary" />
              صلاحيات الموظف
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              فعّل ما يحتاجه الموظف فقط. «عرض» يفتح القسم، وباقي الأزرار تتحكم في الإجراء نفسه على السيرفر.
            </p>
            <div className="space-y-3">
              {employeeCapabilityGroups.map((group) => (
                <div key={group.title} className="space-y-2 rounded-xl border border-border/70 p-3">
                  <p className="text-xs font-black text-muted-foreground">{group.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.permissions.map((permission) => {
                      const entry = permissionByKey.get(permission);
                      const allowed = entry?.allowed ?? false;
                      const operationKey = `${user.id}:${permission}`;
                      return (
                        <Button
                          key={permission}
                          type="button"
                          size="sm"
                          variant={allowed ? 'default' : 'secondary'}
                          disabled={!user.isActive || pendingPermission === '__stale__' || pendingPermission === operationKey}
                          aria-pressed={allowed}
                          onClick={() => onTogglePermission(user.id, permission, !allowed)}
                        >
                          {pendingPermission === operationKey ? <RefreshCw className="size-3.5 animate-spin" /> : null}
                          {getPermissionLabel(permission)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
  if (resourceRoute.startsWith('/maintenance')) return 'الخدمات';
  if (resourceRoute.startsWith('/reports')) return 'التقارير';
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
          <p className="mt-1 text-xs leading-5 text-muted-foreground">طلبات إضافية من الموظفين؛ إعداد صاحب المكتب المباشر يظل هو القرار الأعلى.</p>
        </div>
        <Button variant="secondary" onClick={() => void requestsQuery.refetch()} disabled={requestsQuery.isFetching}>
          <RefreshCw className={requestsQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
          تحديث
        </Button>
      </div>

      {requestsQuery.isPending ? <LoadingState variant="section" label="جارٍ تحميل طلبات الصلاحية..." /> : null}
      {requestsQuery.isError && !requestsQuery.data ? (
        <DataErrorScreen
          title="تعذر تحميل طلبات الصلاحية"
          fallbackMessage="تحقق من الاتصال ثم أعد المحاولة."
          error={requestsQuery.error}
          action={<Button variant="secondary" onClick={() => void requestsQuery.refetch()}>إعادة المحاولة</Button>}
        />
      ) : null}
      {requestsQuery.isError && requestsQuery.data ? (
        <DataRefreshAlert
          title="تعذر تحديث طلبات الصلاحية"
          description="نعرض آخر قائمة متاحة للقراءة فقط. القرارات والإلغاء متوقفة حتى ينجح التحديث."
          onRetry={() => { void requestsQuery.refetch(); }}
        />
      ) : null}
      {!requestsQuery.isPending && !requestsQuery.isError && requests.length === 0 ? (
        <EmptyState title="لا توجد طلبات صلاحية" description="لا توجد طلبات تحتاج مراجعة الآن." />
      ) : null}

      {!requestsQuery.isPending && requests.length > 0 ? (
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
                  <Button disabled={requestsQuery.isError || decisionMutation.isPending} onClick={() => { if (!requestsQuery.isError) decisionMutation.mutate({ request, decision: 'APPROVED', reason: 'تمت المراجعة والموافقة' }); }}>موافقة</Button>
                  <Button variant="danger" disabled={requestsQuery.isError || decisionMutation.isPending} onClick={() => { if (!requestsQuery.isError) { setRejecting(request); setDecisionReason(''); } }}>رفض</Button>
                </div>
              ) : request.status === 'APPROVED' && request.grant_active !== false ? (
                <Button variant="secondary" disabled={requestsQuery.isError || revokeMutation.isPending} onClick={() => { if (!requestsQuery.isError) revokeMutation.mutate(request); }}>إلغاء الصلاحية</Button>
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
  const { permissionsQuery, permissionMutation } = useEmployeePermissionManagement(canManageUsers);

  if (!canManageUsers && !canReviewRequests) {
    return <AccessDenied message="لا تملك صلاحية إدارة الموظفين أو مراجعة طلبات الصلاحية." />;
  }

  const hasUsersReadError = usersQuery.isError || permissionsQuery.isError;
  const hasCachedUsersSnapshot = Boolean(usersQuery.data && permissionsQuery.data);

  const pendingPermission = permissionMutation.variables
    ? `${permissionMutation.variables.userId}:${permissionMutation.variables.permission}`
    : null;

  return (
    <section className="space-y-5" aria-label="الموظفون والصلاحيات">
      {canManageUsers ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserCog className="size-5" /></span>
              <div>
                <h2 className="font-black">الموظفون والصلاحيات</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">صاحب المكتب يملك كل شيء. لكل موظف فعّل فقط القسم والإجراءات التي يحتاجها.</p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => { void usersQuery.refetch(); void permissionsQuery.refetch(); }}
              disabled={usersQuery.isFetching || permissionsQuery.isFetching}
            >
              <RefreshCw className={usersQuery.isFetching || permissionsQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
              تحديث
            </Button>
          </div>

          {usersQuery.isPending || permissionsQuery.isPending ? <LoadingState variant="section" label="جارٍ تحميل الموظفين والصلاحيات..." /> : null}
          {hasUsersReadError && !hasCachedUsersSnapshot ? (
            <DataErrorScreen
              title="تعذر تحميل الموظفين والصلاحيات"
              fallbackMessage="تحقق من الاتصال ثم أعد المحاولة."
              error={usersQuery.error ?? permissionsQuery.error}
              action={<Button variant="secondary" onClick={() => { void usersQuery.refetch(); void permissionsQuery.refetch(); }}>إعادة المحاولة</Button>}
            />
          ) : null}
          {hasUsersReadError && hasCachedUsersSnapshot ? (
            <DataRefreshAlert
              title="تعذر تحديث الموظفين والصلاحيات"
              description="نعرض آخر إعدادات مؤكدة للقراءة فقط. تغيير الصلاحيات متوقف لتجنب الكتابة فوق قرار أحدث."
              onRetry={() => { void usersQuery.refetch(); void permissionsQuery.refetch(); }}
            />
          ) : null}
          {usersQuery.data && usersQuery.data.length === 0 ? (
            <EmptyState title="لا يوجد موظفون" description="لا توجد حسابات متاحة الآن." />
          ) : null}
          {usersQuery.data && usersQuery.data.length > 0 && permissionsQuery.data ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersRound className="size-4" />
                {usersQuery.data.length} حسابات
              </div>
              <ResponsiveCardGrid desktopColumns={2} gap="md" aria-label="بطاقات الموظفين">
                {usersQuery.data.map((governedUser) => (
                  <UserAccessCard
                    key={governedUser.id}
                    user={governedUser}
                    currentUserId={user?.id}
                    permissions={permissionsQuery.data.filter((entry) => entry.user_id === governedUser.id)}
                    pendingPermission={hasUsersReadError ? '__stale__' : permissionMutation.isPending ? pendingPermission : null}
                    onTogglePermission={(userId, permission, allowed) => { if (!hasUsersReadError) permissionMutation.mutate({ userId, permission, allowed }); }}
                  />
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
