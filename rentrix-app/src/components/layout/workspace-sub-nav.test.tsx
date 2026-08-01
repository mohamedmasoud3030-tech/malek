// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { WorkspaceSubNav } from './workspace-sub-nav';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/properties' }),
}));

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

describe('WorkspaceSubNav component contract', () => {
  beforeEach(() => {
    mockRole = 'MANAGER';
  });

  it('renders secondary workspace navigation items for authorized users without cluttering top-level sidebar', () => {
    const html = renderToStaticMarkup(<WorkspaceSubNav rootPath="/properties" />);

    expect(html).toContain('الرئيسية للمساحة');
    expect(html).toContain('href="/owners"');
    expect(html).toContain('href="/units"');
    expect(html).toContain('href="/lands"');
  });

  it('hides permissioned sub-workspaces when authorization lacks access', () => {
    mockRole = 'USER';
    const html = renderToStaticMarkup(<WorkspaceSubNav rootPath="/settings" />);

    expect(html).not.toContain('href="/system"');
    expect(html).not.toContain('href="/audit-log"');
  });
});
