const INVALID_CREDENTIALS_MESSAGE = 'تعذر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور ثم حاول مرة أخرى.';
const EMAIL_NOT_CONFIRMED_MESSAGE = 'لم يتم تأكيد البريد الإلكتروني بعد. راجع بريدك الإلكتروني ثم حاول مرة أخرى.';
const GENERIC_LOGIN_ERROR_MESSAGE = 'تعذر تسجيل الدخول حاليًا. حاول مرة أخرى.';

/** Maps provider failures to safe, Arabic user-facing login messages. */
export function getLoginErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim().toLowerCase() : '';

  if (message.includes('invalid login credentials') || message.includes('invalid_grant')) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (message.includes('email not confirmed')) {
    return EMAIL_NOT_CONFIRMED_MESSAGE;
  }

  return GENERIC_LOGIN_ERROR_MESSAGE;
}
