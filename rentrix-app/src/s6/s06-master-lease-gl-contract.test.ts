import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../p1/replay-bootstrap';

const migration = readFileSync(
  join(repoRoot, 'supabase', 'migrations', '20260809020000_s06_master_lease_gl_lifecycle.sql'),
  'utf8',
);
const rollback = readFileSync(
  join(repoRoot, 'supabase', 'rollback', '20260809020000_rollback_s06_master_lease_gl_lifecycle.sql'),
  'utf8',
);

describe('S06 master lease DB/GL contract', () => {
  it('persists versioned measurements and immutable derived schedules', () => {
    expect(migration).toContain('create table if not exists public.master_lease_measurements');
    expect(migration).toContain('create table if not exists public.master_lease_schedule_rows');
    expect(migration).toContain('master_lease_measurements_one_active_uidx');
    expect(migration).toContain('master_lease_measurements_one_draft_uidx');
    expect(migration).toContain('MASTER_LEASE_MEASUREMENT_FINANCIAL_FIELDS_IMMUTABLE');
    expect(migration).toContain('MASTER_LEASE_SCHEDULE_FINANCIAL_FIELDS_IMMUTABLE');
  });

  it('closes browser and direct service-role financial writes', () => {
    expect(migration).toContain('revoke all on table public.master_lease_measurements from public,anon,authenticated,service_role');
    expect(migration).toContain('revoke all on table public.master_lease_schedule_rows from public,anon,authenticated,service_role');
    expect(migration).toContain('grant select on table public.master_lease_measurements to authenticated,service_role');
    expect(migration).toContain('grant execute on function public.gl_ml_create_initial_measurement(jsonb) to service_role');
    expect(migration).not.toContain('grant execute on function public.gl_ml_create_initial_measurement(jsonb) to authenticated');
  });

  it('uses the approved net ROU/liability/revenue/expense accounts plus modification gain/loss', () => {
    for (const account of ['1600', '2500', '4000', '4400', '6200', '6300', '6400']) {
      expect(migration).toContain(`'${account}'`);
    }
    expect(migration).not.toContain("'1650'");
    expect(migration).toContain("'4400','Lease Modification / Termination Gain'");
    expect(migration).toContain("'6400','Lease Modification / Termination Loss'");
  });

  it('depreciates the net ROU carrying-value account directly', () => {
    const start = migration.indexOf('function public.gl_ml_post_period');
    const end = migration.indexOf('function public.gl_ml_create_remeasurement', start);
    const body = migration.slice(start, end);
    expect(body).toContain("v_dep_id := public.require_company_account_id(v_company,'6200')");
    expect(body).toContain("v_rou_id := public.require_company_account_id(v_company,'1600')");
    expect(body).toContain("jsonb_build_object('account_id',v_rou_id,'debit',0,'credit',v_r.rou_depreciation)");
    expect(body).not.toContain('1650');
  });

  it('posts every recognized master-lease financial event through the canonical S03 GL engine', () => {
    const postingFunctions = [
      'gl_ml_post_initial_recognition',
      'gl_ml_post_period',
      'gl_ml_post_remeasurement',
      'gl_ml_post_sublease_receipt',
    ];
    for (const fn of postingFunctions) {
      const start = migration.indexOf(`function public.${fn}`);
      expect(start).toBeGreaterThan(-1);
      const nextFunction = migration.indexOf('create or replace function public.', start + 1);
      const body = migration.slice(start, nextFunction === -1 ? migration.length : nextFunction);
      expect(body).toContain('public.post_journal_event');
    }
  });

  it('keeps master lease PRINCIPAL accounting outside owner-funds payable', () => {
    const start = migration.indexOf('function public.gl_ml_post_sublease_receipt');
    const body = migration.slice(start);
    expect(body).toContain("oa.agreement_type='master_lease'");
    expect(body).toContain("require_company_account_id(v_company,'4000')");
    expect(body).not.toContain("require_company_account_id(v_company,'2000')");
  });

  it('derives remeasurement carrying values only at a posted schedule boundary', () => {
    const start = migration.indexOf('function public.gl_ml_create_remeasurement');
    const end = migration.indexOf('function public.gl_ml_post_remeasurement', start);
    const body = migration.slice(start, end);
    expect(body).toContain('GL_ML_REMEASUREMENT_REQUIRES_POSTED_PERIOD_BOUNDARY');
    expect(body).toContain('v_carry_liability := v_last.closing_liability');
    expect(body).toContain('v_carry_rou := v_last.closing_rou_asset');
    expect(body).not.toContain("p_payload->>'carrying_liability'");
    expect(body).not.toContain("p_payload->>'carrying_rou'");
  });

  it('blocks old future periods once a remeasurement draft freezes the boundary', () => {
    expect(migration).toContain('GL_ML_PERIOD_BLOCKED_BY_PENDING_REMEASUREMENT');
    expect(migration).toContain('GL_ML_REMEASUREMENT_DRAFT_STALE');
  });

  it('supports short-term election, renewal/remeasurement, partial termination and full termination', () => {
    expect(migration).toContain('GL_ML_SHORT_TERM_EXEMPTION_TERM_EXCEEDS_12_MONTHS');
    expect(migration).toContain("'REMEASUREMENT'");
    expect(migration).toContain("'PARTIAL_TERMINATION'");
    expect(migration).toContain("'FULL_TERMINATION'");
    expect(migration).toContain('GL_ML_FULL_TERMINATION_REVISED_PAYMENTS_FORBIDDEN');
    expect(migration).toContain("set status='SUPERSEDED',superseded_at=now()");
    expect(migration).toContain("set status='TERMINATED',posted_at=now()");
  });

  it('uses a guarded, non-destructive rollback', () => {
    expect(rollback).toContain('S06_ROLLBACK_REFUSED');
    expect(rollback).toContain('master-lease measurements exist');
    expect(rollback).toContain('Accounts 4400/6400 are deliberately retained');
    expect(rollback).not.toMatch(/delete\s+from\s+public\.journal/i);
    expect(rollback).not.toMatch(/truncate\s+public\.journal/i);
  });
});
