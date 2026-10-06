import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Locks the curated Leads mobile-card configuration that shipped with the
// canonical-loading work (PR #1814). Before curation, Leads fell back to
// EntityTable's automatic column-priority mobile selection — the original
// user-reported mobile inconsistency. These assertions keep both sides of
// the contract: the view must keep passing the curation props, and
// EntityTable must keep accepting them (no silent prop rename).
const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Leads mobile-card curation contract", () => {
  it("keeps the curated mobile card config on the Leads EntityTable", () => {
    const view = read("features/leads/components/leads-view.tsx");
    expect(view).toContain('mobileBadgeKey="status"');
    expect(view).toContain("mobilePrimaryMetaKeys={['source', 'budget']}");
    expect(view).toContain("mobileCardPrimaryAction={");
    expect(view).toContain("mobileCardActions={");
    expect(view).toContain("mobileCardSecondaryToOverflow");
  });

  it("keeps EntityTable accepting the curation props (no silent rename)", () => {
    const entityTable = read("components/ui/entity-table.tsx");
    for (const prop of [
      "mobileBadgeKey",
      "mobilePrimaryMetaKeys",
      "mobileCardPrimaryAction",
      "mobileCardActions",
    ]) {
      expect(entityTable).toContain(prop);
    }
  });
});
