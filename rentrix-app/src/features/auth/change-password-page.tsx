import { useState, type FormEvent } from 'react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { updateCurrentUserPassword } from './change-password-service';

const MIN_PASSWORD_LENGTH = 8;

export type ChangePasswordFormState = Readonly<{
  password: string;
  confirmPassword: string;
}>;

export function validateChangePasswordForm(form: ChangePasswordFormState): string | null {
  if (form.password.length < MIN_PASSWORD_LENGTH) return 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.';
  if (form.password !== form.confirmPassword) return 'تأكيد كلمة المرور غير مطابق.';
  return null;
}

export type ChangePasswordWorkspaceVariant = 'standalone' | 'embedded';
type ChangePasswordWorkspaceProps = Readonly<{ variant?: ChangePasswordWorkspaceVariant }>;

export function ChangePasswordWorkspace({ variant = 'standalone' }: ChangePasswordWorkspaceProps = {}) {
  const [form, setForm] = useState<ChangePasswordFormState>({ password: '', confirmPassword: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<unknown>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSucceeded(false);
    setServiceError(null);
    const nextValidationError = validateChangePasswordForm(form);
    setValidationError(nextValidationError);
    if (nextValidationError) return;

    setIsSubmitting(true);
    const result = await updateCurrentUserPassword(supabase, form.password);
    setIsSubmitting(false);
    if (!result.ok) {
      setServiceError(result.error);
      return;
    }
    setForm({ password: '', confirmPassword: '' });
    setSucceeded(true);
  };

  const body = (
    <div className="space-y-4">
      <EntityForm.Root onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <EntityForm.Section title="بيانات كلمة المرور الجديدة" description="استخدم كلمة مرور لا تقل عن 8 أحرف ثم أكدها قبل الحفظ.">
          <EntityForm.ErrorSummary message={validationError ?? undefined} />
          <EntityForm.Field label="كلمة المرور الجديدة *" error={validationError && form.password.length < MIN_PASSWORD_LENGTH ? validationError : undefined}>
            <Input
              required
              minLength={MIN_PASSWORD_LENGTH}
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(validationError)}
              value={form.password}
              onChange={(event) => {
                setForm((current) => ({ ...current, password: event.target.value }));
                setValidationError(null);
              }}
            />
          </EntityForm.Field>
          <EntityForm.Field label="تأكيد كلمة المرور *" error={validationError && form.password !== form.confirmPassword ? validationError : undefined}>
            <Input
              required
              minLength={MIN_PASSWORD_LENGTH}
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(validationError)}
              value={form.confirmPassword}
              onChange={(event) => {
                setForm((current) => ({ ...current, confirmPassword: event.target.value }));
                setValidationError(null);
              }}
            />
          </EntityForm.Field>
          {succeeded ? (
            <output className="block rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-success" aria-live="polite">تم تحديث كلمة المرور بنجاح.</output>
          ) : null}
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ الحفظ...' : 'تحديث كلمة المرور'}
          isSubmitting={isSubmitting}
          submitDisabled={!form.password || !form.confirmPassword}
        />
      </EntityForm.Root>
      {serviceError ? <DataErrorScreen title="تعذر تحديث كلمة المرور" fallbackMessage="تحقق من الجلسة الحالية وحاول مرة أخرى." error={serviceError} /> : null}
    </div>
  );

  if (variant === 'embedded') return <div className="max-w-3xl space-y-4">{body}</div>;

  return (
    <PageLayout dir="rtl" lang="ar" contentClassName="w-full min-w-0 max-w-3xl" visualVariant="malek-pro">
      <PageHeader title="تغيير كلمة المرور" description="حدّث كلمة مرور حسابك الحالي بأمان دون التأثير على أي حسابات أخرى." />
      {body}
    </PageLayout>
  );
}

export function ChangePasswordPage() {
  return <ChangePasswordWorkspace variant="standalone" />;
}