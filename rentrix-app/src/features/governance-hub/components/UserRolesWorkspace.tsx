import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/layout/access-denied';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import type { UserRole } from '@/domain/types';
import { useAuth } from '@/hooks/use-auth';
import { canManageGovernedUser, getRoleLabel, governedUserRoles } from '../user-roles-model';
import { fetchGovernedUsers, updateGovernedUserAccess, type GovernedUser } from '../user-roles-service';

const roleDescriptions: ReadonlyArray<Readonly<{ role: UserRole; description: string }>> = [
  { role: 'ADMIN', description: 'إدارة كاملة للمكتب والمستخدمين والحوكمة.' },
  { role: 'MANAGER', description: 'تشغيل يومي ومالية ضمن الصلاحيات، دون إدارة المستخدمين.' },
  { role: 'USER', description: 'وصول محدود للوحة التحكم وكلمة المرور فقط.' },
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
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{displayName}</CardTitle>
            <CardDescription className="mt-1 truncate" dir="ltr">{user.email}</CardDescription>
          </div>
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
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={isActive}
            disabled={isCurrentUser || isSaving}
            onChange={(event) => setIsActive(event.target.checked)}
          />
        </label>
        {isCurrentUser ? (
          <p className="text-xs leading-5 text-muted-foreground">لا يمكنك خفض صلاحية حسابك أو إيقافه من هذه الشاشة.</p>
        ) : (
          <Button className="w-full" disabled={!hasChanges || isSaving} onClick={() => onSave({ id: user.id, role, isActive })}>
            {isSaving ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Actual management surface for existing application users. Account creation
 * intentionally remains outside the browser because it requires a privileged
 * auth-admin endpoint; this page never tries to manufacture a user client-side. */
export function UserRolesWorkspace() {
  const { canAccess, user } = useAuth();
  const queryClient = useQueryClient();
  const canManageUsers = canAccess('system.view');
  const usersQuery = useQuery({ queryKey: ['governance-users'], queryFn: fetchGovernedUsers, enabled: canManageUsers });
  const updateMutation = useMutation({
    mutationFn: updateGovernedUserAccess,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['governance-users'] });
      toast.success('تم حفظ صلاحيات المستخدم. تسري الصلاحيات الجديدة عند تجديد جلسة المستخدم.');
    },
    onError: () => toast.error('تعذر حفظ صلاحيات المستخدم. تحقق من صلاحيتك ثم أعد المحاولة.'),
  });

  if (!canManageUsers) {
    return <AccessDenied message="إدارة المستخدمين والأدوار متاحة للمسؤول فقط." />;
  }

  if (usersQuery.isPending) return <LoadingState variant="section" label="جارٍ تحميل المستخدمين والأدوار..." />;
  if (usersQuery.isError) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm text-destructive">تعذر تحميل المستخدمين. أعد المحاولة لاحقًا.</div>;
  }

  const users = usersQuery.data ?? [];

  return (
    <section className="space-y-5" aria-label="إدارة المستخدمين والأدوار">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserCog className="size-5" /></span>
          <div>
            <h2 className="font-black">المستخدمون والأدوار</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">إدارة أدوار الحسابات الموجودة وحالتها. لا يتم إنشاء حسابات أو تغيير بيانات الدخول من المتصفح.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void usersQuery.refetch()} disabled={usersQuery.isFetching}>
          <RefreshCw className={usersQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} /> تحديث
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {roleDescriptions.map(({ role, description }) => (
          <div key={role} className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><p className="font-black">{getRoleLabel(role)}</p></div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound className="size-4" /> {users.length} مستخدمين ظاهرين لصلاحياتك الحالية</div>
      {users.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">لا توجد حسابات متاحة للإدارة.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((governedUser) => (
            <UserAccessCard
              key={governedUser.id}
              user={governedUser}
              currentUserId={user?.id}
              isSaving={updateMutation.isPending && updateMutation.variables?.id === governedUser.id}
              onSave={(input) => updateMutation.mutate(input)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
