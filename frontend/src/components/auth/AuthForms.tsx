import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api';
import type { ProviderStatus } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { useSubmitState } from './form-state';

export { SignupWizard } from './SignupWizard';

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[var(--radius-soft-sm)] border border-signal-bad bg-signal-bad px-4 py-3 text-sm font-medium text-white"
    >
      {message}
    </div>
  );
}

interface FormProps {
  onSuccess?: () => void;
  onSwitch?: () => void;
}

export function LoginForm({ onSuccess, onSwitch }: FormProps) {
  const { login } = useAuth();
  const state = useSubmitState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    authApi
      .providers()
      .then((list) => setProviders(list.filter((entry) => entry.configured)))
      .catch(() => {
        // Email sign-in still works; a missing provider list is not worth saying.
      });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    state.reset();
    state.setSubmitting(true);
    try {
      await login({ email, password });
      onSuccess?.();
    } catch (error) {
      state.handleFailure(error);
    } finally {
      state.setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {state.formError && <FormError message={state.formError} />}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state.fieldErrors.email}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={state.fieldErrors.password}
          required
        />

        <Button type="submit" className="w-full" size="lg" disabled={state.submitting}>
          {state.submitting ? <Spinner /> : null}
          {state.submitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>

      {providers.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
            <span className="type-label text-ink-500 dark:text-ink-400">or</span>
            <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
          </div>

          <div className="space-y-2.5">
            {providers.map((provider) => (
              <Button
                key={provider.provider}
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => authApi.startOAuth(provider.provider)}
              >
                Continue with {provider.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {onSwitch && (
        <p className="text-center text-sm text-ink-600 dark:text-ink-400">
          No account yet?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="cursor-pointer font-bold text-accent-text underline decoration-2 underline-offset-4 hover:text-iris-700 dark:hover:text-iris-400"
          >
            Create one
          </button>
        </p>
      )}
    </div>
  );
}
