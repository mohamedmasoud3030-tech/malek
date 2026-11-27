import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { MalekBrand } from '@/components/brand/malek-brand';
import { useAuth } from '@/hooks/use-auth';
import {
  acceptEmployeeInvite,
  employeeInviteErrorMessage,
  INVITABLE_ROLE_LABELS,
  previewEmployeeInvite,
  signupWithEmployeeInvite,
  type EmployeeInvitePreview,
} from '@/features/settings/employee-invites-service';

const CLOSED_STATUS_MESSAGES: Record<string, string> = {
  REVOKED: 'أُلغيت هذه الدعوة. اطلب رابطًا جديدًا من مسؤول المكتب.',
  EXPIRED: 'انتهت صلاحية هذه الدعوة. اطلب رابطًا جديدًا من مسؤول المكتب.',
  ACCEPTED: 'استُخدمت هذه الدعوة بالفعل. سجّل الدخول بحسابك.',
};

function AuthCard({ title, description, children }: Readonly<{ title: string; description: string; children: React.ReactNode }>) {
  return (
    <main className="min-h-screen min-h-dvh w-full min-w-0 overflow-x-hidden bg-background px-4 py-8 sm:px-6" dir="rtl">
      <section className="safe-top-app safe-bottom-overlay mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[25rem] flex-col justify-center">
        <header className="mb-7 flex flex-col items-center text-center">
          <MalekBrand
            layout="vertical"
            className="gap-2.5"
            markClassName="size-14"
            wordmarkClassName="text-[1.75rem]"
            wordmarkVariant="brand-gradient"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </header>
        {children}
      </section>
    </main>
  );
}

export function InviteAcceptPage() {
  const { token } = useParams({ from: '/invite/$token' });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user, login } = useAuth();
  const [preview, setPreview] = useState<EmployeeInvitePreview | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'invalid' | 'error'>('loading');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreviewState('loading');
    previewEmployeeInvite(token)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setPreviewState('invalid');
          return;
        }
        setPreview(result);
        setPreviewState('ready');
      })
      .catch(() => {
        if (!cancelled) setPreviewState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signedInEmailMatches =
    isAuthenticated && preview
      ? (user?.email ?? '').toLowerCase() === preview.email.toLowerCase()
      : false;

  const acceptExistingAccount = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await acceptEmployeeInvite(token);
      await navigate({ to: '/dashboard', replace: true });
    } catch (acceptError) {
      setError(employeeInviteErrorMessage(acceptError, 'تعذر قبول الدعوة. حاول مرة أخرى.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNewAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    if (fullName.trim().length < 2) {
      setError('أدخل الاسم الكامل.');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    if (!preview) return;
    setIsSubmitting(true);
    const result = await signupWithEmployeeInvite({ token, fullName: fullName.trim(), password });
    if (!result.ok) {
      setIsSubmitting(false);
      setError(employeeInviteErrorMessage(result.code, 'تعذر إنشاء الحساب. حاول مرة أخرى.'));
      return;
    }
    try {
      await login(preview.email, password);
    } catch {
      setIsSubmitting(false);
      setError('أُنشئ حسابك وقُبلت الدعوة. سجّل الدخول الآن.');
      await navigate({ to: '/login', replace: true });
    }
  };

  if (previewState === 'loading' || authLoading) {
    return (
      <AuthCard title="دعوة موظف" description="جارٍ التحقق من رابط الدعوة...">
        <LoadingState variant="page" label="جارٍ التحقق من رابط الدعوة..." />
      </AuthCard>
    );
  }

  if (previewState === 'error') {
    return (
      <AuthCard title="تعذر التحقق من الدعوة" description="تحقق من الاتصال ثم أعد فتح الرابط.">
        <Button asChild variant="secondary" className="min-h-11 w-full"><Link to="/login">العودة إلى تسجيل الدخول</Link></Button>
      </AuthCard>
    );
  }

  if (previewState === 'invalid' || !preview) {
    return (
      <AuthCard title="رابط الدعوة غير صحيح" description="تأكد من نسخ الرابط كاملًا أو اطلب رابطًا جديدًا من مسؤول المكتب.">
        <Button asChild variant="secondary" className="min-h-11 w-full"><Link to="/login">العودة إلى تسجيل الدخول</Link></Button>
      </AuthCard>
    );
  }

  if (preview.invite_status !== 'PENDING') {
    return (
      <AuthCard title="هذه الدعوة لم تعد متاحة" description={CLOSED_STATUS_MESSAGES[preview.invite_status] ?? 'هذه الدعوة مغلقة.'}>
        <Button asChild variant="secondary" className="min-h-11 w-full"><Link to="/login">العودة إلى تسجيل الدخول</Link></Button>
      </AuthCard>
    );
  }

  const heading = `دعوة للانضمام إلى ${preview.company_name}`;
  const roleLabel = INVITABLE_ROLE_LABELS[preview.role] ?? preview.role;

  if (isAuthenticated && !signedInEmailMatches) {
    return (
      <AuthCard title={heading} description={`أنت مسجل دخول ببريد مختلف. سجّل الخروج ثم ادخل بالحساب المدعو (${preview.email}) أو أنشئ الحساب من جلسة غير مسجلة.`}>
        <Button asChild variant="secondary" className="min-h-11 w-full"><Link to="/login">العودة إلى تسجيل الدخول</Link></Button>
      </AuthCard>
    );
  }

  if (signedInEmailMatches) {
    return (
      <AuthCard title={heading} description={`ستنضم بصلاحية «${roleLabel}» إلى فريق العمل.`}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
            <span dir="ltr">{preview.email}</span>
          </div>
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
          <Button className="h-12 w-full" disabled={isSubmitting} aria-busy={isSubmitting} onClick={() => void acceptExistingAccount()}>
            <UserPlus className="size-4" />
            {isSubmitting ? 'جارٍ قبول الدعوة...' : 'قبول الدعوة والانضمام'}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={heading} description={`أنشئ حسابك للانضمام بصلاحية «${roleLabel}». إن كان لديك حساب بهذا البريد، سجّل الدخول أولًا.`}>
      <EntityForm.Root className="gap-4" onSubmit={submitNewAccount}>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          <span dir="ltr">{preview.email}</span>
        </div>
        <label htmlFor="invite-full-name" className="block text-sm font-semibold">الاسم الكامل</label>
        <Input id="invite-full-name" required autoFocus minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={isSubmitting} />
        <label htmlFor="invite-password" className="block text-sm font-semibold">كلمة المرور</label>
        <Input id="invite-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} />
        <label htmlFor="invite-password-confirm" className="block text-sm font-semibold">تأكيد كلمة المرور</label>
        <Input id="invite-password-confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isSubmitting} />
        {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
        <Button type="submit" className="h-12 w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب وقبول الدعوة'}
        </Button>
        <Button asChild variant="ghost" className="min-h-11 w-full"><Link to="/login"><ArrowLeft className="me-2 size-4 rtl:rotate-180" />لدي حساب بالفعل</Link></Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" />الرابط يعمل مرة واحدة فقط.</p>
      </EntityForm.Root>
    </AuthCard>
  );
}
