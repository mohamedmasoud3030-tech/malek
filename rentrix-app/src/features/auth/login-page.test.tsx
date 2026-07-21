// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { LoginPage } from './login-page';

/* ── Mocks (shared) ─────────────────────────────────── */

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    login: mockLogin,
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

vi.mock('@/lib/runtime-diagnostics', () => ({
  getEnvDiagnostics: () => [],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/* ── Static SSR contract (structural, no DOM needed) ── */

describe('LoginPage — structural contract', () => {
  it('renders brand, form heading, and security footer together', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('data-login-surface');
    expect(html).toContain('Rentrix');
    expect(html).toContain('مرحباً بعودتك');
    expect(html).toContain('دخول آمن لمساحة العمل');
    expect(html).toContain('جلسة عمل محمية');
  });

  it('does NOT contain marketing-panel copy from previous iterations', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).not.toContain('إدارة واضحة للأصول');
    expect(html).not.toContain('متابعة مالية أسرع');
    expect(html).not.toContain('قرارات أدق');
  });

  it('has correct autoComplete attributes on email and password', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="current-password"');
  });

  it('links labels to inputs via htmlFor/id', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('for="login-email"');
    expect(html).toContain('id="login-email"');
    expect(html).toContain('for="login-password"');
    expect(html).toContain('id="login-password"');
  });

  it('has a password visibility toggle button with aria-label', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('إظهار كلمة المرور');
  });

  it('does NOT contain a forgot-password link (no such flow exists)', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).not.toContain('نسيت');
    expect(html).not.toContain('reset-password');
  });
});

/* ── Interaction tests (DOM + fireEvent) ────────────── */

describe('LoginPage — interaction behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  function setup() {
    return render(
      <div dir="rtl">
        <LoginPage />
      </div>,
    );
  }

  it('calls login with the entered email and password on submit', async () => {
    setup();

    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), {
      target: { value: 'test@example.com' },
    });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), {
      target: { value: 'secret123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'secret123');
    });
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('submits on Enter key in the password field', async () => {
    setup();

    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), {
      target: { value: 'a@b.com' },
    });
    const pw = screen.getByLabelText('كلمة المرور', { selector: 'input' });
    fireEvent.input(pw, { target: { value: 'pw' } });
    fireEvent.submit(pw.closest('form')!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'pw');
    });
  });

  it('disables the submit button while login is in progress (prevents double-submit)', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockImplementation(
      () => new Promise<void>((resolve) => { resolveLogin = resolve; }),
    );

    setup();

    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), {
      target: { value: 'x@y.com' },
    });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), {
      target: { value: 'pw' },
    });

    const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /جارٍ تسجيل الدخول/i })).toBeDisabled();
    });

    expect(mockLogin).toHaveBeenCalledTimes(1);

    resolveLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /تسجيل الدخول/i })).not.toBeDisabled();
    });
  });

  it('shows a safe generic error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('بيانات الدخول غير صحيحة'));

    setup();

    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), {
      target: { value: 'bad@x.com' },
    });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), {
      target: { value: 'wrong' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const form = screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!;
    expect(form.getAttribute('aria-describedby')).toBe('login-error');
  });

  it('toggles password visibility', () => {
    setup();

    const pwInput = screen.getByLabelText('كلمة المرور', { selector: 'input' });
    expect(pwInput).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: /إظهار كلمة المرور/i });
    fireEvent.click(toggle);

    expect(pwInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /إخفاء كلمة المرور/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /إخفاء كلمة المرور/i }));
    expect(pwInput).toHaveAttribute('type', 'password');
  });

  it('clears form error when user starts typing again', async () => {
    mockLogin.mockRejectedValueOnce(new Error('بيانات الدخول غير صحيحة'));

    setup();

    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), {
      target: { value: 'e@x.com' },
    });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), {
      target: { value: 'pw' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), {
      target: { value: 'new@x.com' },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/* ── Layout & accessibility contract ──────────────── */

describe('LoginPage — layout and accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with dir=rtl for Arabic RTL layout', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('dir="rtl"');
  });

  it('renders the login surface container', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('data-login-surface');
  });

  it('uses safe area utility classes for notched devices', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('safe-top-app');
    expect(html).toContain('safe-bottom-overlay');
  });

  it('caps-lock-warning is not rendered initially (only on keyup detection)', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).not.toContain('caps-lock-warning');
  });

  it('password input has aria-invalid available for error state linking', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    // In initial state (no error), aria-invalid is not set
    expect(html).not.toContain('aria-invalid');
  });
});

/* ── Command-Center Visual Panel contract ───────────── */

describe('CommandCenterPanel — presentation only', () => {
  it('renders without crashing and contains preview metric labels', async () => {
    const { CommandCenterPanel } = await import('./command-center-panel');
    const html = renderToStaticMarkup(<CommandCenterPanel />);

    expect(html).not.toContain('<aside');
    expect(html).toContain('مركز قيادة Rentrix');
    expect(html).toContain('وحدة');
    expect(html).toContain('عقد');
    expect(html).toContain('نسبة الإشغال');
  });

  it('uses inline SVG, no <img> tags with external src', async () => {
    const { CommandCenterPanel } = await import('./command-center-panel');
    const html = renderToStaticMarkup(<CommandCenterPanel />);

    expect(html).not.toContain('<img');
  });

  it('contains the preview data disclaimer text', async () => {
    const { CommandCenterPanel } = await import('./command-center-panel');
    const html = renderToStaticMarkup(<CommandCenterPanel />);

    expect(html).toContain('بيانات توضيحية فقط');
  });
});
