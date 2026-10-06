import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Locks the P1-A page-level async-state consolidation (PR #1816): these
// seven pages/dossiers must keep routing loading/error/empty through
// `AsyncContentState`, and must never regress to raw page-level
// `<LoadingState` / `<ErrorState` / `DataErrorScreen` early-returns.
// (Suspense lazy-chunk fallbacks remain a sanctioned separate mechanism.)
const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const consolidatedPageFiles: readonly string[] = [
  "features/admin-support/admin-support-page.tsx",
  "features/audit/components/audit-log-view.tsx",
  "features/system/components/data-integrity-view.tsx",
  "features/lands/components/LandDossier.tsx",
  "features/people/components/PersonDossier.tsx",
  "features/financials/receipts/receipt-detail-page.tsx",
  "features/settings/settings-page.tsx",
];

const forbiddenRawPageStateComponents = [
  "<LoadingState",
  "<ErrorState",
  "DataErrorScreen",
] as const;

describe("page-level async state contract", () => {
  it("routes the consolidated pages through AsyncContentState", () => {
    for (const path of consolidatedPageFiles) {
      expect(read(path), path).toContain("<AsyncContentState");
    }
  });

  it("keeps raw loading/error components out of the consolidated pages", () => {
    for (const path of consolidatedPageFiles) {
      const source = read(path);
      for (const forbidden of forbiddenRawPageStateComponents) {
        expect(source, `${path} must not contain ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });
});
