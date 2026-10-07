// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicSupportPage } from './public-support-page';
import { SUPPORT_CONTACTS } from '@/lib/contact';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

const routeTreeSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../app/router/route-tree.ts'),
  'utf8',
);

afterEach(() => cleanup());

describe('public support route — usable while unauthenticated', () => {
  it('registers /support on the public root route, not the protected shell', () => {
    // The public support route must live directly under rootRoute (like
    // /login, /privacy, /terms) so an unauthenticated visitor can reach it.
    const marker = "path: '/support'";
    const index = routeTreeSource.indexOf(marker);
    expect(index).toBeGreaterThan(-1);

    const declaration = routeTreeSource.slice(Math.max(0, index - 120), index);
    expect(declaration).toContain('getParentRoute: () => rootRoute');

    // And it is registered in the route tree's public children (not inside
    // protectedRoute.addChildren).
    const protectedChildren = routeTreeSource.slice(routeTreeSource.indexOf('protectedRoute.addChildren('));
    expect(protectedChildren).not.toContain('publicSupportRoute');
  });

  it('renders the contact channels without any auth or Supabase dependency', () => {
    render(<PublicSupportPage />);

    // Static public contact info is present, proving a real usable destination.
    for (const contact of [SUPPORT_CONTACTS.oman, SUPPORT_CONTACTS.egypt, SUPPORT_CONTACTS.saudi]) {
      expect(screen.getByText(contact.number)).toBeInTheDocument();
    }
    for (const contact of SUPPORT_CONTACTS.emails) {
      expect(screen.getByText(contact.address)).toBeInTheDocument();
    }

    // The support surface links back to login, not deeper into the app.
    expect(screen.getByRole('link', { name: /العودة إلى تسجيل الدخول/i })).toHaveAttribute('href', '/login');
  });

  it('does not render the authenticated support-ticket intake on the public surface', () => {
    render(<PublicSupportPage />);
    // The heavy internal intake (needs a signed-in company member) stays on /help:
    // its submit button and "my requests" list are absent from the public surface.
    expect(screen.queryByRole('button', { name: /إرسال داخل MALEK/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/طلباتي الأخيرة/i)).not.toBeInTheDocument();
  });
});
