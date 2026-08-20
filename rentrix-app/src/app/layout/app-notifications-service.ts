import { supabase } from '@/lib/supabase';

export type AppNotification = Readonly<{
  id: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  type: string | null;
}>;

const sensitivePreviewPattern = /password|token|secret|authorization\s*:|[^\s@]+@[^\s@]+\.[^\s@]+|(?:\d[\s-]*){8,}/i;
const identifierInUrlPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|@/i;
const allowedLinkPrefixes = ['/dashboard', '/settings', '/contracts', '/financials', '/maintenance', '/reports', '/help'];

export function sanitizeNotificationPreview(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || sensitivePreviewPattern.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

export function sanitizeNotificationLink(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || identifierInUrlPattern.test(value)) {
    return '/dashboard';
  }
  return allowedLinkPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}?`)) ? value : '/dashboard';
}

export async function listAppNotifications(): Promise<AppNotification[]> {
  const { data, error } = await (supabase as any)
    .from('app_notifications')
    .select('id,title,message,link,is_read,created_at,type')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: sanitizeNotificationPreview(row.title, 'إشعار', 120),
    message: sanitizeNotificationPreview(row.message, 'يوجد تحديث يحتاج مراجعة داخل MALEK.', 240),
    link: sanitizeNotificationLink(row.link),
    isRead: Boolean(row.is_read),
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    type: typeof row.type === 'string' ? row.type : null,
  }));
}

export async function markAppNotificationRead(id: string) {
  if (!id.trim() || id.length > 200) throw new Error('معرف الإشعار غير صالح.');
  const { error } = await (supabase as any).from('app_notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}
