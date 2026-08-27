import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoginForm, SignupForm } from '../components/auth/AuthForms';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { useAuth } from '../context/AuthContext';

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Container className="flex min-h-[70vh] items-center py-14">
      <div className="w-full max-w-md">
        <div>
          <span className="type-label text-accent-text">Account</span>
          <h1 className="type-section mt-4 text-ink-950 dark:text-white">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{subtitle}</p>
        </div>

        <Card className="mt-8 sm:p-8">{children}</Card>

        <p className="mt-6 text-sm text-ink-600 dark:text-ink-400">{footer}</p>
      </div>
    </Container>
  );
}

export function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up your team search where you left off."
      footer={
        <>
          No account yet?{' '}
          <Link to="/signup" className="font-bold uppercase tracking-wide text-accent-text underline decoration-2 underline-offset-4 hover:text-flame-700 dark:hover:text-flame-400">
            Create one
          </Link>
        </>
      }
    >
      <LoginForm onSuccess={() => navigate('/')} />
    </AuthShell>
  );
}

export function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Join TapTim"
      subtitle="Tell us your role and skills, and we will start matching you with teammates."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-bold uppercase tracking-wide text-accent-text underline decoration-2 underline-offset-4 hover:text-flame-700 dark:hover:text-flame-400">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm onSuccess={() => navigate('/')} />
    </AuthShell>
  );
}
