import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Link2, RefreshCw, UserPlus, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { DataErrorScreen } from '@/components/data-error-screen';
import {
  createEmployeeInvite,
  employeeInviteErrorMessage,
  INVITABLE_ROLE_LABELS,
  INVITABLE_ROLES,
  listEmployeeInvites,
  revokeEmployeeInvite,
  type EmployeeInviteRow,
  type EmployeeInviteStatus,
  type InvitableRole,
} from '@/services/employee-invites-service';

const STATUS_LABELS: Record<EmployeeInviteStatus, string> = {
  PENDING: 'بانتظار القبول',
  ACCEPTED: 'مقبولة',
  REVOKED: 'ملغاة',
  EXPIRED: 'منتهية',
};

function statusVariant(status: EmployeeInviteStatus): 'success' | 'warning' | 'info' | 'outline' {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'PENDING') return 'info';
  if (status === 'EXPIRED') return 'warning';
  return 'outline';
}

function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

function validateInviteForm(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed.includes('@') || trimmed.startsWith('@')) return 'أدخل بريدًا إلكترونيًا صحيحًا.';
  return null;
}

function InviteRowActions({ invite, onRevoke, revoking }: Readonly<{ invite: EmployeeInviteRow; onRevoke: (id: string) => void; revoking: boolean }>) {
  if (invite.status !== 'PENDING') return null;
  return (
    <Button type="button" size="sm" variant="secondary" disabled={revoking} onClick={() => onRevoke(invite.id)}>
      <XCircle className="size-3.5" />
      إلغاء الدعوة
    </Button>
  );
}

export function EmployeeInvitesPanel() {
  const queryClient = useQueryClient();
  const invitesQuery = useQuery({ queryKey: ['employee-invites'], queryFn: listEmployeeInvites });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('USER');
  const [note, setNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createEmployeeInvite({
        email: email.trim(),
        role,
        note: note.trim() ? note.trim() : null,
        idempotencyKey,
      });
      return result;
    },
    onSuccess: (result) => {
      if ('token' in result) {
        setCreatedLink(inviteLink(result.token));
        setCopied(false);
        setEmail('');
        setNote('');
        setIdempotencyKey(crypto.randomUUID());
        void queryClient.invalidateQueries({ queryKey: ['employee-invites'] });
      } else {
        setValidationError('أُنشئت هذه الدعوة سابقًا. حدّث القائمة لعرضها أو غيّر البيانات.');
      }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeEmployeeInvite(inviteId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['employee-invites'] }),
  });

  const submitError = useMemo(() => {
    if (createMutation.isError) {
      return employeeInviteErrorMessage(createMutation.error, 'تعذر إنشاء الدعوة. حاول مرة أخرى.');
    }
    if (revokeMutation.isError) {
      return employeeInviteErrorMessage(revokeMutation.error, 'تعذر إلغاء الدعوة. حاول مرة أخرى.');
    }
    return null;
  }, [createMutation.isError, createMutation.error, revokeMutation.isError, revokeMutation.error]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatedLink(null);
    const nextValidationError = validateInviteForm(email);
    setValidationError(nextValidationError);
    if (nextValidationError) return;
    createMutation.mutate();
  };

  const copyLink = async () => {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="employee-invites-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserPlus className="size-5" /></span>
          <div>
            <h2 id="employee-invites-heading" className="font-black">دعوة موظف جديد</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">أنشئ رابط دعوة وأرسله للموظف بأي وسيلة. الرابط يعمل مرة واحدة وتنتهي صلاحيته بعد 7 أيام.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void invitesQuery.refetch()} disabled={invitesQuery.isFetching}>
          <RefreshCw className={invitesQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
          تحديث
        </Button>
      </div>

      <EntityForm.Root onSubmit={handleSubmit} aria-busy={createMutation.isPending}>
        <EntityForm.ErrorSummary message={validationError ?? submitError ?? undefined} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <EntityForm.Field label="البريد الإلكتروني للموظف *" error={validationError ?? undefined}>
            <Input
              required
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="employee@example.com"
              disabled={createMutation.isPending}
            />
          </EntityForm.Field>
          <EntityForm.Field label="الدور">
            <Select value={role} disabled={createMutation.isPending} onChange={(event) => setRole(event.target.value as InvitableRole)}>
              {INVITABLE_ROLES.map((option) => (
                <option key={option} value={option}>{INVITABLE_ROLE_LABELS[option]}</option>
              ))}
            </Select>
          </EntityForm.Field>
        </div>
        <EntityForm.Field label="ملاحظة (اختياري)">
          <Input
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="مثال: محاسب الفرع الرئيسي"
            disabled={createMutation.isPending}
          />
        </EntityForm.Field>
        <EntityForm.Actions
          submitLabel="إنشاء رابط الدعوة"
          isSubmitting={createMutation.isPending}
          submitDisabled={createMutation.isPending}
        />
      </EntityForm.Root>

      {createdLink ? (
        <div className="space-y-2 rounded-xl border border-success/40 bg-success/5 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-success">
            <CheckCircle2 className="size-4" />
            أُنشئت الدعوة. انسخ الرابط الآن — لن يظهر مرة أخرى.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg bg-background px-2 py-1.5 text-xs">{createdLink}</code>
            <Button type="button" size="sm" onClick={() => void copyLink()}>
              <Copy className="size-3.5" />
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </Button>
          </div>
        </div>
      ) : null}

      {invitesQuery.isPending ? <LoadingState variant="section" label="جارٍ تحميل الدعوات..." /> : null}
      {invitesQuery.isError ? (
        <DataErrorScreen
          title="تعذر تحميل الدعوات"
          fallbackMessage="تحقق من الاتصال ثم أعد المحاولة."
          error={invitesQuery.error}
          action={<Button variant="secondary" onClick={() => void invitesQuery.refetch()}>إعادة المحاولة</Button>}
        />
      ) : null}
      {invitesQuery.data && invitesQuery.data.length > 0 ? (
        <div className="space-y-2" aria-label="الدعوات السابقة">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="size-4" />
            {invitesQuery.data.length} دعوة
          </div>
          {invitesQuery.data.map((invite) => (
            <article key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p dir="ltr" className="truncate text-sm font-bold">{invite.email}</p>
                  <Badge variant={statusVariant(invite.status)}>{STATUS_LABELS[invite.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  الدور: {INVITABLE_ROLE_LABELS[invite.role]}{invite.note ? ` · ${invite.note}` : ''}
                </p>
              </div>
              <InviteRowActions invite={invite} onRevoke={(id) => revokeMutation.mutate(id)} revoking={revokeMutation.isPending} />
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
