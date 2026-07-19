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
});
