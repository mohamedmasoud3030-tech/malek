import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const panel = readFileSync(resolve(here, 'statement-account-panels.tsx'), 'utf8');
const section = readFileSync(resolve(here, '../StatementsSection.tsx'), 'utf8');

describe('owner statement in-app vertical slice contract', () => {
  it('reuses the premium owner payload instead of rebuilding report math in the panel', () => {
    expect(panel).toContain('loadPremiumOwnerReportPayload');
    expect(panel).toContain('statement,');
    expect(panel).toContain('ReportPayloadGroup');
    expect(panel).not.toContain('const settlementMovement =');
  });

  it('keeps the long daily ledger in EntityTable while preserving canonical group order', () => {
    expect(panel).toContain('aria-label="حركات كشف حساب المالك"');
    expect(panel).toContain('const [summaryGroup, ...remainingGroups] = fullStatement?.groups ?? []');
    expect(panel).toContain("block.table.title === 'الحركة المالية اليومية التفصيلية'");
    expect(panel).toContain('supplementalGroups.map');
  });

  it('wires the same owner/period/property scope used by print into the in-app panel', () => {
    expect(section).toContain('period={{ from: filters?.from, to: filters?.to, propertyId: filters?.propertyId }}');
  });
});
