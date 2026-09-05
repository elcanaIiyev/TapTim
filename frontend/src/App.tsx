import { useCallback, useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthModal } from './components/auth/AuthModal';
import type { AuthMode } from './components/auth/AuthModal';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { useAuth } from './context/AuthContext';
import { ADMIN_CONSOLE_PATH } from './lib/routes';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { CompatibilityPage } from './pages/CompatibilityPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { ProfilePage } from './pages/ProfilePage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { TeamsPage } from './pages/TeamsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransitionVeil } from './components/ui/TransitionVeil';

/** Restores the top of the page on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Sends a freshly authenticated account to whichever step the *server* said
 * comes next.
 *
 * Consumed once and then cleared, so someone who confirms their email and then
 * deliberately navigates to the events page is not dragged back to onboarding
 * on every render. The server owns the rule; this only obeys it.
 */
function PostAuthRedirect() {
  const { pendingStep, consumePendingStep } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!pendingStep) return;

    const destination =
      pendingStep === 'verify-email'
        ? '/verify-email'
        : pendingStep === 'onboarding'
          ? '/onboarding'
          : null;

    consumePendingStep();
    if (destination && pathname !== destination) navigate(destination, { replace: true });
  }, [pendingStep, consumePendingStep, navigate, pathname]);

  return null;
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authOpen, setAuthOpen] = useState(false);
  const { user, loggingOut } = useAuth();
  const navigate = useNavigate();

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  /**
   * The landing page's primary call to action.
   *
   * It used to open the signup modal unconditionally, so someone who had just
   * signed up and pressed "Find my team" was asked to create an account they
   * already had. What the button should do depends entirely on how far along
   * the person is, so it asks:
   *
   *   signed out        -> sign up
   *   profile unbuilt   -> finish the profile, because matching reads it
   *   ready             -> the events list, since teams are formed per event
   */
  const handleGetStarted = useCallback(() => {
    if (!user) {
      openAuth('signup');
      return;
    }
    // `next` is the server's own routing decision, returned by /api/auth/me.
    // Re-deriving it here from `emailVerified` and `onboardingCompleted` meant
    // this branch had to be kept in step with the server by hand — and it was
    // not: with email confirmation switched off, the server stopped asking for
    // it while this still sent people to a page they no longer needed.
    if (user.next === 'verify-email') {
      navigate('/verify-email');
      return;
    }
    navigate(user.next === 'dashboard' ? '/events' : '/onboarding');
  }, [user, openAuth, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <PostAuthRedirect />
      {/* Rendered above everything, so a sign-out never shows a half-cleared
          dashboard on its way to the landing page. */}
      {loggingOut && (
        <TransitionVeil message="Signing you out" sub="See you at the next one." />
      )}
      <Navbar onOpenAuth={openAuth} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onGetStarted={handleGetStarted} />} />
          <Route path="/events" element={<EventsPage />} />

          {/* Teams are formed per event, so creating and browsing them lives on
              the event's page. `/teams` is the read-only overview of the ones
              you are already on, and `/teams/:id` is a single roster with its
              gap report. */}
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:id" element={<TeamDetailPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/compatibility" element={<CompatibilityPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Registration continues here: confirm the address, then build the
              profile. `/onboarding` is the same screen as `/profile` with the
              guided tour running — walking someone through a copy of a page
              and then dropping them on the real one teaches the wrong layout. */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/onboarding" element={<ProfilePage tour />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Admin console. Reachable only from the Site/Admin switch in the
              nav bar, which renders for staff alone — it is in no footer and
              no sitemap, and the page renders the 404 for anyone who is not
              staff. The obscure path only keeps it off the radar; the access
              check that matters is server-side. */}
          <Route path={ADMIN_CONSOLE_PATH} element={<AdminConsolePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={closeAuth}
        onModeChange={setAuthMode}
      />
    </div>
  );
}
