// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { LoginPage } from './login-page';

const mockLogin = vi.fn();
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ login: mockLogin }) }));
vi.mock('@/lib/runtime-diagnostics', () => ({ getEnvDiagnostics: () => [] }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('LoginPage — minimal SaaS contract', () => {
  afterEach(() => cleanup());

  it('renders the canonical brand, focused login copy and no promotional panel', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('data-login-surface');
    expect(html).toContain('data-login-card');
    expect(html).toContain('src="/malek-lockup.svg"');
    expect(html).toContain('مرحبًا بعودتك');
    expect(html).toContain('سجّل الدخول إلى مساحة عملك في MALEK');
    expect(html).not.toContain('كل أملاكك في مكان واحد');
    expect(html).not.toContain('data-command-center-panel');
  });

  it('keeps accessible field contracts and safe-area layout', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('for="login-email"');
    expect(html).toContain('id="login-email"');
    expect(html).toContain('for="login-password"');
    expect(html).toContain('id="login-password"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('safe-top-app');
    expect(html).toContain('safe-bottom-overlay');
    expect(html).not.toContain('نسيت');
    expect(html).not.toContain('reset-password');
  });

  it('keeps support compact until requested', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /تحتاج مساعدة؟ تواصل معنا/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('+968 9192 8186')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /تحتاج مساعدة؟ تواصل معنا/i }));
    expect(screen.getByText('+968 9192 8186')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تحتاج مساعدة؟ تواصل معنا/i })).toHaveAttribute('aria-expanded', 'true');
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
    fireEvent.keyUp(password, { getModifierState: (key: string) => key === 'CapsLock' });
    expect(screen.getByRole('status')).toHaveTextContent('Caps Lock مفعّل');
  });
});
