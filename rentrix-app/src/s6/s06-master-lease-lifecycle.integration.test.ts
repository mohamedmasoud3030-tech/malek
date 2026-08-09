/**
 * S06 — behavioral DB/GL lifecycle proof on a full replayed schema.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../p1/replay-bootstrap';

let db: PGlite;
const COMPANY_A = 'c6000000-0000-4000-8000-000000000001';
const COMPANY_B = 'c6000000-0000-4000-8000-000000000002';
const OWNER_A = '06000000-0000-4000-8000-000000000001';
const PROPERTY_A = '16000000-0000-4000-8000-000000000001';
const PROPERTY_OWNER_A = '16000000-0000-4000-8000-000000000002';
const AGREEMENT_A = '26000000-0000-4000-8000-000000000001';
const UNIT_A = '36000000-0000-4000-8000-000000000001';
const TENANT_A = '46000000-0000-4000-8000-000000000001';
const CONTRACT_A = '56000000-0000-4000-8000-000000000001';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ res: string }>(
    `select public.${name}($1::jsonb)::text as res`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.res ?? '{}') as Record<string, unknown>;
}

async function accountNetDebit(companyId: string, accountNo: string) {
  const { rows } = await db.query<{ debit: string; credit: string }>(
    `select coalesce(sum(l.debit),0)::text as debit,
            coalesce(sum(l.credit),0)::text as credit
       from public.journal_lines l
       join public.journal_batches b on b.id=l.batch_id
       join public.accounts a on a.id=l.account_id
      where b.company_id=$1::uuid and b.status='POSTED' and a.no=$2`,
    [companyId, accountNo],
  );
  return Number(rows[0]?.debit ?? 0) - Number(rows[0]?.credit ?? 0);
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies(id,name,slug) values
      ('${COMPANY_A}','S06 Company A','s06-company-a'),
      ('${COMPANY_B}','S06 Company B','s06-company-b');

    insert into public.owners(id,full_name,company_id)
    values('${OWNER_A}','S06 Owner A','${COMPANY_A}');

    insert into public.properties(id,title,type,address,status,company_id)
    values('${PROPERTY_A}','S06 Property A','residential','Muscat','active','${COMPANY_A}');

    insert into public.property_owners(
      id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id
    ) values(
      '${PROPERTY_OWNER_A}','${PROPERTY_A}','${OWNER_A}',100,true,date '2025-01-01',null,'${COMPANY_A}'
    );

    insert into public.owner_agreements(
      id,owner_id,property_id,agreement_type,commission_type,commission_value,
      starts_on,ends_on,company_id
    ) values(
      '${AGREEMENT_A}','${OWNER_A}','${PROPERTY_A}','master_lease','FIXED_MONTHLY',0,
      date '2026-08-01',date '2027-12-31','${COMPANY_A}'
    );

    insert into public.units(id,name,property_id,unit_number,status,company_id)
    values('${UNIT_A}','S06 Unit A','${PROPERTY_A}','ML-1','available','${COMPANY_A}');

    insert into public.people(id,full_name,type,company_id)
    values('${TENANT_A}','S06 Tenant A','tenant','${COMPANY_A}');

    insert into public.contracts(
      id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,
      payment_cycle,status,agreement_id,company_id
    ) values(
      '${CONTRACT_A}','${PROPERTY_A}','${UNIT_A}','${TENANT_A}',
      date '2026-08-01',date '2027-07-31',80,'monthly','active','${AGREEMENT_A}','${COMPANY_A}'
    );

    insert into public.accounting_periods(company_id,name,start_date,end_date,status) values
      ('${COMPANY_A}','S06-HORIZON',date '2026-08-01',date '2027-12-31','OPEN'),
      ('${COMPANY_B}','S06-HORIZON',date '2026-08-01',date '2027-12-31','OPEN');
  `);

  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY_A]);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY_B]);
  await db.query('select public.gl_ml_provision_supporting_accounts($1::uuid)', [COMPANY_A]);
  await db.query('select public.gl_ml_provision_supporting_accounts($1::uuid)', [COMPANY_B]);
}, 300_000);

afterAll(async () => { await db?.close(); });

describe('S06 master lease production lifecycle', () => {
  let initialMeasurementId = '';
  let revisedMeasurementId = '';

  it('rejects cross-company use of another company master-lease agreement', async () => {
    await expect(rpc('gl_ml_create_initial_measurement', {
      company_id: COMPANY_B,
      owner_agreement_id: AGREEMENT_A,
      request_id: 's06-cross-company-reject',
      effective_date: '2026-08-01',
      annual_discount_rate_bps: 0,
      periods_per_year: 12,
      payments: [{ period: 1, amount: 100 }, { period: 2, amount: 100 }],
    })).rejects.toThrow(/GL_ML_AGREEMENT_NOT_FOUND_OR_NOT_MASTER_LEASE/);
  });

  it('creates one idempotent server-derived initial measurement', async () => {
    const payload = {
      company_id: COMPANY_A,
      owner_agreement_id: AGREEMENT_A,
      request_id: 's06-initial-001',
      effective_date: '2026-08-01',
      annual_discount_rate_bps: 0,
      periods_per_year: 12,
      payments: [{ period: 1, amount: 100 }, { period: 2, amount: 100 }],
    };
    const first = await rpc('gl_ml_create_initial_measurement', payload);
    const retry = await rpc('gl_ml_create_initial_measurement', payload);
    initialMeasurementId = String(first.measurement_id);
    expect(first.initial_liability).toBe(200);
    expect(first.initial_rou_asset).toBe(200);
    expect(first.status).toBe('DRAFT');
    expect(retry.measurement_id).toBe(initialMeasurementId);
    expect(retry.idempotent).toBe(true);
  });

  it('posts initial recognition and first period to canonical GL', async () => {
    expect((await rpc('gl_ml_post_initial_recognition', {
      company_id: COMPANY_A,
      measurement_id: initialMeasurementId,
      cash_account_no: '1120',
    })).status).toBe('ACTIVE');
    expect(await accountNetDebit(COMPANY_A, '1600')).toBe(200);
    expect(await accountNetDebit(COMPANY_A, '2500')).toBe(-200);

    await rpc('gl_ml_post_period', {
      company_id: COMPANY_A,
      measurement_id: initialMeasurementId,
      period_no: 1,
      cash_account_no: '1120',
    });
    expect(await accountNetDebit(COMPANY_A, '1600')).toBe(100);
    expect(await accountNetDebit(COMPANY_A, '2500')).toBe(-100);
    expect(await accountNetDebit(COMPANY_A, '6200')).toBe(100);
  });

  it('freezes a remeasurement and blocks old future posting', async () => {
    const draft = await rpc('gl_ml_create_remeasurement', {
      company_id: COMPANY_A,
      owner_agreement_id: AGREEMENT_A,
      request_id: 's06-remeasure-001',
      effective_date: '2026-09-01',
      annual_discount_rate_bps: 0,
      periods_per_year: 12,
      scope_reduction_bps: 0,
      payments: [{ period: 1, amount: 60 }, { period: 2, amount: 60 }],
    });
    revisedMeasurementId = String(draft.measurement_id);
    expect(draft.carrying_liability_before).toBe(100);
    expect(draft.carrying_rou_before).toBe(100);
    expect(draft.initial_liability).toBe(120);
    expect(draft.initial_rou_asset).toBe(120);

    await expect(rpc('gl_ml_post_period', {
      company_id: COMPANY_A,
      measurement_id: initialMeasurementId,
      period_no: 2,
      cash_account_no: '1120',
    })).rejects.toThrow(/GL_ML_PERIOD_BLOCKED_BY_PENDING_REMEASUREMENT/);
  });

  it('posts remeasurement and rebases depreciation to new carrying ROU', async () => {
    expect((await rpc('gl_ml_post_remeasurement', {
      company_id: COMPANY_A,
      measurement_id: revisedMeasurementId,
    })).status).toBe('ACTIVE');
    expect(await accountNetDebit(COMPANY_A, '1600')).toBe(120);
    expect(await accountNetDebit(COMPANY_A, '2500')).toBe(-120);

    const { rows } = await db.query<{ dep: string; close: string }>(
      `select rou_depreciation::text as dep, closing_rou_asset::text as close
       from public.master_lease_schedule_rows where measurement_id=$1::uuid order by period_no`,
      [revisedMeasurementId],
    );
    expect(rows.map((row) => Number(row.dep))).toEqual([60, 60]);
    expect(rows.map((row) => Number(row.close))).toEqual([60, 0]);

    await rpc('gl_ml_post_period', {
      company_id: COMPANY_A,
      measurement_id: revisedMeasurementId,
      period_no: 1,
      cash_account_no: '1120',
    });
    expect(await accountNetDebit(COMPANY_A, '1600')).toBe(60);
    expect(await accountNetDebit(COMPANY_A, '2500')).toBe(-60);
  });

  it('posts gross sublease revenue without Owner Funds Payable', async () => {
    const beforeOwnerFunds = await accountNetDebit(COMPANY_A, '2000');
    const result = await rpc('gl_ml_post_sublease_receipt', {
      company_id: COMPANY_A,
      contract_id: CONTRACT_A,
      source_id: 's06-sublease-receipt-001',
      amount: 80,
      effective_date: '2026-10-01',
      cash_account_no: '1120',
    });
    expect(result.amount).toBe(80);
    expect(await accountNetDebit(COMPANY_A, '4000')).toBe(-80);
    expect(await accountNetDebit(COMPANY_A, '2000')).toBe(beforeOwnerFunds);
  });

  it('fully terminates at next posted boundary and clears ROU/liability', async () => {
    const termination = await rpc('gl_ml_create_remeasurement', {
      company_id: COMPANY_A,
      owner_agreement_id: AGREEMENT_A,
      request_id: 's06-full-termination-001',
      effective_date: '2026-10-01',
      annual_discount_rate_bps: 0,
      periods_per_year: 12,
      scope_reduction_bps: 10_000,
      payments: [],
    });
    expect(termination.measurement_type).toBe('FULL_TERMINATION');
    expect(termination.carrying_liability_before).toBe(60);
    expect(termination.carrying_rou_before).toBe(60);
    expect((await rpc('gl_ml_post_remeasurement', {
      company_id: COMPANY_A,
      measurement_id: String(termination.measurement_id),
    })).status).toBe('TERMINATED');
    expect(await accountNetDebit(COMPANY_A, '1600')).toBe(0);
    expect(await accountNetDebit(COMPANY_A, '2500')).toBe(0);
  });
});
