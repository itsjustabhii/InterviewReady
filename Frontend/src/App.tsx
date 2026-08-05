import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import Layout from './components/layout/Layout';
import { PageLoader } from './components/ui/Loader';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages
const HomePage = lazy(() => import('./pages/Home'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const InterviewersPage = lazy(() => import('./pages/interviewers/InterviewersPage'));
const InterviewerDetailsPage = lazy(() => import('./pages/interviewers/InterviewerDetailsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const BookingCalendarPage = lazy(() => import('./pages/booking/BookingCalendar'));
const CheckoutPage = lazy(() => import('./pages/checkout/CheckoutPage'));
const InterviewRoomPage = lazy(() => import('./pages/room/InterviewRoomPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeInit />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { borderRadius: '12px', fontSize: '14px' },
            }}
          />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public pages with layout */}
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/interviewers" element={<InterviewersPage />} />
                <Route path="/interviewers/:id" element={<InterviewerDetailsPage />} />
                <Route path="/subscriptions" element={<SubscriptionsPage />} />

                {/* Auth-required */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/bookings" element={<ProfilePage />} />
                  <Route path="/booking" element={<BookingCalendarPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                </Route>

                {/* Admin */}
                <Route element={<ProtectedRoute requiredRole="admin" />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
              </Route>

              {/* Auth pages (no main layout) */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Interview room (full screen, no layout) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/room/:id" element={<InterviewRoomPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
    </ErrorBoundary>
  );
}
