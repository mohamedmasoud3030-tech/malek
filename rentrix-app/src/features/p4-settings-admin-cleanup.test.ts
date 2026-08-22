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
    expect(routeTree).toContain("path: '/change-password'");
    expect(routeTree).toContain("to: '/settings'");
  });

  it('exposes AI as an independent global action and keeps automation in Settings governance', () => {
    const shell = read('../app/layout/app-shell.tsx');
    const action = read('../features/ai-assistant/ai-assistant-global-action.tsx');
    const governance = read('../features/governance-hub/governance-hub-sections.ts');
    expect(shell).toContain('AiAssistantGlobalAction');
    // The AI experience is a persistent floating panel (not a Dialog) opened
    // from the header action or the mobile dock via the canonical window event.
    expect(action).toContain('OPEN_AI_ASSISTANT_EVENT');
    expect(action).not.toContain('<Dialog');
    expect(governance).toContain("id: 'automation'");
    expect(governance).toContain("permission: 'automation.view'");
  });
});
