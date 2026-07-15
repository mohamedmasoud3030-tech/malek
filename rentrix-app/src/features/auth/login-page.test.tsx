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

describe('LoginPage focused auth surface', () => {
  it('keeps brand and form together without the marketing panel', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('data-login-surface');
    expect(html).toContain('دخول آمن لمساحة العمل');
    expect(html).toContain('مرحباً بعودتك');
    expect(html).toContain('جلسة عمل محمية');
    expect(html).not.toContain('إدارة واضحة للأصول');
    expect(html).not.toContain('متابعة مالية أسرع');
    expect(html).not.toContain('قرارات أدق');
    expect(html).not.toContain('<aside');
  });
});
