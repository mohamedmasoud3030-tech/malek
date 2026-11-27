import { supabase } from '@/lib/supabase';

/**
 * Employee invites — governed invite links for adding office staff.
 *
 * The office owner (effective users.manage authority) creates a single-use,
 * expiring link; the raw token is returned exactly once and only its SHA-256
 * hash is stored server-side. Acceptance runs either in-app (existing
 * account, signed in) or through the employee-invite-accept Edge Function
 * (new account). No invitation e-mail is sent; the owner passes the link to
 * the employee through any channel.
 */

export const INVITABLE_ROLES = ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const INVITABLE_ROLE_LABELS: Record<InvitableRole, string> = {
  MANAGER: 'مشرف',
  ACCOUNTANT: 'محاسب',
  OPERATIONS: 'عمليات',
  USER: 'موظف',
  VIEWER: 'مطالعة فقط',
};

export type EmployeeInviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export type EmployeeInviteRow = Readonly<{
  id: string;
  email: string;
  role: InvitableRole;
  note: string | null;
  created_at: string;
  expires_at: string;
  status: EmployeeInviteStatus;
}>;

export type EmployeeInvitePreview = Readonly<{
  company_name: string;
  email: string;
  role: InvitableRole;
  invite_status: EmployeeInviteStatus;
}>;

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error ?? '');
}

/** Maps governed invite failures to operator-facing Arabic messages. */
export function employeeInviteErrorMessage(error: unknown, fallback: string): string {
  const text = errorText(error);
  if (text.includes('EMPLOYEE_INVITE_FORBIDDEN')) return 'لا تملك صلاحية إدارة المستخدمين في هذه الشركة.';
  if (text.includes('AUTHENTICATION_REQUIRED')) return 'انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة.';
  if (text.includes('EMPLOYEE_INVITE_EMAIL_INVALID')) return 'البريد الإلكتروني غير صحيح.';
  if (text.includes('EMPLOYEE_INVITE_ROLE_INVALID')) return 'الدور المطلوب غير متاح للدعوات.';
  if (text.includes('EMPLOYEE_INVITE_ALREADY_MEMBER')) return 'هذا البريد مسجل بالفعل كعضو نشط في الشركة.';
  if (text.includes('EMPLOYEE_INVITE_IDEMPOTENCY_MISMATCH')) return 'مفتاح العملية استُخدم لبيانات مختلفة. حدّث الصفحة وأعد المحاولة.';
  if (text.includes('EMPLOYEE_INVITE_NOT_FOUND')) return 'رابط الدعوة غير صحيح أو لم تعد الدعوة موجودة.';
  if (text.includes('EMPLOYEE_INVITE_REVOKED') || text.includes('INVITE_REVOKED')) return 'أُلغيت هذه الدعوة. اطلب رابطًا جديدًا من مسؤول المكتب.';
  if (text.includes('EMPLOYEE_INVITE_EXPIRED') || text.includes('INVITE_EXPIRED')) return 'انتهت صلاحية هذه الدعوة. اطلب رابطًا جديدًا من مسؤول المكتب.';
  if (text.includes('EMPLOYEE_INVITE_ALREADY_USED') || text.includes('INVITE_ALREADY_USED')) return 'استُخدمت هذه الدعوة بالفعل من حساب آخر.';
  if (text.includes('EMPLOYEE_INVITE_EMAIL_MISMATCH')) return 'هذه الدعوة موجهة لبريد إلكتروني آخر. سجّل الدخول بالحساب المدعو.';
  if (text.includes('EMPLOYEE_INVITE_USER_ASSIGNED_ELSEWHERE')) return 'هذا الحساب مرتبط بشركة أخرى ولا يمكن ضمه هنا.';
  if (text.includes('EMAIL_ALREADY_REGISTERED')) return 'يوجد حساب بهذا البريد بالفعل. سجّل الدخول ثم افتح رابط الدعوة.';
  if (text.includes('PASSWORD_INVALID')) return 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.';
  if (text.includes('TOKEN_INVALID')) return 'رابط الدعوة غير صالح.';
  return fallback;
}

export async function createEmployeeInvite(input: {
  email: string;
  role: InvitableRole;
  note: string | null;
  idempotencyKey: string;
}): Promise<{ token: string } | { alreadyCreated: true }> {
  const { data, error } = await supabase.rpc('create_employee_invite', {
    p_email: input.email,
    p_role: input.role,
    p_note: input.note,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  if (!data) return { alreadyCreated: true };
  return { token: data };
}

export async function listEmployeeInvites(): Promise<EmployeeInviteRow[]> {
  const { data, error } = await supabase
    .from('employee_invites_read')
    .select('id, email, role, note, created_at, expires_at, status')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmployeeInviteRow[];
}

export async function revokeEmployeeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_employee_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

export async function previewEmployeeInvite(token: string): Promise<EmployeeInvitePreview | null> {
  const { data, error } = await supabase.rpc('preview_employee_invite', { p_token: token });
  if (error) throw error;
  const rows = (data ?? []) as EmployeeInvitePreview[];
  return rows[0] ?? null;
}

/** Existing account (signed in with the invited e-mail) accepts in-app. */
export async function acceptEmployeeInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_employee_invite', { p_token: token });
  if (error) throw error;
  return data;
}

export type EmployeeInviteSignupResult =
  | { ok: true; email: string }
  | { ok: false; code: string };

/** New account: the Edge Function creates it and applies the acceptance. */
export async function signupWithEmployeeInvite(input: {
  token: string;
  fullName: string;
  password: string;
}): Promise<EmployeeInviteSignupResult> {
  const { data, error } = await supabase.functions.invoke('employee-invite-accept', {
    body: { token: input.token, full_name: input.fullName, password: input.password },
  });
  if (error) {
    // FunctionsHttpError carries the Edge Function's JSON error body.
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    try {
      const body = (await context?.json?.()) as { error?: { code?: string } } | undefined;
      const code = body?.error?.code;
      if (code) return { ok: false, code };
    } catch {
      /* fall through to the generic message */
    }
    return { ok: false, code: errorText(error) };
  }
  const email =
    data && typeof data === 'object' && 'data' in data
      ? String((data as { data?: { email?: unknown } }).data?.email ?? '')
      : '';
  return { ok: true, email };
}
