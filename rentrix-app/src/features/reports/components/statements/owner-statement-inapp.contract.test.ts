import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const panel = readFileSync(resolve(here, 'statement-account-panels.tsx'), 'utf8');
const section = readFileSync(resolve(here, '../StatementsSection.tsx'), 'utf8');
const workspace = readFileSync(resolve(here, '../../use-reports-workspace.ts'), 'utf8');

describe('owner statement in-app vertical slice contract', () => {
  it('loads the premium owner payload once in the workspace and keeps the panel presentation-only', () => {
    expect(workspace).toContain('loadPremiumOwnerReportPayload');
    expect(workspace).toContain('ownerReportPayloadQuery');
    expect(panel).not.toContain('loadPremiumOwnerReportPayload');
    expect(panel).not.toMatch(/useEffect|useState|useRef/);
    expect(panel).toContain('ReportPayloadGroup');
    expect(panel).not.toContain('const settlementMovement =');
  });

  it('keeps the long daily ledger in EntityTable while preserving canonical group order', () => {
    expect(panel).toContain('aria-label="حركات كشف حساب المالك"');
    expect(panel).toContain('const [summaryGroup, ...remainingGroups] = fullStatement?.groups ?? []');
    expect(panel).toContain("block.table.title === 'الحركة المالية اليومية التفصيلية'");
    expect(panel).toContain('supplementalGroups.map');
  });

  it('wires the same prepared owner payload and scope into the panel and document actions', () => {
    expect(section).toContain('fullStatement={ownerReportPayload}');
    expect(section).toContain('payload: ownerReportPayload');
    expect(section).toContain('period={{ from: filters?.from, to: filters?.to, propertyId: filters?.propertyId }}');
  });
});
