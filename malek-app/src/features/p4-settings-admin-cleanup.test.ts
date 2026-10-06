import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P4 — settings and admin cleanup contract', () => {
  it('keeps AI and password out of visible navigation while retaining compatibility routes', () => {
    const nav = read('../app/navigation/app-nav-items.ts');
    const routeTree = read('../app/router/route-tree.ts');
    expect(nav).not.toContain("'/ai-assistant'");
    expect(nav).not.toContain("'/change-password'");
    expect(routeTree).toContain("path: '/ai-assistant'");
    // Change password has a single canonical destination inside settings;
    // its legacy standalone route is retired.
    expect(routeTree).not.toContain("path: '/change-password'");
  });

  it('exposes AI as an independent global action and keeps automation in Settings governance', () => {
    const shell = read('../app/layout/app-shell.tsx');
    const action = read('../features/ai-assistant/ai-assistant-global-action.tsx');
    const routeTree = read('../app/router/route-tree.ts');
    expect(shell).toContain('AiAssistantGlobalAction');
    // The AI experience is a persistent floating panel (not a Dialog) opened
    // from the header action or the mobile dock via the canonical window event.
    expect(action).toContain('OPEN_AI_ASSISTANT_EVENT');
    expect(action).not.toContain('<Dialog');
    // The dismantled governance hub no longer owns automation: it is a
    // standalone canonical settings route that keeps the same authority.
    const idx = routeTree.indexOf("path: '/settings/automation'");
    expect(idx).toBeGreaterThanOrEqual(0);
    const automationRoute = routeTree.slice(
      routeTree.lastIndexOf('createRoute({', idx),
      routeTree.indexOf('});', idx) + 3,
    );
    expect(automationRoute).toContain("requirePermission('automation.view')");
  });
});
