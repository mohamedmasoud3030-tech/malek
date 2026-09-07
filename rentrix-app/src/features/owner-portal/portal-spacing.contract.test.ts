import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Locks the P2-C spacing completion: the read-only portals inherit
// PageLayout's canonical responsive content rhythm
// (space-y-2.5 sm:space-y-3 md:space-y-3.5 lg:space-y-5) instead of a flat
// space-y-4 override, matching every other canonical page.
const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("portal spacing contract", () => {
  it("keeps portal pages on the canonical PageLayout spacing scale", () => {
    for (const path of [
      "features/owner-portal/owner-portal-page.tsx",
      "features/tenant-portal/tenant-portal-page.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("<PageLayout");
      expect(source, `${path} must not override the canonical spacing`).not.toContain(
        'contentClassName="min-w-0 space-y-4"',
      );
    }
    const pageLayout = read("components/layout/page-layout.tsx");
    expect(pageLayout).toContain("space-y-2.5 sm:space-y-3 md:space-y-3.5");
  });
});
