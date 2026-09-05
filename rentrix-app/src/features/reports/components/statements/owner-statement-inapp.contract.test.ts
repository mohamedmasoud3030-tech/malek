import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const source = (relativePath: string) =>
  readFileSync(resolve(here, relativePath), 'utf8')
    .replaceAll('"', "'")
    .replace(/\s+/g, ' ');
const panel = source('statement-account-panels.tsx');
const section = source('../StatementsSection.tsx');
const workspace = source('../../use-reports-workspace.ts');
const productPage = source('../../premium/report-product-page.tsx');
const documentActions = source(
  '../../premium/report-product-document-actions.ts',
);

describe('owner statement in-app vertical slice contract', () => {
  it('loads the premium owner payload once in the read model and keeps the body presentation-only', () => {
    expect(workspace).toContain('loadPremiumOwnerReportPayload');
    expect(workspace).toContain('ownerReportPayloadQuery');
    expect(panel).not.toContain('loadPremiumOwnerReportPayload');
    expect(panel).not.toMatch(/useEffect|useState|useRef/);
    expect(panel).toContain('ReportPayloadGroup');
    expect(panel).not.toContain('const settlementMovement =');
  });

  it('keeps the long daily ledger in EntityTable while preserving canonical group order', () => {
    expect(panel).toContain("aria-label='حركات كشف حساب المالك'");
    expect(panel).toContain(
      'const [summaryGroup, ...remainingGroups] = fullStatement?.groups ?? []',
    );
    expect(panel).toContain(
      "block.table.title === 'الحركة المالية اليومية التفصيلية'",
    );
    expect(panel).toContain('supplementalGroups.map');
  });

  it('passes the prepared owner payload and selected scope from the one product shell to document actions', () => {
    expect(section).toContain('fullStatement={ownerReportPayload}');
    expect(section).toMatch(
      /period=\{\{ from: filters\?\.from, to: filters\?\.to, propertyId: filters\?\.propertyId,? \}\}/,
    );
    expect(productPage).toContain('useReportProductDocumentActions');
    expect(documentActions).toContain("case 'owner-pack'");
    expect(documentActions).toContain('payload: statements.ownerReportPayload');
    expect(documentActions).toContain(
      'runOwnerReportDocumentAction(ownerParams',
    );
  });
});
