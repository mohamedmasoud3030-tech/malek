import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync(
  resolve(import.meta.dirname, './components/OwnerSettlementWorkspace.tsx'),
  'utf8',
);
const service = readFileSync(
  resolve(import.meta.dirname, './services/owner-settlements-service.ts'),
  'utf8',
);

describe('owner settlement live workspace contract', () => {
  it('loads settlement and agreement data through React Query', () => {
    expect(workspace).toContain('useQuery');
    expect(workspace).toContain('listOwnerSettlements');
    expect(workspace).toContain('listOwnerSettlementTargets');
    expect(workspace).toContain('AsyncContentState');
    expect(workspace).toContain("['owner-settlements']");
  });

  it('uses the real atomic lifecycle for draft, approval, and payout', () => {
    expect(workspace).toContain('createOwnerSettlementDraft');
    expect(workspace).toContain('approveOwnerSettlement');
    expect(workspace).toContain('processOwnerPayout');
    expect(workspace).toContain('useMutation');

    expect(service).toContain("rpc('create_owner_settlement_draft_atomic'");
    expect(service).toContain("rpc('approve_owner_settlement_atomic'");
    expect(service).toContain("rpc('pay_owner_settlement_atomic'");
  });

  it('does not ship the old local demo settlement records or local-only mutations', () => {
    expect(workspace).not.toContain('settle-801');
    expect(workspace).not.toContain('settle-802');
    expect(workspace).not.toContain('سعود بن محمد الكثيري');
    expect(workspace).not.toContain('خالد بن ناصر الهنائي');
    expect(workspace).not.toMatch(/setSettlements\s*\(/);
  });

  it('prints only with real company settings and uses the shared responsive form surface', () => {
    expect(workspace).toContain('useDocumentSettings');
    expect(workspace).toContain('documentSettings.isReady');
    expect(workspace).toContain('EntityForm.Overlay');
    expect(workspace).not.toContain('+968 24000000');
    expect(workspace).not.toContain("name: 'رينتريكس لإدارة العقارات'");
  });

  it('propagates backend read failures instead of converting them to a fake empty state', () => {
    expect(service).toContain("throw new Error(messageFromError(settlementError");
    expect(service).not.toContain("console.error('Error fetching owner settlements:'");
  });

  it('P1: previews via calculate_owner_net_payout and renders the server breakdown read-only', () => {
    expect(service).toContain("rpc('calculate_owner_net_payout'");
    expect(service).toContain('previewOwnerSettlement');
    expect(workspace).toContain('previewOwnerSettlement');
    expect(workspace).toContain('owner-settlement-preview');
    expect(workspace).toContain('معاينة المبالغ');
    expect(workspace).toContain('submitDisabled={!preview || previewLoading}');
  });

  it('P1: the draft form never computes or sends amounts — no local calculators remain', () => {
    // no reduce/fee-math on the client
    expect(workspace).not.toContain('recommendedFee');
    expect(workspace).not.toContain('handleGrossChange');
    expect(workspace).not.toContain('grossCollected');
    // payload type carries no amount fields
    const payloadType = service.match(/export type CreateSettlementDraftPayload = \{[\s\S]*?\};/)?.[0] ?? '';
    for (const banned of ['gross_collected', 'office_fee', 'owner_expenses', 'tax_amount', 'net_payable']) {
      expect(payloadType, `CreateSettlementDraftPayload must not declare ${banned}`).not.toContain(`${banned}:`);
    }
    // the write RPC call passes the caller-held attempt key, no fresh id per click
    expect(service).toContain('request_id: payload.request_id');
    expect(workspace).toContain('draftRequestId');
  });
});
