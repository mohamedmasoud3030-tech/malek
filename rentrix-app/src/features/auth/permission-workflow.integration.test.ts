import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '@/p1/replay-bootstrap';

const COMPANY_A = '91000000-0000-4000-8000-00000000000a';
const COMPANY_B = '91000000-0000-4000-8000-00000000000b';
const ADMIN_A = '91000000-0000-4000-8000-000000000001';
const MANAGER_A = '91000000-0000-4000-8000-000000000002';
const USER_A = '91000000-0000-4000-8000-000000000003';
const USER_A2 = '91000000-0000-4000-8000-000000000004';
const MANAGER_B = '91000000-0000-4000-8000-000000000005';
const REVIEWER_A = '91000000-0000-4000-8000-000000000006';

let db: PGlite;

async function assume(userId: string, companyId: string) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated', app_metadata: { company_id: companyId } });
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`);
}

async function reset() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);
}

async function request(permission: string, route: string, reason = 'حاجة تشغيلية') {
  const { rows } = await db.query<{ id: string }>(
    'select (public.request_permission($1,$2,$3)).id::text as id',
    [permission, route, reason],
  );
  return rows[0].id;
}

async function decide(id: string, decision: 'APPROVED' | 'REJECTED', reason: string) {
  return db.query('select (public.decide_permission_request($1::uuid,$2,$3)).status as status', [id, decision, reason]);
}

async function errorOf(operation: () => Promise<unknown>) {
  try { await operation(); } catch (error) { return String((error as { message?: string }).message ?? error); }
  throw new Error('Expected operation to fail');
}

beforeAll(async () => {
  // Full canonical replay: `throughMigration: '20260810113000'` pointed at a
  // pre-squash historical migration that no longer exists in supabase/migrations
  // (the chain was replaced by the canonical baseline). Worse, any
  // `throughMigration` option disables the canonical reference seed, so the
  // app_permission_catalog stayed empty and every request_permission call
  // raised 'Unknown permission'. Replay the canonical chain and let the harness
  // apply seed.sql (permission catalog + tax codes), exactly like `supabase db
  // reset` would.
  const replay = await createFullReplayedDatabase();
  db = replay.db;
  expect(replay.failed, JSON.stringify(replay.failed.slice(-5))).toEqual([]);

  await db.query(`insert into public.companies(id,name,slug) values
    ($1,'Permission A','permission-a'),($2,'Permission B','permission-b') on conflict(id) do nothing`, [COMPANY_A, COMPANY_B]);
  const users = [
    [ADMIN_A, 'admin-a@test.invalid', 'Admin A', 'ADMIN'],
    [MANAGER_A, 'manager-a@test.invalid', 'Manager A', 'MANAGER'],
    [USER_A, 'user-a@test.invalid', 'User A', 'USER'],
    [USER_A2, 'user-a2@test.invalid', 'User A2', 'USER'],
    [MANAGER_B, 'manager-b@test.invalid', 'Manager B', 'MANAGER'],
    [REVIEWER_A, 'reviewer-a@test.invalid', 'Reviewer A', 'USER'],
  ] as const;
  for (const [id, email, name, role] of users) {
    await db.query(`insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{}') on conflict(id) do nothing`, [id, email]);
    await db.query(`insert into public.users(id,email,name,full_name,role,status,is_active) values($1,$2,$3,$3,$4,'ACTIVE',true)
      on conflict(id) do update set role=excluded.role,status='ACTIVE',is_active=true`, [id, email, name, role]);
  }
  // company_members.role is the SOLE operational role authority (canonical
  // governance, migrations 00009/00012): seeding everyone as ADMIN made every
  // scenario actor resolve as ADMIN, so USER_A was already granted every
  // permission and the whole request/decide workflow short-circuited. Mirror
  // the intended users.role in company_members.role.
  const memberships: Array<[string, string, string]> = [
    [COMPANY_A, ADMIN_A, 'ADMIN'],
    [COMPANY_A, MANAGER_A, 'MANAGER'],
    [COMPANY_A, USER_A, 'USER'],
    [COMPANY_A, USER_A2, 'USER'],
    [COMPANY_A, REVIEWER_A, 'USER'],
    [COMPANY_B, MANAGER_B, 'MANAGER'],
  ];
  for (const [companyId, userId, role] of memberships) {
    await db.query(`insert into public.company_members(company_id,user_id,role) values($1,$2,$3)
      on conflict(company_id,user_id) do update set role=excluded.role,is_active=true`, [companyId, userId, role]);
  }
});

describe('P6.1 permission workflow — database behavior', () => {
  let landsRequestId = '';
  let adminRequestId = '';

  it('rejects unknown/already-granted permissions and direct table writes', async () => {
    await assume(USER_A, COMPANY_A);
    expect(await errorOf(() => request('made.up.permission', '/lands'))).toMatch(/not requestable|unknown/i);
    expect(await errorOf(() => request('app.dashboard.view', '/dashboard'))).toMatch(/already granted/i);
    expect(await errorOf(() => db.query(`insert into public.permission_requests(company_id,requester_user_id,permission) values($1,$2,'lands.view')`, [COMPANY_A, USER_A]))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query(`insert into public.user_permission_grants(company_id,user_id,permission,granted_by) values($1,$2,'lands.view',$2)`, [COMPANY_A, USER_A]))).toMatch(/permission denied/i);
    await reset();
  });

  it('is idempotent by company + requester + permission + resource and emits exactly once', async () => {
    await assume(USER_A, COMPANY_A);
    landsRequestId = await request('lands.view', '/lands');
    expect(await request('lands.view', '/lands', 'محاولة ثانية')).toBe(landsRequestId);
    await reset();
    const audit = await db.query<{ count: number }>(`select count(*)::int as count from public.audit_log where action='PERMISSION_REQUESTED' and entity_id=$1`, [landsRequestId]);
    const notifications = await db.query<{ count: number }>(`select count(*)::int as count from public.app_notifications where source_id=$1::uuid and notification_type='permission_request'`, [landsRequestId]);
    expect(audit.rows[0].count).toBe(1);
    expect(notifications.rows[0].count).toBe(2); // one independent notification per ADMIN/MANAGER reviewer
  });

  it('prevents self-review, cross-company review, and manager admin escalation', async () => {
    await assume(MANAGER_A, COMPANY_A);
    const selfRequest = await request('system.view', '/settings?section=system-settings');
    expect(await errorOf(() => decide(selfRequest, 'APPROVED', 'self'))).toMatch(/own request/i);
    await assume(USER_A2, COMPANY_A);
    adminRequestId = await request('system.view', '/settings?section=system-settings');
    await assume(MANAGER_B, COMPANY_B);
    expect(await errorOf(() => decide(adminRequestId, 'APPROVED', 'cross company'))).toMatch(/not found/i);
    await assume(MANAGER_A, COMPANY_A);
    expect(await errorOf(() => decide(adminRequestId, 'APPROVED', 'تصعيد'))).toMatch(/admin-only/i);
  });

  it('approves once, activates the effective grant, and safely revokes it', async () => {
    await assume(MANAGER_A, COMPANY_A);
    await decide(landsRequestId, 'APPROVED', 'تم التحقق من الحاجة');
    await decide(landsRequestId, 'APPROVED', 'إعادة آمنة');
    await reset();
    const grants = await db.query<{ count: number }>(`select count(*)::int as count from public.user_permission_grants where company_id=$1 and user_id=$2 and permission='lands.view' and revoked_at is null`, [COMPANY_A, USER_A]);
    const audits = await db.query<{ count: number }>(`select count(*)::int as count from public.audit_log where action='PERMISSION_APPROVED' and entity_id=$1`, [landsRequestId]);
    const decisions = await db.query<{ count: number }>(`select count(*)::int as count from public.app_notifications where source_id=$1::uuid and notification_type='permission_decision'`, [landsRequestId]);
    expect(grants.rows[0].count).toBe(1);
    expect(audits.rows[0].count).toBe(1);
    expect(decisions.rows[0].count).toBe(1);

    await assume(USER_A, COMPANY_A);
    expect(await errorOf(() => request('lands.view', '/lands'))).toMatch(/already granted/i);
    const ownDecision = await db.query<{ id: string; is_read: boolean }>(`select id,is_read from public.app_notifications where source_id=$1::uuid and notification_type='permission_decision'`, [landsRequestId]);
    expect(ownDecision.rows).toHaveLength(1);
    expect(ownDecision.rows[0].is_read).toBe(false);
    await db.query(`update public.app_notifications set is_read=true where id=$1`, [ownDecision.rows[0].id]);
    const readBack = await db.query<{ is_read: boolean }>(`select is_read from public.app_notifications where id=$1`, [ownDecision.rows[0].id]);
    expect(readBack.rows[0].is_read).toBe(true);
    await assume(MANAGER_A, COMPANY_A);
    const revoked = await db.query<{ result: { revoked: boolean } }>(`select public.revoke_permission_grant($1::uuid,'lands.view','انتهاء الحاجة') as result`, [USER_A]);
    expect(revoked.rows[0].result.revoked).toBe(true);
    const retry = await db.query<{ result: { revoked: boolean } }>(`select public.revoke_permission_grant($1::uuid,'lands.view','إعادة') as result`, [USER_A]);
    expect(retry.rows[0].result.revoked).toBe(false);

    await assume(USER_A, COMPANY_A);
    const rerequestId = await request('lands.view', '/lands', 'الحاجة عادت');
    expect(rerequestId).not.toBe(landsRequestId);
    await reset();
    const lifecycle = await db.query<{ approved_history: number; active_grants: number }>(`
      select
        (select count(*)::int from public.permission_requests where id=$1::uuid and status='APPROVED') as approved_history,
        (select count(*)::int from public.user_permission_grants where company_id=$2::uuid and user_id=$3::uuid and permission='lands.view' and revoked_at is null) as active_grants`, [landsRequestId, COMPANY_A, USER_A]);
    expect(lifecycle.rows[0]).toEqual({ approved_history: 1, active_grants: 0 });
  });

  it('allows a delegated reviewer to review but rejects grant/revoke outside its authority', async () => {
    await db.query(`insert into public.user_permission_grants(company_id,user_id,permission,granted_by)
      values($1,$2,'permission_requests.review',$3)
      on conflict(company_id,user_id,permission) do update set revoked_at=null`, [COMPANY_A, REVIEWER_A, ADMIN_A]);
    await assume(USER_A2, COMPANY_A);
    const requestId = await request('lands.view', '/lands', 'طلب يحتاج مراجع');
    await assume(REVIEWER_A, COMPANY_A);
    expect(await errorOf(() => decide(requestId, 'APPROVED', 'محاولة خارج النطاق'))).toMatch(/cannot grant/i);
    expect(await errorOf(() => db.query(`select public.revoke_permission_grant($1::uuid,'lands.view','محاولة خارج النطاق')`, [USER_A]))).toMatch(/cannot revoke/i);
  });

  it('requires a rejection reason and records one decision only', async () => {
    await assume(ADMIN_A, COMPANY_A);
    expect(await errorOf(() => decide(adminRequestId, 'REJECTED', ''))).toMatch(/reason is required/i);
    await decide(adminRequestId, 'REJECTED', 'غير مناسب لطبيعة الدور');
    await decide(adminRequestId, 'REJECTED', 'إعادة آمنة');
    await reset();
    const result = await db.query<{ decision_reason: string; audit_count: number }>(`select pr.decision_reason,
      (select count(*)::int from public.audit_log a where a.action='PERMISSION_REJECTED' and a.entity_id=pr.id::text) audit_count
      from public.permission_requests pr where pr.id=$1`, [adminRequestId]);
    expect(result.rows[0]).toEqual({ decision_reason: 'غير مناسب لطبيعة الدور', audit_count: 1 });
  });

  it('keeps request and notification reads company isolated', async () => {
    await assume(MANAGER_B, COMPANY_B);
    const requests = await db.query<{ count: number }>('select count(*)::int as count from public.permission_requests where id=$1', [landsRequestId]);
    const notifications = await db.query<{ count: number }>('select count(*)::int as count from public.app_notifications where source_id=$1::uuid', [landsRequestId]);
    expect(requests.rows[0].count).toBe(0);
    expect(notifications.rows[0].count).toBe(0);
    await reset();
  });
});
