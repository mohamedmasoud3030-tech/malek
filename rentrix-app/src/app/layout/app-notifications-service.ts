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

export async function listAppNotifications(): Promise<AppNotification[]> {
  const { data, error } = await (supabase as any)
    .from('app_notifications')
    .select('id,title,message,link,is_read,created_at,type')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title || 'إشعار',
    message: row.message || '',
    link: row.link || '/dashboard',
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || '',
    type: row.type ?? null,
  }));
}

export async function markAppNotificationRead(id: string) {
  const { error } = await (supabase as any).from('app_notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}
