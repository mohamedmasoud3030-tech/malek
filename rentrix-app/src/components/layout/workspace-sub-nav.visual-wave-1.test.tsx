// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: ReactNode; to: string } & Record<string, unknown>) => (
      <a href={to} {...props}>{children}</a>
    ),
    useLocation: () => ({ pathname: '/properties' }),
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: { userId: 'manager-1', email: 'manager@malek.test', role: 'MANAGER' },
  }),
}));

import { WorkspaceSubNav } from './workspace-sub-nav';

describe('Visual Wave 1 — workspace sub-navigation (deprecated 2026-08)', () => {
  it('is removed as duplicate navigation — renders nothing and has no scroll/ring classes', () => {
    const html = renderToStaticMarkup(<WorkspaceSubNav rootPath="/properties" />);

    // IA simplification removed WorkspaceSubNav duplication (kept SectionTabs as single secondary nav)
    expect(html).toBe('');
    expect(html).not.toContain('min-h-11');
    expect(html).not.toContain('focus-visible:ring-4');
  });
});
