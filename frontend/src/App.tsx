import { useCallback, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AuthModal } from './components/auth/AuthModal';
import type { AuthMode } from './components/auth/AuthModal';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { ADMIN_CONSOLE_PATH } from './lib/routes';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { CompatibilityPage } from './pages/CompatibilityPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { NotFoundPage } from './pages/NotFoundPage';

/** Restores the top of the page on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authOpen, setAuthOpen] = useState(false);

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar onOpenAuth={openAuth} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onGetStarted={() => openAuth('signup')} />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/compatibility" element={<CompatibilityPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Admin console. Reachable only from the Site/Admin switch in the
              nav bar, which renders for admins alone — it is in no footer and
              no sitemap, and the page renders the 404 for anyone who is not an
              admin. The obscure path only keeps it off the radar; the access
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
