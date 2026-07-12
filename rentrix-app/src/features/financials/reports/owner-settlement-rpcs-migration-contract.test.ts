import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260716000002_owner_settlement_atomic_lifecycle_rpcs.sql',
  ),
  'utf8',
);

const rpcNames = [
  'create_owner_settlement_draft_atomic',
  'approve_owner_settlement_atomic',
  'pay_owner_settlement_atomic',
  'cancel_owner_settlement_atomic',
] as const;

describe('owner settlement atomic lifecycle migration contract', () => {
  it.each(rpcNames)('%s is hardened and not callable by public or anon', (name) => {
    expect(sql).toContain(`create or replace function public.${name}(p_payload jsonb)`);
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path to 'public', 'pg_temp'");
    expect(sql).toContain(`revoke all on function public.${name}(jsonb) from public, anon;`);
    expect(sql).toContain(`grant execute on function public.${name}(jsonb) to authenticated, service_role;`);
  });

  it('requires manager-level authorization for every state mutation', () => {
    expect(sql.match(/not public\.is_admin_or_manager\(\)/g)).toHaveLength(4);
  });

  it('uses idempotency records for create, approve, pay, and cancel', () => {
    for (const name of rpcNames) {
      expect(sql).toContain(`operation_name = '${name}'`);
      expect(sql).toContain(`values ('${name}', v_request_id, v_result)`);
    }
  });

  it('enforces the DRAFT to APPROVED to PAID lifecycle', () => {
    expect(sql).toContain("v_row.status <> 'DRAFT'");
    expect(sql).toContain("set status = 'APPROVED'");
    expect(sql).toContain("v_row.status <> 'APPROVED'");
    expect(sql).toContain("set status = 'PAID'");
  });

  it('blocks cancellation of paid settlements and requires a reason', () => {
    expect(sql).toContain("v_row.status not in ('DRAFT', 'APPROVED')");
    expect(sql).toContain('paid settlements require a controlled reversal');
    expect(sql).toContain('settlement_id, request_id, and reason are required');
  });

  it('posts a balanced owner-payable and cash batch only when paying', () => {
    expect(sql).toContain("values ('2000', '2000', 'Owner Payables')");
    expect(sql).toContain("where no = '2000'");
    expect(sql).toContain("where no = '1111'");
    expect(sql).toContain("'DEBIT', v_id::uuid, 'owner_settlement_payment'");
    expect(sql).toContain("'CREDIT', v_id::uuid, 'owner_settlement_payment'");
    expect(sql).toContain('v_batch_id');
  });

  it('locks duplicate owner-period drafts and derives net payable server-side', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("status <> 'CANCELLED'");
    expect(sql).toContain('v_net := greatest(v_gross - v_fee - v_expenses - v_tax, 0);');
  });

  it('writes audit evidence for all lifecycle actions', () => {
    for (const action of ['CREATE', 'APPROVE', 'PAY', 'CANCEL']) {
      expect(sql).toContain(`'${action}', 'owner_settlements'`);
    }
  });
});
