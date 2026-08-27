import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("admin/support UI safety contract", () => {
  it("registers a permission-guarded route and permission-aware navigation", () => {
    const routes = read("app/router/route-tree.ts");
    const contract = read("app/navigation/route-contract.ts");
    expect(routes).toContain("path: '/admin-support'");
    expect(routes).toContain(
      "beforeLoad: requirePermission('support.operations.view')",
    );
    expect(contract).toContain("canonical: '/admin-support'");
    expect(contract).toContain("permission: 'support.operations.view'");
  });

  it("uses Arabic/RTL design primitives and explicit accessible states", () => {
    const page = read("features/admin-support/admin-support-page.tsx");
    const loadingState = read("components/ui/loading-state.tsx");
    expect(page).toContain('dir="rtl"');
    expect(page).toContain('lang="ar"');
    expect(page).toContain("<PageLayout");
    expect(page).toContain("<AccessDenied");
    expect(page).toContain("<LoadingState");
    expect(loadingState).toContain('role="status"');
    expect(page).toContain('aria-labelledby="support-queue-title"');
    expect(page).toContain("سبب داخلي إلزامي");
    expect(page).toContain("مقترح تغيير وصول — غير منفذ");
  });

  it("contains no impersonation, export, bulk or financial mutation implementation", () => {
    const page = read("features/admin-support/admin-support-page.tsx");
    const service = read("features/admin-support/admin-support-service.ts");
    for (const forbidden of [
      "impersonate",
      "service_role",
      ".delete(",
      "refund",
      "void_receipt",
      "journal",
    ]) {
      expect(`${page}\n${service}`).not.toContain(forbidden);
    }
    expect(page).toContain("لا انتحال أو تصدير أو إجراءات مالية");
  });

  it("retires direct browser user-role updates", () => {
    const service = read("features/governance-hub/user-roles-service.ts");
    const workspace = read(
      "features/governance-hub/components/UserRolesWorkspace.tsx",
    );
    expect(service).not.toContain(".from('users').update");
    expect(service).not.toContain("updateGovernedUserAccess");
    // Roles display read-only; access changes flow through governed
    // permission requests, never direct browser edits.
    expect(workspace).toContain("الدور معروض للمراجعة فقط");
    expect(workspace).toContain("طلبات الصلاحية المعتمدة");
    expect(workspace).not.toContain("updateGovernedUserAccess");
  });
});
