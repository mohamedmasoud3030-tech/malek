export type AuditLogRecord = Readonly<{
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
}>;

export type AuditLogResult =
  | Readonly<{
      status: 'available';
      records: readonly AuditLogRecord[];
      /** True when additional older events exist beyond this bounded page. */
      truncated?: boolean;
    }>
  | Readonly<{ status: 'unavailable'; reason: string }>;

