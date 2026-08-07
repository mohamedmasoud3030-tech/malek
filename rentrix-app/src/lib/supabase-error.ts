type SupabaseLikeError = Readonly<{
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}>;

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  return typeof error === 'object' && error !== null;
}

function errorPart(error: unknown, key: keyof SupabaseLikeError): string {
  if (!isSupabaseLikeError(error)) return '';
  const value = error[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return errorPart(error, 'message');
}

function getErrorText(error: unknown): string {
  return [
    getErrorMessage(error),
    errorPart(error, 'code'),
    errorPart(error, 'details'),
    errorPart(error, 'hint'),
  ].filter(Boolean).join(' ');
}

function containsArabic(value: string) {
  return /[\u0600-\u06ff]/u.test(value);
}

function withContext(fallbackMessage: string, detail: string) {
  return `${fallbackMessage}: ${detail}`;
}

/**
 * Converts infrastructure/database errors into short user-facing Arabic while
 * preserving already-actionable Arabic domain messages emitted by trusted RPCs.
 * Raw PostgreSQL/PostgREST internals (RLS, SQLSTATE, schema-cache wording, etc.)
 * must never be the primary UI error copy.
 */
export function getActionableSupabaseErrorMessage(error: unknown, fallbackMessage = 'تعذر إكمال العملية') {
  const message = getErrorMessage(error);
  const errorText = getErrorText(error);
  const normalized = errorText.toLowerCase();
  const code = errorPart(error, 'code').toUpperCase();

  // Deterministic business conflicts added by the financial safety RPCs.
  if (normalized.includes('owner_settlement_stale_totals')) {
    return 'تغيّرت بيانات التسوية منذ إنشاء المسودة. ألغِ المسودة وأنشئ تسوية جديدة بالقيم الحالية.';
  }
  if (normalized.includes('owner_settlement_input_set_drift')) {
    return 'تغيّرت الحركات المرتبطة بالتسوية. ألغِ المسودة وأنشئ تسوية جديدة قبل الاعتماد أو الصرف.';
  }
  if (normalized.includes('idempotency_key_reused_for_different_request')) {
    return withContext(fallbackMessage, 'تعذر إعادة نفس الطلب بعد تغيّر البيانات. أغلق النموذج وافتحه من جديد ثم حاول مرة أخرى.');
  }

  // A missing company claim is more actionable than a generic permission error
  // and is a common cause of a form opening successfully but a trusted RPC being
  // rejected at submit time.
  if (
    normalized.includes('company context is required')
    || normalized.includes('company_id claim')
    || normalized.includes('company context')
    || normalized.includes('current_company_id')
  ) {
    return withContext(fallbackMessage, 'تعذر التحقق من الشركة الحالية. حدّث الصفحة، وإن استمرت المشكلة سجّل الدخول من جديد.');
  }

  if (
    normalized.includes('jwt expired')
    || normalized.includes('invalid jwt')
    || normalized.includes('auth session missing')
    || normalized.includes('session not found')
    || normalized.includes('refresh token')
    || code === 'PGRST301'
    || code === 'PGRST302'
  ) {
    return withContext(fallbackMessage, 'انتهت الجلسة أو تعذر التحقق منها. سجّل الدخول من جديد ثم أعد المحاولة.');
  }

  // Preserve precise Arabic validation/business messages from the server before
  // applying broad SQLSTATE mappings. They are already the best user guidance.
  if (message && containsArabic(message)) return message;

  if (
    normalized.includes('permission denied')
    || normalized.includes('row-level security')
    || normalized.includes('rls')
    || normalized.includes('42501')
    || normalized.includes('unauthorized')
    || normalized.includes('not authorized')
    || normalized.includes('authenticated app user is required')
    || code === '42501'
  ) {
    return withContext(fallbackMessage, 'حسابك لا يملك الصلاحية المطلوبة لهذه العملية. تأكد من الحساب الحالي ثم حاول مرة أخرى.');
  }

  if (
    normalized.includes('failed to fetch')
    || normalized.includes('network request failed')
    || normalized.includes('networkerror')
    || normalized.includes('load failed')
  ) {
    return withContext(fallbackMessage, 'تعذر الاتصال بالخدمة. تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى.');
  }

  if (
    code === 'PGRST202'
    || normalized.includes('could not find the function')
    || normalized.includes('schema cache')
  ) {
    return withContext(fallbackMessage, 'الخدمة المطلوبة غير متاحة في النسخة الحالية. حدّث التطبيق ثم أعد المحاولة.');
  }

  if (code === '23505') {
    return withContext(fallbackMessage, 'يوجد سجل مطابق بالفعل. راجع البيانات قبل إنشاء سجل جديد.');
  }
  if (code === '23503') {
    return withContext(fallbackMessage, 'تعذر إتمام العملية لأن السجل مرتبط ببيانات أخرى.');
  }
  if (code === '23502') {
    return withContext(fallbackMessage, 'بعض البيانات المطلوبة غير مكتملة. راجع الحقول ثم أعد المحاولة.');
  }
  if (code === '22P02') {
    return withContext(fallbackMessage, 'إحدى القيم المدخلة غير صالحة. راجع البيانات ثم أعد المحاولة.');
  }

  // Do not leak opaque English SQL/PostgREST internals into the Arabic UI.
  return fallbackMessage;
}

export function handleSupabaseError(error: unknown, fallbackMessage = 'تعذر إكمال العملية') {
  if (!error) return;
  throw new Error(getActionableSupabaseErrorMessage(error, fallbackMessage));
}
