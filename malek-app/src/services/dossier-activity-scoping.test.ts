import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuditLogRecord } from '@/features/audit/types';

vi.mock('@/features/audit/services/audit-log-service', () => ({
  fetchAuditLog: vi.fn(),
}));

const { fetchAuditLog } = await import('@/features/audit/services/audit-log-service');
const mockedFetchAuditLog = vi.mocked(fetchAuditLog);

const { fetchOwnerActivity, isOwnerAuditRecord } = await import('./owner-workspace-service');
const { fetchPropertyActivity } = await import('./property-workspace-service');

function auditRecord(overrides: Partial<AuditLogRecord>): AuditLogRecord {
  return {
    id: 'audit-1',
    occurredAt: '2026-08-01T00:00:00.000Z',
    actor: 'مدير',
    action: 'UPDATE',
    entityType: 'owners',
    entityId: 'owner-A',
    description: 'تعديل',
    ...overrides,
  };
}

beforeEach(() => {
  mockedFetchAuditLog.mockReset();
});

describe('dossier activity scoping (closeout hardening)', () => {
  it('owner A dossier receives only owner A records, never owner B or generic owner rows', async () => {
    mockedFetchAuditLog.mockResolvedValue({
      status: 'available',
      records: [
        auditRecord({ id: 'a1', entityId: 'owner-A', entityType: 'owners', action: 'UPDATE' }),
        auditRecord({ id: 'a2', entityId: 'owner-A', entityType: 'owner', action: 'CREATE' }), // legacy singular variant
        auditRecord({ id: 'b1', entityId: 'owner-B', entityType: 'owners', action: 'UPDATE' }), // other owner — must NOT leak
        auditRecord({ id: 'any-owner', entityId: 'owner-C', entityType: 'owners' }), // other owner — must NOT leak
        auditRecord({ id: 'unscoped', entityId: null, entityType: 'owners' }), // generic type match without id — must NOT leak
        auditRecord({ id: 'prop', entityId: 'owner-A', entityType: 'properties' }), // right id, wrong type — must NOT leak
      ],
    });

    const activity = await fetchOwnerActivity('owner-A');
    expect(activity.map((record) => record.id).sort()).toEqual(['a1', 'a2']);
  });

  it('property A dossier receives only property A records, never property B or generic property rows', async () => {
    mockedFetchAuditLog.mockResolvedValue({
      status: 'available',
      records: [
        auditRecord({ id: 'p1', entityId: 'property-A', entityType: 'properties', action: 'UPDATE' }),
        auditRecord({ id: 'p2', entityId: 'property-A', entityType: 'property', action: 'CREATE' }), // legacy singular variant
        auditRecord({ id: 'pB', entityId: 'property-B', entityType: 'properties', action: 'UPDATE' }), // other property — must NOT leak
        auditRecord({ id: 'generic', entityId: null, entityType: 'properties' }), // type-only — must NOT leak
        auditRecord({ id: 'owner-row', entityId: 'property-A', entityType: 'owners' }), // right id, wrong type — must NOT leak
      ],
    });

    const activity = await fetchPropertyActivity('property-A');
    expect(activity.map((record) => record.id).sort()).toEqual(['p1', 'p2']);
  });

  it('returns an empty dossier activity when the audit source is unavailable', async () => {
    mockedFetchAuditLog.mockResolvedValue({ status: 'unavailable', reason: 'not configured' });
    expect(await fetchOwnerActivity('owner-A')).toEqual([]);
    expect(await fetchPropertyActivity('property-A')).toEqual([]);
  });

  it('keeps the exported scoping predicate pure and entity-id-first', () => {
    expect(isOwnerAuditRecord(auditRecord({ entityId: 'owner-A' }), 'owner-A')).toBe(true);
    expect(isOwnerAuditRecord(auditRecord({ entityId: 'owner-A', entityType: 'owner' }), 'owner-A')).toBe(true);
    expect(isOwnerAuditRecord(auditRecord({ entityId: 'owner-B' }), 'owner-A')).toBe(false);
    expect(isOwnerAuditRecord(auditRecord({ entityId: null, entityType: 'owners' }), 'owner-A')).toBe(false);
    expect(isOwnerAuditRecord(auditRecord({ entityId: 'owner-A', entityType: 'properties' }), 'owner-A')).toBe(false);
  });
});
