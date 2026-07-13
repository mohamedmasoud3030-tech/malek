import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    login: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }),
    },
  },
}));

describe('LoginPage runtime diagnostics', () => {
  it('renders a deployment warning when Supabase env is missing', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('دخول آمن لمساحة العمل');
    expect(html).toContain('مرحباً بعودتك');
    expect(html).toContain('جلسة عمل محمية');
  });
});
