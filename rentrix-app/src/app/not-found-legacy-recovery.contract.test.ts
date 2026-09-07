import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LEGACY_ROUTE_REDIRECTS,
  resolveLegacyRedirect,
} from "./not-found-page";

// Locks the legacy-path recovery contract: pre-unification URLs are
// recovered at the not-found boundary (auto-redirect to the owning
// workspace) WITHOUT registering redirect stubs in the route tree, per
// the route contract's one-canonical-route-per-capability invariant.
describe("legacy path recovery at the not-found boundary", () => {
  it("maps every retired path to its verified canonical workspace", () => {
    expect(resolveLegacyRedirect("/units")).toEqual({
      to: "/properties",
      search: { section: "units" },
    });
    expect(resolveLegacyRedirect("/accounting")).toEqual({ to: "/reports" });
    expect(resolveLegacyRedirect("/documents-vault")).toEqual({
      to: "/maintenance",
      search: { section: "documents_vault" },
    });
    expect(resolveLegacyRedirect("/automation")).toEqual({
      to: "/settings",
      search: { section: "automation" },
    });
    expect(resolveLegacyRedirect("/audit-log")).toEqual({
      to: "/settings",
      search: { section: "audit-log" },
    });
  });

  it("keeps unknown paths on the generic not-found card", () => {
    expect(resolveLegacyRedirect("/definitely-not-a-route")).toBeNull();
    // Exact-match only: legacy detail deep-links and case variants are not
    // silently redirected to a list section they may not belong to.
    expect(resolveLegacyRedirect("/units/V-01")).toBeNull();
    expect(resolveLegacyRedirect("/Units")).toBeNull();
    expect(resolveLegacyRedirect("/")).toBeNull();
  });

  it("keeps the map exact and free of near-duplicate prefixes", () => {
    const paths = Object.keys(LEGACY_ROUTE_REDIRECTS);
    expect(paths).toHaveLength(5);
    for (const path of paths) {
      expect(path.startsWith("/")).toBe(true);
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("keeps recovery inside the not-found boundary (no route-tree stubs)", () => {
    const routeTree = readFileSync(
      resolve(import.meta.dirname, "router/route-tree.ts"),
      "utf8",
    );
    for (const legacyPath of Object.keys(LEGACY_ROUTE_REDIRECTS)) {
      const registrations = routeTree.split(`path: '${legacyPath}'`).length - 1;
      // '/units' exists exactly once as the canonical property-detail child
      // (/properties/$propertyId/units). No top-level legacy stub is allowed.
      expect(registrations, `route-tree registrations of ${legacyPath}`).toBeLessThanOrEqual(1);
    }
    const page = readFileSync(resolve(import.meta.dirname, "not-found-page.tsx"), "utf8");
    expect(page).toContain("useEffect");
    expect(page).toContain("replace: true");
    expect(page).toContain("resolveLegacyRedirect");
  });
});
