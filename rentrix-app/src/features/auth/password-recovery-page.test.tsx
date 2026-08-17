// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string } & Record<string, unknown>) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

import { ForgotPasswordPage, ResetPasswordPage } from './password-recovery-page';

describe('password recovery pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });
  afterEach(() => cleanup());

  it('returns the same neutral success state after requesting recovery', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.input(screen.getByLabelText('البريد الإلكتروني'), { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'إرسال رابط الاستعادة' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('راجع بريدك الإلكتروني'));
    expect(screen.getByRole('status')).toHaveTextContent('إذا كان البريد مرتبطاً بحساب');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }));
  });

  it('shows an explicit recovery path for an invalid or expired link', async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('رابط الاستعادة غير صالح أو منتهي'));
    expect(screen.getByRole('link', { name: 'طلب رابط جديد' })).toHaveAttribute('href', '/forgot-password');
  });

  it('validates and updates a password only with a recovery session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    render(<ResetPasswordPage />);

    await waitFor(() => expect(screen.getByLabelText('كلمة المرور الجديدة')).toBeInTheDocument());
    fireEvent.input(screen.getByLabelText('كلمة المرور الجديدة'), { target: { value: 'new-password' } });
    fireEvent.input(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'تحديث كلمة المرور' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('تم تحديث كلمة المرور'));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(auth.signOut).toHaveBeenCalled();
  });
});
