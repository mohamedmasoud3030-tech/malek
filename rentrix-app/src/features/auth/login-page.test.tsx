// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { LoginPage } from './login-page';

const mockLogin = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string } & Record<string, unknown>) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ login: mockLogin }) }));
vi.mock('@/lib/runtime-diagnostics', () => ({ getEnvDiagnostics: () => [] }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('LoginPage — minimal SaaS contract', () => {
  afterEach(() => cleanup());

  it('renders the canonical brand, focused login copy and no promotional panel', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('data-login-surface');
    expect(html).toContain('data-login-card');
    expect(html).toContain('src="/malek-mark.svg"');
    expect(html).toContain('data-malek-brand-lockup');
    expect(html).toContain('aria-label="MALEK"');
    expect(html).toContain('كل أملاكك في مكان واحد');
    expect(html).not.toContain('data-command-center-panel');
  });

  it('keeps accessible field contracts and safe-area layout', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('<h1 class="sr-only">تسجيل الدخول إلى MALEK</h1>');
    expect(html).toContain('for="login-email"');
    expect(html).toContain('id="login-email"');
    expect(html).toContain('for="login-password"');
    expect(html).toContain('id="login-password"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('safe-top-app');
    expect(html).toContain('safe-bottom-overlay');
    expect(html).toContain('نسيت كلمة المرور؟');
    expect(html).toContain('/forgot-password');
  });

  it('keeps support compact until requested', () => {
    render(<LoginPage />);
    const supportButton = screen.getByRole('button', { name: /تحتاج مساعدة؟ تواصل معنا/i });
    expect(supportButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('+968 9192 8186')).not.toBeInTheDocument();
    fireEvent.click(supportButton);
    expect(screen.getByText('+968 9192 8186')).toBeInTheDocument();
    expect(supportButton).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('LoginPage — interaction behaviour', () => {
  beforeEach(() => { vi.clearAllMocks(); mockLogin.mockResolvedValue(undefined); });
  afterEach(() => cleanup());

  function setup() { return render(<div dir="rtl"><LoginPage /></div>); }

  it('submits credentials once', async () => {
    setup();
    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), { target: { value: 'test@example.com' } });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), { target: { value: 'secret123' } });
    fireEvent.submit(screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!);
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'secret123'));
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('submits from Enter in the password field', async () => {
    setup();
    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), { target: { value: 'enter@example.com' } });
    const password = screen.getByLabelText('كلمة المرور', { selector: 'input' });
    fireEvent.input(password, { target: { value: 'secret123' } });
    fireEvent.keyDown(password, { key: 'Enter' });
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('enter@example.com', 'secret123'));
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('prevents double-submit while login is pending', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockImplementation(() => new Promise<void>((resolve) => { resolveLogin = resolve; }));
    setup();
    fireEvent.input(screen.getByLabelText('البريد الإلكتروني', { selector: 'input' }), { target: { value: 'x@y.com' } });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), { target: { value: 'pw' } });
    const form = screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('button', { name: /جارٍ التحقق.../i })).toBeDisabled());
    expect(mockLogin).toHaveBeenCalledTimes(1);
    resolveLogin();
    await waitFor(() => expect(screen.getByRole('button', { name: /تسجيل الدخول/i })).not.toBeDisabled());
  });

  it('shows a safe generic error and clears it on edit', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid login credentials'));
    setup();
    const email = screen.getByLabelText('البريد الإلكتروني', { selector: 'input' });
    fireEvent.input(email, { target: { value: 'bad@x.com' } });
    fireEvent.input(screen.getByLabelText('كلمة المرور', { selector: 'input' }), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByRole('button', { name: /تسجيل الدخول/i }).closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('تعذر تسجيل الدخول'));
    expect(screen.getByRole('alert')).not.toHaveTextContent('Invalid login credentials');
    fireEvent.input(email, { target: { value: 'new@x.com' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    setup();
    const password = screen.getByLabelText('كلمة المرور', { selector: 'input' });
    fireEvent.click(screen.getByRole('button', { name: /إظهار كلمة المرور/i }));
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: /إخفاء كلمة المرور/i }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('reports Caps Lock state without blocking entry', () => {
    setup();
    const password = screen.getByLabelText('كلمة المرور', { selector: 'input' });
    const event = new KeyboardEvent('keyup', { key: 'A', bubbles: true });
    Object.defineProperty(event, 'getModifierState', {
      value: (key: string) => key === 'CapsLock',
    });
    fireEvent(password, event);
    expect(screen.getByRole('status')).toHaveTextContent('Caps Lock مفعّل');
  });

  /**
   * WP-06 / GAP-020 regression.
   *
   * The password visibility toggle rendered as a 40x40 box, which failed the
   * hardened >=44x44 touch-target gate in the Browser Readiness desktop shard
   * (the login surface is exercised at 320/375/430/768 widths). Both
   * dimensions are asserted so a partial regression cannot slip through.
   */
  it('gives the password visibility toggle a >=44px touch target on both axes', () => {
    setup();
    const toggle = screen.getByRole('button', { name: /إظهار كلمة المرور/i });
    expect(toggle.className).toContain('size-11');
    expect(toggle.className).toContain('min-h-11');
    expect(toggle.className).toContain('min-w-11');
    expect(toggle.className).not.toContain('size-10');
  });

  it('keeps every interactive login control on the 44px touch grid', () => {
    const { container } = render(<LoginPage />);
    const undersized = Array.from(container.querySelectorAll<HTMLElement>('button, a[href]'))
      .filter((el) => /(^|\s)(size|h|w)-(?:[0-9]|10)(\s|$)/.test(el.className))
      .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName);
    expect(undersized).toEqual([]);
  });
});
