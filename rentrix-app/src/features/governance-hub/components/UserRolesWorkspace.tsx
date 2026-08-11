import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/layout/access-denied';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { UserRole } from '@/domain/types';
import { useAuth } from '@/hooks/use-auth';
import { getPermissionLabel } from '@/features/auth/permissions';
import {
  decidePermissionRequest,
  listPermissionRequestsForReview,
  revokePermissionGrant,
  type PermissionRequest,
} from '@/features/auth/permission-request-service';
import { canManageGovernedUser, getRoleLabel, governedUserRoles } from '../user-roles-model';
import { fetchGovernedUsers, updateGovernedUserAccess, type GovernedUser } from '../user-roles-service';

const roleDescriptions: ReadonlyArray<Readonly<{ role: UserRole; description: string }>> = [
  { role: 'ADMIN', description: 'إدارة كاملة للمكتب والمستخدمين والحوكمة.' },
  { role: 'MANAGER', description: 'تشغيل يومي ومراجعة طلبات الصلاحية فقط، دون إدارة الأدوار أو الشركة.' },
  { role: 'ACCOUNTANT', description: 'عرض ومراجعة البيانات المالية وإعداد التقارير وعمليات المطابقة البنكية. لا يملك صلاحية الاعتماد أو الصرف.' },
  { role: 'OPERATIONS', description: 'إدارة العقارات والعقود والصيانة ومراكز التكلفة. لا يملك صلاحيات مالية.' },
  { role: 'USER', description: 'وصول أساسي مع صلاحيات إضافية معتمدة حسب الحاجة.' },
  { role: 'VIEWER', description: 'عرض فقط لجميع الوحدات والبيانات الأساسية دون أي صلاحية تعديل أو إنشاء.' },
];

function UserAccessCard({ user, currentUserId, isSaving, onSave }: Readonly<{
  user: GovernedUser;
  currentUserId: string | null | undefined;
  isSaving: boolean;
  onSave: (input: Readonly<{ id: string; role: UserRole; isActive: boolean }>) => void;
}>) {
  const [role, setRole] = useState<UserRole>(user.role ?? 'USER');
  const [isActive, setIsActive] = useState(user.isActive);
  const isCurrentUser = !canManageGovernedUser(currentUserId, user.id);

  useEffect(() => {
    setRole(user.role ?? 'USER');
    setIsActive(user.isActive);
  }, [user.id, user.isActive, user.role]);

  const hasChanges = role !== (user.role ?? 'USER') || isActive !== user.isActive;
  const displayName = user.fullName?.trim() || user.name || user.email;
  return (
    <Card className="rounded-2xl">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><CardTitle className="truncate text-base">{displayName}</CardTitle><CardDescription className="mt-1 truncate" dir="ltr">{user.email}</CardDescription></div>
          {isCurrentUser ? <Badge variant="info">حسابك</Badge> : <Badge variant={isActive ? 'success' : 'warning'} dot>{isActive ? 'نشط' : 'موقوف'}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block space-y-1.5 text-sm font-bold">
          <span>الدور</span>
          <Select value={role} disabled={isCurrentUser || isSaving} onChange={(event) => setRole(event.target.value as UserRole)}>
            {governedUserRoles.map((candidate) => <option key={candidate} value={candidate}>{getRoleLabel(candidate)}</option>)}
          </Select>
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-sm font-bold">
          <span>الحساب نشط</span>
          <input type="checkbox" className="size-5 accent-primary" checked={isActive} disabled={isCurrentUser || isSaving} onChange={(event) => setIsActive(event.target.checked)} />
        </label>
        {isCurrentUser
          ? <p className="text-xs leading-5 text-muted-foreground">لا يمكنك خفض صلاحية حسابك أو إيقافه من هذه الشاشة.</p>
          : <Button className="w-full" disabled={!hasChanges || isSaving} onClick={() => onSave({ id: user.id, role, isActive })}>{isSaving ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}</Button>}
      </CardContent>
    </Card>
  );
}

function requestStatusLabel(status: PermissionRequest['status'], grantActive?: boolean) {
  if (status === 'PENDING') return 'قيد المراجعة';
  if (status === 'APPROVED') return grantActive === false ? 'موافق عليه سابقًا — المنحة ملغاة' : 'موافق عليه';
  return 'مرفوض';
}

function formatRequestTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'وقت غير متاح' : new Intl.DateTimeFormat('ar-OM-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function PermissionRequestsQueue() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<PermissionRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const requestsQuery = useQuery({ queryKey: ['permission-requests', 'review'], queryFn: () => listPermissionRequestsForReview() });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['permission-requests'] }); };
  const decisionMutation = useMutation({
    mutationFn: ({ request, decision, reason }: { request: PermissionRequest; decision: 'APPROVED' | 'REJECTED'; reason: string }) => decidePermissionRequest(request.id, decision, reason),
    onSuccess: async (_result, variables) => {
      await refresh();
      setRejecting(null);
      setDecisionReason('');
      toast.success(variables.decision === 'APPROVED' ? 'تم اعتماد الصلاحية وتفعيلها.' : 'تم رفض الطلب وتسجيل السبب.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تسجيل القرار.'),
  });
  const revokeMutation = useMutation({
    mutationFn: (request: PermissionRequest) => revokePermissionGrant(request.requester_user_id, request.permission, 'إلغاء المنحة من شاشة مراجعة الصلاحيات'),
    onSuccess: async () => { await refresh(); toast.success('تم إلغاء المنحة وتحديث صلاحيات المستخدم.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إلغاء المنحة.'),
  });
  const requests = requestsQuery.data ?? [];

  return (
    <section id="permission-requests" className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="permission-requests-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="permission-requests-heading" className="text-base font-black">طلبات الصلاحية</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">الطالب، الصلاحية، المورد، السبب، الوقت والحالة بدون معرّفات تقنية.</p></div>
        <Button variant="secondary" onClick={() => void requestsQuery.refetch()} disabled={requestsQuery.isFetching}><RefreshCw className={requestsQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />تحديث</Button>
      </div>
      {requestsQuery.isPending ? <LoadingState label="جارٍ تحميل طلبات الصلاحية..." /> : null}
      {requestsQuery.isError ? <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">تعذر تحميل طلبات الصلاحية.</p> : null}
      {!requestsQuery.isPending && !requestsQuery.isError && requests.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد طلبات صلاحية.</p> : null}
      <div className="space-y-2">
        {requests.map((request) => (
          <article key={request.id} className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{getPermissionLabel(request.permission)}</p><Badge variant={request.status === 'APPROVED' && request.grant_active !== false ? 'success' : request.status === 'REJECTED' ? 'warning' : 'info'}>{requestStatusLabel(request.status, request.grant_active)}</Badge></div>
              <p className="text-sm">{request.requester_name?.trim() || request.requester_email || 'مستخدم مسجل'}{request.requester_email && request.requester_name ? <span dir="ltr" className="ms-2 text-xs text-muted-foreground">{request.requester_email}</span> : null}</p>
              <p className="break-words text-xs text-muted-foreground">المورد: {request.resource_route || 'عام'} · السبب: {request.reason || 'لم يذكر سببًا'} · {formatRequestTime(request.created_at)}</p>
              {request.decision_reason ? <p className="text-xs font-semibold text-muted-foreground">سبب القرار: {request.decision_reason}</p> : null}
            </div>
            {request.status === 'PENDING' ? (
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" disabled={decisionMutation.isPending} onClick={() => decisionMutation.mutate({ request, decision: 'APPROVED', reason: 'تمت المراجعة والموافقة' })}>موافقة</Button>
                <Button variant="danger" className="min-h-11" disabled={decisionMutation.isPending} onClick={() => { setRejecting(request); setDecisionReason(''); }}>رفض</Button>
              </div>
            ) : request.status === 'APPROVED' && request.grant_active !== false ? (
              <Button variant="secondary" className="min-h-11" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(request)}>إلغاء المنحة</Button>
            ) : null}
          </article>
        ))}
      </div>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open && !decisionMutation.isPending) setRejecting(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>رفض طلب الصلاحية</DialogTitle><DialogDescription>اكتب سببًا واضحًا ليظهر لصاحب الطلب ويمكنه معالجة السبب قبل إعادة الطلب.</DialogDescription></DialogHeader>
          <label className="grid gap-2 text-sm font-bold" htmlFor="permission-rejection-reason">سبب الرفض *</label>
          <Textarea id="permission-rejection-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} rows={4} autoFocus />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setRejecting(null)} disabled={decisionMutation.isPending}>إلغاء</Button><Button variant="danger" disabled={decisionMutation.isPending || !decisionReason.trim()} onClick={() => { if (rejecting) decisionMutation.mutate({ request: rejecting, decision: 'REJECTED', reason: decisionReason }); }}>تأكيد الرفض</Button></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function UserRolesWorkspace() {
  const { canAccess, user } = useAuth();
  const queryClient = useQueryClient();
  const canManageUsers = canAccess('users.manage');
  const canReviewRequests = canAccess('permission_requests.review');
  const usersQuery = useQuery({ queryKey: ['governance-users'], queryFn: fetchGovernedUsers, enabled: canManageUsers });
  const updateMutation = useMutation({
    mutationFn: updateGovernedUserAccess,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['governance-users'] }); toast.success('تم حفظ دور المستخدم وحالته.'); },
    onError: () => toast.error('تعذر حفظ صلاحيات المستخدم. تحقق من صلاحية إدارة المستخدمين.'),
  });

  if (!canManageUsers && !canReviewRequests) return <AccessDenied message="لا تملك صلاحية إدارة المستخدمين أو مراجعة طلبات الصلاحية." />;

  return (
    <section className="space-y-5" aria-label="المستخدمون والصلاحيات">
      {canManageUsers ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserCog className="size-5" /></span><div><h2 className="font-black">المستخدمون والأدوار</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">هذه الإدارة للمسؤول المخوّل فقط، وهي مستقلة عن مراجعة الطلبات.</p></div></div>
            <Button variant="secondary" onClick={() => void usersQuery.refetch()} disabled={usersQuery.isFetching}><RefreshCw className={usersQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />تحديث</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">{roleDescriptions.map(({ role, description }) => <div key={role} className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><p className="font-black">{getRoleLabel(role)}</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></div>)}</div>
          {usersQuery.isPending ? <LoadingState variant="section" label="جارٍ تحميل المستخدمين والأدوار..." /> : null}
          {usersQuery.isError ? <p role="alert" className="rounded-2xl bg-destructive/10 p-5 text-sm text-destructive">تعذر تحميل المستخدمين.</p> : null}
          {usersQuery.data ? <><div className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound className="size-4" />{usersQuery.data.length} مستخدمين</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{usersQuery.data.map((governedUser) => <UserAccessCard key={governedUser.id} user={governedUser} currentUserId={user?.id} isSaving={updateMutation.isPending && updateMutation.variables?.id === governedUser.id} onSave={(input) => updateMutation.mutate(input)} />)}</div></> : null}
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">يمكنك مراجعة طلبات الصلاحية، لكن إدارة أدوار المستخدمين وإعدادات الشركة تتطلب صلاحية مستقلة.</div>
      )}
      {canReviewRequests ? <PermissionRequestsQueue /> : null}
    </section>
  );
}
