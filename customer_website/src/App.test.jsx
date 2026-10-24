import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { VIEWS } from './contexts/ViewContext';

const mockUseAuth = vi.fn();
const mockUseView = vi.fn();

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('./hooks/useView', () => ({
  useView: () => mockUseView(),
}));

vi.mock('./services/socialService', () => ({
  socialService: {
    unreadCount: vi.fn(async () => ({ count: 0 })),
    notifications: vi.fn(async () => ({ unread_count: 0, notifications: [] })),
    markAllRead: vi.fn(async () => ({})),
    markOneRead: vi.fn(async () => ({})),
    markNotificationRead: vi.fn(async () => ({})),
  },
}));

vi.mock('./views/LandingView', () => ({ default: () => <div>Landing View</div> }));
vi.mock('./views/LoginView', () => ({ default: () => <div>Login View</div> }));
vi.mock('./views/RegisterView', () => ({ default: () => <div>Register View</div> }));
vi.mock('./views/HomeView', () => ({ default: () => <div>Home View</div> }));
vi.mock('./views/BarsView', () => ({ default: () => <div>Bars View</div> }));
vi.mock('./views/BarDetailView', () => ({ default: () => <div>Bar Detail View</div> }));
vi.mock('./views/EventsView', () => ({ default: () => <div>Events View</div> }));
vi.mock('./views/ReservationsView', () => ({ default: () => <div>Reservations View</div> }));
vi.mock('./views/PaymentsView', () => ({ default: () => <div>Payments View</div> }));
vi.mock('./views/ProfileView', () => ({ default: () => <div>Profile View</div> }));
vi.mock('./views/PaymentSuccessView', () => ({ default: () => <div>Payment Success View</div> }));
vi.mock('./views/PaymentFailedView', () => ({ default: () => <div>Payment Failed View</div> }));
vi.mock('./views/VerifyEmailView', () => ({ default: () => <div>Verify Email View</div> }));
vi.mock('./views/ResetPasswordView', () => ({ default: () => <div>Reset Password View</div> }));
vi.mock('./views/MapView', () => ({ default: () => <div>Map View</div> }));

describe('App view rendering', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      maintenance: { active: false, message: '' },
      isAuthenticated: false,
      logout: vi.fn(),
    });

    mockUseView.mockReturnValue({
      currentView: VIEWS.LOGIN,
      viewParams: {},
      transitioning: false,
      navigate: vi.fn(),
      goBack: vi.fn(),
      canGoBack: false,
    });
  });

  it('renders login view when current view is login', () => {
    render(<App />);
    expect(screen.getByText('Login View')).toBeInTheDocument();
  });

  it('renders payment success flow view', () => {
    mockUseView.mockReturnValue({
      currentView: VIEWS.PAYMENT_SUCCESS,
      viewParams: { ref: 'PAY-123' },
      transitioning: false,
      navigate: vi.fn(),
      goBack: vi.fn(),
      canGoBack: false,
    });

    render(<App />);
    expect(screen.getByText('Payment Success View')).toBeInTheDocument();
  });

  it('redirects unauthenticated home to landing view', () => {
    mockUseView.mockReturnValue({
      currentView: VIEWS.HOME,
      viewParams: {},
      transitioning: false,
      navigate: vi.fn(),
      goBack: vi.fn(),
      canGoBack: false,
    });

    render(<App />);
    expect(screen.getByText('Landing View')).toBeInTheDocument();
  });
});
