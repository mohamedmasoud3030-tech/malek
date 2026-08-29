import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_BRAND_LOCKUP_ASSET, APP_BRAND_NAME } from '@/lib/brand';
import { supabase } from '@/lib/supabase';
import { updateCurrentUserPassword } from './change-password-service';
import { validateChangePasswordForm } from './change-password-page';
import { buildPasswordRecoveryRedirect, requestPasswordRecovery } from './password-recovery-service';

function AuthCard({ title, description, children }: Readonly<{ title: string; description: string; children: React.ReactNode }>) {
  return (
    <main className="min-h-screen min-h-dvh w-full min-w-0 overflow-x-hidden bg-background px-4 py-8 sm:px-6" dir="rtl">
      <section className="safe-top-app safe-bottom-overlay mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[25rem] flex-col justify-center">
        <header className="mb-7 text-center">
          <img src={APP_BRAND_LOCKUP_ASSET} alt={APP_BRAND_NAME} className="mx-auto size-16 object-contain" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </header>
        {children}
      </section>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    const result = await requestPasswordRecovery(
      supabase,
      email.trim(),
      buildPasswordRecoveryRedirect(window.location.origin),
    );
    setIsSubmitting(false);
    if (!result.ok) {
      setError('تعذر إرسال رابط الاستعادة الآن. تحقق من الاتصال ثم حاول مرة أخرى.');
      return;
    }
    setSucceeded(true);
  };

  return (
    <AuthCard title="استعادة كلمة المرور" description="أدخل بريد حسابك وسنرسل رابطاً محدود المدة لتعيين كلمة مرور جديدة.">
      {succeeded ? (
        <div className="space-y-4 rounded-2xl border border-success/30 bg-success/5 p-5 text-center" role="status" aria-live="polite">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" />
          <p className="font-bold">راجع بريدك الإلكتروني</p>
          <p className="text-sm leading-6 text-muted-foreground">إذا كان البريد مرتبطاً بحساب، ستصلك رسالة الاستعادة. افحص الرسائل غير المرغوب فيها أيضاً.</p>
          <Button asChild variant="secondary" className="min-h-11 w-full"><Link to="/login">العودة إلى تسجيل الدخول</Link></Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label htmlFor="recovery-email" className="block text-sm font-semibold">البريد الإلكتروني</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
            <Input id="recovery-email" type="email" dir="ltr" inputMode="email" autoComplete="email" required autoFocus className="h-12 pe-10" value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} disabled={isSubmitting} />
          </div>
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
          <Button type="submit" className="h-12 w-full" disabled={isSubmitting || email.trim() === ''} aria-busy={isSubmitting}>{isSubmitting ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}</Button>
          <Button asChild variant="ghost" className="min-h-11 w-full"><Link to="/login"><ArrowLeft className="me-2 size-4 rtl:rotate-180" />العودة إلى تسجيل الدخول</Link></Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [sessionCheckError, setSessionCheckError] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const checkRecoverySession = useCallback(async () => {
    setChecking(true);
    setSessionCheckError(false);
    try {
      const { data } = await supabase.auth.getSession();
      setHasRecoverySession(Boolean(data.session));
    } catch {
      // A connectivity failure is not evidence that a recovery link expired.
      setSessionCheckError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkRecoverySession();
  }, [checkRecoverySession]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateChangePasswordForm({ password, confirmPassword });
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await updateCurrentUserPassword(supabase, password);
    if (!result.ok) {
      setIsSubmitting(false);
      setError('تعذر تحديث كلمة المرور. قد يكون الرابط منتهياً؛ اطلب رابط استعادة جديداً.');
      return;
    }
    await supabase.auth.signOut().catch(() => undefined);
    setIsSubmitting(false);
    setSucceeded(true);
  };

  return (
    <AuthCard title="تعيين كلمة مرور جديدة" description="استخدم 8 أحرف على الأقل، ثم سجّل الدخول مجدداً بكلمة المرور الجديدة.">
      {checking ? <p className="text-center text-sm text-muted-foreground" role="status">جارٍ التحقق من رابط الاستعادة...</p> : sessionCheckError ? (
        <div className="space-y-4 rounded-2xl border border-warning/30 bg-warning/5 p-5 text-center" role="alert">
          <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden="true" />
          <p className="font-bold">تعذر التحقق من رابط الاستعادة</p>
          <p className="text-sm leading-6 text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة. لم نعتبر الرابط منتهيًا بسبب فشل الشبكة.</p>
          <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={() => { void checkRecoverySession(); }}>إعادة المحاولة</Button>
        </div>
      ) : succeeded ? (
        <div className="space-y-4 rounded-2xl border border-success/30 bg-success/5 p-5 text-center" role="status" aria-live="polite">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" />
          <p className="font-bold">تم تحديث كلمة المرور</p>
          <Button asChild className="min-h-11 w-full"><Link to="/login">تسجيل الدخول</Link></Button>
        </div>
      ) : !hasRecoverySession ? (
        <div className="space-y-4 rounded-2xl border border-warning/30 bg-warning/5 p-5 text-center" role="alert">
          <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden="true" />
          <p className="font-bold">رابط الاستعادة غير صالح أو منتهي</p>
          <Button asChild className="min-h-11 w-full"><Link to="/forgot-password">طلب رابط جديد</Link></Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label htmlFor="new-password" className="block text-sm font-semibold">كلمة المرور الجديدة</label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required autoFocus className="h-12" value={password} onChange={(event) => { setPassword(event.target.value); setError(null); }} disabled={isSubmitting} />
          <label htmlFor="confirm-new-password" className="block text-sm font-semibold">تأكيد كلمة المرور</label>
          <Input id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} required className="h-12" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(null); }} disabled={isSubmitting} />
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
          <Button type="submit" className="h-12 w-full" disabled={isSubmitting || !password || !confirmPassword} aria-busy={isSubmitting}>{isSubmitting ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}</Button>
        </form>
      )}
    </AuthCard>
  );
}
