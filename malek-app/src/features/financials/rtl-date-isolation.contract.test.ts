import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Locks RTL date isolation in the money workspaces: dates rendered inline
// inside Arabic prose must be wrapped in a dir="ltr" span, otherwise the
// bidi algorithm visually reorders the d/m/y segments ("302026/09/" was
// observed live in the invoices table). The due-date cell already followed
// this pattern; these assertions keep the issue-date lines consistent and
// prevent the raw-inline pattern from creeping back.
const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("RTL date isolation contract (money workspaces)", () => {
  it("isolates the invoice issue-date line inside the RTL identity cell", () => {
    const source = read("features/financials/components/invoice-list-section.tsx");
    expect(source).not.toContain("إصدار {formatDate(invoice.issue_date)}");
    // The due-date isolation (pre-existing) and the issue-date isolation.
    const isolated = source.match(/dir="ltr"/g) ?? [];
    expect(isolated.length).toBeGreaterThanOrEqual(2);
  });

  it("isolates issue/due dates in the billing readiness list", () => {
    const source = read("features/financials/billing/billing-readiness-section.tsx");
    expect(source).not.toContain("إصدار {obligation.issue_date}");
    expect(source).toContain('dir="ltr"');
  });
});
