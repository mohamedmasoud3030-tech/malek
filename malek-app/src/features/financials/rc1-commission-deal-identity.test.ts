import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'e2000000-0000-4000-8000-000000000001';
const ADMIN = 'e2000000-0000-4000-8000-000000000011';

let db: PGlite;

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
      values ('${COMPANY}', 'RC1 Commission Identity Co', 'rc1-commission-identity');
    insert into auth.users (id, email, raw_app_meta_data)
      values ('${ADMIN}', 'admin@commission-identity.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active)
      values ('${ADMIN}', 'admin@commission-identity.test', 'Commission Admin', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role)
      values ('${COMPANY}', '${ADMIN}', 'ADMIN');
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('RC1 commission deal identity authority', () => {
  it('requires a real source/deal reference', async () => {
    await expect(
      rpc('create_commission_atomic', {
        staff_name: 'Broker A',
        type: 'contract',
        deal_value: 100.05,
        percentage: 10,
        request_id: 'commission-missing-source',
      }),
    ).rejects.toThrow('commissions_source_required_rc1_check');
  });

  it('derives commission money at OMR 3dp', async () => {
    const created = await rpc('create_commission_atomic', {
      staff_name: 'Broker A',
      type: 'contract',
      source_id: 'deal-contract-001',
      deal_value: 100.05,
      percentage: 10,
      request_id: 'commission-omr-3dp',
    });

    const commission = created.commission as { id: string; amount: number | string };
    expect(Number(commission.amount)).toBe(10.005);
  });

  it('rejects a second commission for the same beneficiary and deal identity', async () => {
    await expect(
      rpc('create_commission_atomic', {
        staff_name: ' Broker A ',
        type: 'contract',
        source_id: 'deal-contract-001',
        amount: 12.345,
        request_id: 'commission-duplicate-deal',
      }),
    ).rejects.toThrow('commissions_one_time_deal_identity_uidx');
  });

  it('keeps identity person-specific: another beneficiary may have a separate deal reward', async () => {
    const created = await rpc('create_commission_atomic', {
      staff_name: 'Broker B',
      type: 'contract',
      source_id: 'deal-contract-001',
      amount: 5.125,
      request_id: 'commission-second-beneficiary',
    });

    expect(Number((created.commission as { amount: number | string }).amount)).toBe(5.125);
  });
});
