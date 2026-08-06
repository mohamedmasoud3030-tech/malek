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

describe('Visual Wave 1 — workspace sub-navigation', () => {
  it('keeps horizontally scrollable destinations touch-safe with an explicit focus ring', () => {
    const html = renderToStaticMarkup(<WorkspaceSubNav rootPath="/properties" />);

    expect(html).toContain('min-h-11');
    expect(html).toContain('focus-visible:ring-4');
    expect(html).toContain('focus-visible:ring-primary/20');
  });
});
