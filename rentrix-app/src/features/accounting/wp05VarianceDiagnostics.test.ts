/**
 * WP-05 GAP-018 — service-layer tests for variance diagnostics and the
 * pending-approval correction-proposal lane (mocked Supabase boundary).
 *
 * The guarantee under test is that the client surface can diagnose and propose,
 * but has no path that posts to the general ledger.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), handleSupabaseError: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/supabase-error', () => ({ handleSupabaseError: mocks.handleSupabaseError }));

import * as wp05 from './wp05Services';

const diagnosticRow = {
  reconciliation_class: 'OWNER_PAYABLES',
  account_no: '2000',
  account_name: 'Owner Funds Payable',
  subledger_balance: 12405,
  gl_balance: 0,
  variance: 12405,
  abs_variance: 12405,
  currency: 'OMR',
  reconciliation_status: 'FAIL',
  reason_code: 'GL_NO_POSTINGS_FOR_ACCOUNT',
  reason_detail: 'Account 2000 exists but carries zero posted journal lines.',
  proposal_type: 'MISSING_GL_POSTING',
  recommended_action: 'Identify the business events behind the subledger rows.',
  evidence: { gl_debits: 0, gl_credits: 0, gl_line_count: 0, subledger_count: 1 },
  subledger_count: 1,
  gl_count: 0,
};

describe('getVarianceDiagnostics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps reason code, proposal type and evidence onto the reconciliation row', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [diagnosticRow], error: null });

    const rows = await wp05.getVarianceDiagnostics('2026-07-31');

    expect(mocks.rpc).toHaveBeenCalledWith('wp05_variance_diagnostics', { p_as_of: '2026-07-31' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reconciliation_class: 'OWNER_PAYABLES',
      reason_code: 'GL_NO_POSTINGS_FOR_ACCOUNT',
      proposal_type: 'MISSING_GL_POSTING',
      reconciliation_status: 'FAIL',
      subledger_balance: 12405,
      gl_balance: 0,
      currency: 'OMR',
    });
    expect(rows[0].evidence).toMatchObject({ gl_line_count: 0 });
  });

  it('classifies the security-deposit shape without inventing a balance', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          ...diagnosticRow,
          reconciliation_class: 'SECURITY_DEPOSITS',
          account_no: '2200',
          subledger_balance: 50,
          gl_balance: 100,
          variance: -50,
          abs_variance: 50,
          reason_code: 'SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL',
          evidence: { deposit_applied_total: 50, gl_debits: 0, gl_credits: 100 },
        },
      ],
      error: null,
    });

    const [row] = await wp05.getVarianceDiagnostics('2026-07-31');

    expect(row.reason_code).toBe('SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL');
    expect(row.subledger_balance).toBe(50);
    expect(row.gl_balance).toBe(100);
    expect(row.variance).toBe(-50);
    expect(row.evidence.deposit_applied_total).toBe(50);
  });

  it('degrades to an empty list and reports the error instead of throwing', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    await expect(wp05.getVarianceDiagnostics('2026-07-31')).resolves.toEqual([]);
    expect(mocks.handleSupabaseError).toHaveBeenCalled();
  });
});

describe('correction proposal lane', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates proposals through the maker RPC and reports posted_to_gl false', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        success: true,
        created: 3,
        already_present: 0,
        reconciled_classes: 2,
        posted_to_gl: false,
      },
      error: null,
    });

    const result = await wp05.generateCorrectionProposals({
      as_of: '2026-07-31',
      request_id: 'run-1',
      accounting_period_id: 'period-1',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('wp05_generate_correction_proposals', {
      p_as_of: '2026-07-31',
      p_request_id: 'run-1',
      p_accounting_period_id: 'period-1',
    });
    expect(result).toEqual({
      success: true,
      created: 3,
      already_present: 0,
      reconciled_classes: 2,
      posted_to_gl: false,
    });
  });

  it('surfaces idempotent re-runs as zero created', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true, created: 0, already_present: 3, reconciled_classes: 2, posted_to_gl: false },
      error: null,
    });

    const result = await wp05.generateCorrectionProposals({ as_of: '2026-07-31', request_id: 'run-1' });

    expect(result.created).toBe(0);
    expect(result.already_present).toBe(3);
  });

  it('lists proposals and defaults the pending status filter to null', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        company_id: 'company-1',
        proposals: [
          {
            id: 'proposal-1',
            company_id: 'company-1',
            as_of: '2026-07-31',
            reconciliation_class: 'OWNER_PAYABLES',
            account_no: '2000',
            reason_code: 'GL_NO_POSTINGS_FOR_ACCOUNT',
            reason_detail: 'detail',
            proposal_type: 'MISSING_GL_POSTING',
            recommended_action: 'action',
            status: 'PENDING_APPROVAL',
            subledger_balance: 12405,
            gl_balance: 0,
            variance_amount: 12405,
            evidence: {},
            maker_user_id: 'maker-1',
            checker_user_id: null,
            decided_at: null,
            decision_note: null,
            s09_correction_id: null,
            created_at: '2026-08-16T00:00:00Z',
          },
        ],
      },
      error: null,
    });

    const proposals = await wp05.listCorrectionProposals();

    expect(mocks.rpc).toHaveBeenCalledWith('wp05_list_correction_proposals', {
      p_status: null,
      p_as_of: null,
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].status).toBe('PENDING_APPROVAL');
    expect(proposals[0].checker_user_id).toBeNull();
    expect(proposals[0].s09_correction_id).toBeNull();
  });

  it('approves through the checker RPC without posting to the GL', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true, id: 'proposal-1', status: 'APPROVED', posted_to_gl: false },
      error: null,
    });

    const result = await wp05.approveCorrectionProposal('proposal-1', 'confirmed');

    expect(mocks.rpc).toHaveBeenCalledWith('wp05_approve_correction_proposal', {
      p_proposal_id: 'proposal-1',
      p_note: 'confirmed',
    });
    expect(result).toEqual({ status: 'APPROVED', posted_to_gl: false });
  });

  it('propagates the rejection reason and surfaces RPC errors', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'REJECTED' }, error: null });
    await expect(wp05.rejectCorrectionProposal('proposal-2', 'needs evidence')).resolves.toEqual({
      status: 'REJECTED',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('wp05_reject_correction_proposal', {
      p_proposal_id: 'proposal-2',
      p_reason: 'needs evidence',
    });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'reason required' } });
    await expect(wp05.rejectCorrectionProposal('proposal-2', '')).rejects.toBeTruthy();
  });

  it('exposes the no-unapproved-posting proof', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        success: true,
        proposal_sourced_gl_batches: 0,
        applied_s09_without_approved_s08: 0,
        proposals_pending_approval: 2,
        proposals_approved: 1,
        proposals_rejected: 0,
      },
      error: null,
    });

    const proof = await wp05.assertNoUnapprovedCorrectionPostings();

    expect(proof.success).toBe(true);
    expect(proof.proposal_sourced_gl_batches).toBe(0);
    expect(proof.applied_s09_without_approved_s08).toBe(0);
  });
});

describe('client surface has no unapproved posting path', () => {
  it('the GAP-018 lane never calls a GL posting RPC', async () => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: {}, error: null });

    await wp05.getVarianceDiagnostics('2026-07-31');
    await wp05.generateCorrectionProposals({ as_of: '2026-07-31' });
    await wp05.approveCorrectionProposal('proposal-1');
    await wp05.rejectCorrectionProposal('proposal-1', 'no');
    await wp05.listCorrectionProposals();

    const calledRpcs = mocks.rpc.mock.calls.map(([name]) => name as string);
    const postingRpcs = ['post_journal_event', 'reverse_journal_batch', 's09_apply_correction'];
    for (const forbidden of postingRpcs) {
      expect(calledRpcs).not.toContain(forbidden);
    }
    expect(calledRpcs.every((name) => name.startsWith('wp05_'))).toBe(true);
  });
});
