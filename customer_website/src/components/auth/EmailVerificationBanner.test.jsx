import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmailVerificationBanner from './EmailVerificationBanner.jsx';
import { isEmailUnverified } from '../../utils/constants';

const mockNavigate = vi.fn();
const mockRefreshUser = vi.fn();
const mockUseAuth = vi.fn();
const mockPost = vi.fn();

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../hooks/useView', () => ({ useView: () => ({ navigate: mockNavigate }) }));
vi.mock('../../api/client', () => ({ default: { post: (...args) => mockPost(...args) } }));

describe('isEmailUnverified', () => {
  it('flags explicit negative signals', () => {
    expect(isEmailUnverified({ isVerified: false })).toBe(true);
    expect(isEmailUnverified({ email_verified: false })).toBe(true);
    expect(isEmailUnverified({ is_verified: false })).toBe(true);
    expect(isEmailUnverified({ is_verified: 0 })).toBe(true);
    expect(isEmailUnverified({ verified: 'UNVERIFIED' })).toBe(true);
    expect(isEmailUnverified({ verified: 'unverified' })).toBe(true);
  });

  it('stays quiet for verified users and unknown shapes', () => {
    expect(isEmailUnverified({ isVerified: true })).toBe(false);
    expect(isEmailUnverified({ email_verified: true })).toBe(false);
    expect(isEmailUnverified({ is_verified: 1 })).toBe(false);
    expect(isEmailUnverified({ is_verified: true })).toBe(false);
    expect(isEmailUnverified({ verified: 'VERIFIED' })).toBe(false);
    expect(isEmailUnverified({})).toBe(false);
    expect(isEmailUnverified(null)).toBe(false);
    expect(isEmailUnverified(undefined)).toBe(false);
  });
});

describe('EmailVerificationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, refreshUser: mockRefreshUser });
    const { container } = render(<EmailVerificationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for verified users', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'a@b.c', isVerified: true, verified: 'VERIFIED', is_verified: true },
      isAuthenticated: true,
      refreshUser: mockRefreshUser,
    });
    const { container } = render(<EmailVerificationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the reminder and resends on demand', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'pending@example.com', isVerified: false, verified: 'UNVERIFIED' },
      isAuthenticated: true,
      refreshUser: mockRefreshUser,
    });
    mockPost.mockResolvedValueOnce({ data: { message: 'Verification email sent!' } });

    render(<EmailVerificationBanner />);
    expect(
      screen.getByText('Verify your email to keep your account secure.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'pending@example.com' });
    });
    expect(await screen.findByText('Verification email sent!')).toBeInTheDocument();
  });

  it('surfaces the backend cooldown instead of spamming', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'pending@example.com', is_verified: 0 },
      isAuthenticated: true,
      refreshUser: mockRefreshUser,
    });
    mockPost.mockRejectedValueOnce({
      response: { data: { code: 'RESEND_COOLDOWN', wait_seconds: 42 } },
    });

    render(<EmailVerificationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));
    expect(await screen.findByText('Please wait 42s before resending.')).toBeInTheDocument();
  });

  it('routes to the code entry screen', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'pending@example.com', verified: 'UNVERIFIED' },
      isAuthenticated: true,
      refreshUser: mockRefreshUser,
    });

    render(<EmailVerificationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /enter code/i }));
    expect(mockNavigate).toHaveBeenCalledWith('verify_email', { email: 'pending@example.com' });
  });

  it('dismisses for the session but returns for a new one', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'pending@example.com', email_verified: false },
      isAuthenticated: true,
      refreshUser: mockRefreshUser,
    });

    const { rerender } = render(<EmailVerificationBanner />);
    expect(
      screen.getByText('Verify your email to keep your account secure.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss email verification reminder/i }));
    expect(
      screen.queryByText('Verify your email to keep your account secure.')
    ).not.toBeInTheDocument();

    // Same session, same account: stays dismissed.
    rerender(<EmailVerificationBanner />);
    expect(
      screen.queryByText('Verify your email to keep your account secure.')
    ).not.toBeInTheDocument();

    // New session (different account): the reminder returns.
    mockUseAuth.mockReturnValue({
      user: { email: 'other@example.com', email_verified: false },
      isAuthenticated: true,
      refreshUser: mockRefreshUser,
    });
    rerender(<EmailVerificationBanner />);
    expect(
      screen.getByText('Verify your email to keep your account secure.')
    ).toBeInTheDocument();
  });
});
