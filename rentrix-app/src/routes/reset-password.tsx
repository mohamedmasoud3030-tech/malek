import { AppProviders } from '@/app/providers/app-providers';
import { ResetPasswordPage } from '@/features/auth/password-recovery-page';

export function ResetPasswordRouteComponent() {
  return <AppProviders><ResetPasswordPage /></AppProviders>;
}
