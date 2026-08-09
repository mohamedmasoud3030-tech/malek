import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canAccess, getAuthorizationContextFromUser } from './permissions';

describe('P3 permission request workflow contract', () => {
  it('lets managers review governance access while users remain restricted', () => {
    const manager = getAuthorizationContextFromUser({ id: 'manager', email: 'manager@example.com', app_metadata: { user_role: 'MANAGER' } });
    const user = getAuthorizationContextFromUser({ id: 'user', email: 'user@example.com', app_metadata: { user_role: 'USER' } });
    expect(canAccess(manager, 'system.view')).toBe(true);
    expect(canAccess(user, 'system.view')).toBe(false);
  });

  it('defines request, decision, grant, notification, and audit persistence in one migration', () => {
    const migration = readFileSync(resolve(import.meta.dirname, '../../../../supabase/migrations/20260809030000_permission_request_workflow.sql'), 'utf8');
    for (const token of ['permission_requests', 'user_permission_grants', 'request_permission', 'decide_permission_request', 'app_notifications', 'PERMISSION_REQUESTED', "'PERMISSION_' || result.status", 'audit_log']) expect(migration).toContain(token);
  });
});
