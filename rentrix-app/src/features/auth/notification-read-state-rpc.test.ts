/**
 * mark_app_notification_read — governed read-state RPC security contract.
 *
 * The ACL lockdown revoked direct UPDATE on app_notifications from
 * authenticated (migration 00001), so read state must go through this narrow
 * SECURITY DEFINER RPC (migration 00023). Proves the ownership boundary:
 *   * caller marks only their own notification
 *   * foreign recipient / cross-company / anon / inactive user all denied
 *   * only is_read can ever change (body/recipient/company immutable through
 *     the RPC; direct table UPDATE stays denied for authenticated)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'a6000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'a6000000-0000-4000-8000-00000000000b';
const USER_A = 'a6000000-0000-4000-8000-000000000011';
const USER_B = 'a6000000-0000-4000-8000-000000000012';
const USER_B_CO = 'a6000000-0000-4000-8000-000000000013';
const USER_INACTIVE = 'a6000000-0000-4000-8000-000000000014';

const NOTIF_A = 'notif-a:user-a';
const NOTIF_B = 'notif-b:user-b';
const NOTIF_B_CO = 'notif-bco:user-b-co';
const NOTIF_INACTIVE = 'notif-inactive:user-inactive';

let db: PGlite;

async function assume(userId: string, companyId: string) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated', app_metadata: { company_id: companyId } });
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`);
}

async function assumeAnon() {
  const claims = JSON.stringify({ role: 'anon' });
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role anon;`);
}

async function reset() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);
}

async function markRead(notificationId: string) {
  const { rows } = await db.query<{ out: any }>(
    `select public.mark_app_notification_read($1::text) as out`,
    [notificationId],
  );
  return rows[0]?.out;
}

async function errorOf(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    return String((error as { message?: string }).message ?? error);
  }
  throw new Error('Expected operation to fail');
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  // Seed companies, users, memberships and notifications as the harness
  // (postgres) — the same way production reference fixtures are created.
  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Notif A', 'notif-a'),
      ('${COMPANY_B}', 'Notif B', 'notif-b');
    insert into auth.users (id, email) values
      ('${USER_A}', 'user.a@notif.test'),
      ('${USER_B}', 'user.b@notif.test'),
      ('${USER_B_CO}', 'user.bco@notif.test'),
      ('${USER_INACTIVE}', 'user.inactive@notif.test');
    insert into public.users (id, email, name, role, status, is_active) values
      ('${USER_A}', 'user.a@notif.test', 'User A', 'USER', 'ACTIVE', true),
      ('${USER_B}', 'user.b@notif.test', 'User B', 'USER', 'ACTIVE', true),
      ('${USER_B_CO}', 'user.bco@notif.test', 'User B Co', 'USER', 'ACTIVE', true),
      ('${USER_INACTIVE}', 'user.inactive@notif.test', 'User Inactive', 'USER', 'INACTIVE', false);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_A}', '${USER_A}', 'USER'),
      ('${COMPANY_A}', '${USER_B}', 'USER'),
      ('${COMPANY_B}', '${USER_B_CO}', 'USER'),
      ('${COMPANY_A}', '${USER_INACTIVE}', 'USER');
    insert into public.app_notifications
      (id, company_id, recipient_user_id, is_read, type, title, message, notification_type)
    values
      ('${NOTIF_A}', '${COMPANY_A}', '${USER_A}', false, 'permission', 'عنوان أ', 'رسالة أ', 'permission_request'),
      ('${NOTIF_B}', '${COMPANY_A}', '${USER_B}', false, 'permission', 'عنوان ب', 'رسالة ب', 'permission_request'),
      ('${NOTIF_B_CO}', '${COMPANY_B}', '${USER_B_CO}', false, 'permission', 'عنوان ب', 'رسالة ب', 'permission_request'),
      ('${NOTIF_INACTIVE}', '${COMPANY_A}', '${USER_INACTIVE}', false, 'permission', 'عنوان خامل', 'رسالة خامل', 'permission_request');
  `);
});

afterAll(async () => {
  await db?.close();
});

describe('mark_app_notification_read governed RPC contract', () => {
  it('lets the caller mark their own notification read', async () => {
    await assume(USER_A, COMPANY_A);
    const out = await markRead(NOTIF_A);
    expect(out.status).toBe('updated');
    const { rows } = await db.query<{ is_read: boolean }>(
      `select is_read from public.app_notifications where id = $1::text`,
      [NOTIF_A],
    );
    expect(rows[0].is_read).toBe(true);
  });

  it('denies marking another user notification (same company)', async () => {
    await assume(USER_A, COMPANY_A);
    const error = await errorOf(() => markRead(NOTIF_B));
    expect(error).toMatch(/NOTIFICATION_NOT_FOUND_OR_FORBIDDEN|42501/);
  });

  it('denies cross-company marking', async () => {
    await assume(USER_A, COMPANY_A);
    const error = await errorOf(() => markRead(NOTIF_B_CO));
    expect(error).toMatch(/NOTIFICATION_NOT_FOUND_OR_FORBIDDEN|42501/);
  });

  it('denies anonymous callers (no EXECUTE grant; fails closed)', async () => {
    await assumeAnon();
    const error = await errorOf(() => markRead(NOTIF_A));
    expect(error).toMatch(/permission denied for function|AUTHENTICATION_REQUIRED|42501/);
    await reset();
  });

  it('denies an inactive user', async () => {
    await assume(USER_INACTIVE, COMPANY_A);
    const error = await errorOf(() => markRead(NOTIF_INACTIVE));
    expect(error).toMatch(/NOTIFICATION_READ_FORBIDDEN|42501/);
  });

  it('denies a caller without company context', async () => {
    const claims = JSON.stringify({ sub: USER_A, role: 'authenticated', app_metadata: {} });
    await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`);
    const error = await errorOf(() => markRead(NOTIF_A));
    expect(error).toMatch(/company context is required|42501/i);
    await reset();
  });

  it('cannot mutate body, recipient or company through the RPC', async () => {
    await assume(USER_A, COMPANY_A);
    await markRead(NOTIF_A);
    const { rows } = await db.query<{ title: string; message: string; recipient_user_id: string; company_id: string }>(
      `select title, message, recipient_user_id::text, company_id::text
         from public.app_notifications where id = $1::text`,
      [NOTIF_A],
    );
    expect(rows[0].title).toBe('عنوان أ');
    expect(rows[0].message).toBe('رسالة أ');
    expect(rows[0].recipient_user_id).toBe(USER_A);
    expect(rows[0].company_id).toBe(COMPANY_A);
  });

  it('keeps direct table UPDATE denied for authenticated (ACL lockdown intact)', async () => {
    await assume(USER_A, COMPANY_A);
    const error = await errorOf(() =>
      db.query(`update public.app_notifications set is_read = false where id = $1::text`, [NOTIF_A]),
    );
    expect(error).toMatch(/permission denied/i);
  });

  it('fails cleanly on malformed or empty ids', async () => {
    await assume(USER_A, COMPANY_A);
    const empty = await errorOf(() => markRead(''));
    expect(empty).toMatch(/INVALID_NOTIFICATION_ID|22023/);
    const long = await errorOf(() => markRead('x'.repeat(201)));
    expect(long).toMatch(/INVALID_NOTIFICATION_ID|22023/);
  });
});
