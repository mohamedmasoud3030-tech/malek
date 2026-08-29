import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { AuditLogRecord, AuditLogResult } from '../types';
import type { Database } from '@/types/database';

type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
type AuditLogInputRow = Omit<AuditLogRow, 'new_value'> & {
  new_value?: AuditLogRow['new_value'] | null;
};

const AUDIT_LOG_COLUMNS =
  'id, ts, user_id, username, action, entity, entity_id, note, table, details, created_at, updated_at';
const AUDIT_LOG_LIMIT = 200;
const AUDIT_LOG_UNAVAILABLE_REASON =
  'تعذر تشغيل سجل التدقيق باستخدام إعدادات التشغيل الحالية دون افتراضات إضافية.';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const text = readString(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const d = new Date(Number(text));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? text : d.toISOString();
}

export function normalizeAuditRecords(rows: readonly AuditLogInputRow[]): readonly AuditLogRecord[] {
  return rows.map((row, index) => ({
    id: row.id ?? `audit-${index}`,
    occurredAt:
      readTimestamp(row.ts) ??
      readTimestamp(row.created_at) ??
      readTimestamp(row.updated_at) ??
      new Date(0).toISOString(),
    actor: readString(row.username) ?? readString(row.user_id) ?? 'غير محدد',
    action: readString(row.action) ?? 'غير محدد',
    entityType: readString(row.entity) ?? readString(row.table) ?? 'غير محدد',
    entityId: readString(row.entity_id),
    description: readString(row.note) ?? readString(row.details),
  }));
}

export async function fetchAuditLog(): Promise<AuditLogResult> {
  if (!env.isConfigured) {
    return { status: 'unavailable', reason: AUDIT_LOG_UNAVAILABLE_REASON };
  }

  const { data, error } = await supabase
    .from('audit_log')
    .select(AUDIT_LOG_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // Read one sentinel row so the UI never presents a bounded prefix as the
    // complete audit history.
    .limit(AUDIT_LOG_LIMIT + 1);

  if (error) throw error;

  const rows = (data ?? []) as AuditLogRow[];
  return {
    status: 'available',
    records: normalizeAuditRecords(rows.slice(0, AUDIT_LOG_LIMIT)),
    truncated: rows.length > AUDIT_LOG_LIMIT,
  };
}
