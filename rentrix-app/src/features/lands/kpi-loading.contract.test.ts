import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Locks the KPI-strip loading contract for Lands and Leads (PR #1814):
// both registers use the canonical `LoadingState variant="cards"` skeleton
// (same primitive as Utilities) instead of hand-rolled Array.from skeleton
// blocks, and Leads no longer renders a bare KPI grid during its first fetch.
const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const views: ReadonlyArray<[string, () => string]> = [
  ["features/lands/components/lands-view.tsx", () => read("features/lands/components/lands-view.tsx")],
  ["features/leads/components/leads-view.tsx", () => read("features/leads/components/leads-view.tsx")],
];

describe("Lands/Leads KPI loading-state contract", () => {
  it("uses the canonical cards loading skeleton in both registers", () => {
    for (const [path, view] of views) {
      expect(view(), path).toContain('<LoadingState variant="cards" rows={4}');
      expect(view(), path).toContain('label="جارٍ تحميل مؤشرات');
    }
  });

  it("keeps the hand-rolled KPI skeleton blocks deleted", () => {
    for (const [path, view] of views) {
      expect(view(), path).not.toMatch(/Array\.from\(\{\s*length:\s*4\s*\}\)/);
      expect(view(), path).not.toContain("<Skeleton");
    }
  });
});
