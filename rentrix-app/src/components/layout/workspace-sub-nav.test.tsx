// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { WorkspaceSubNav } from './workspace-sub-nav';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
    useLocation: () => ({ pathname: '/properties' }),
  };
});

let mockRole = 'MANAGER';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: {
      userId: 'user-1',
      email: 'manager@malik.test',
      role: mockRole,
    },
  }),
}));

describe('WorkspaceSubNav component contract — deprecated (IA simplification 2026-08)', () => {
  beforeEach(() => {
    mockRole = 'MANAGER';
  });

  it('is deprecated and renders no duplicate secondary navigation (returns null)', () => {
    const html = renderToStaticMarkup(<WorkspaceSubNav rootPath="/properties" />);

    // Removed: Sidebar → Workspace → SubNav → SectionTabs → Page (excessive drilling).
    // Hubs now use the single SectionTabs secondary nav; this stub must render nothing.
    expect(html).toBe('');
    expect(html).not.toContain('الرئيسية للمساحة');
  });

  it('remains a no-op for every hub root (no permissioned links rendered)', () => {
    mockRole = 'USER';
    const html = renderToStaticMarkup(<WorkspaceSubNav rootPath="/settings" />);

    expect(html).toBe('');
    expect(html).not.toContain('href="/system"');
    expect(html).not.toContain('href="/audit-log"');
  });
});
