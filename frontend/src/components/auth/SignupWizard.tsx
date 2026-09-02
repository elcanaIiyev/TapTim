import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError, authApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { ProviderStatus } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { PASSWORD_RULES, useSubmitState } from './form-state';

/**
 * Signup, split into three short steps.
 *
 * Research on registration forms is consistent that five fields is about the
 * ceiling before people abandon, and the old single form asked for name, email,
 * password, role and skills at once. Splitting it means each screen asks one
 * question, the email is checked for availability *before* anyone invests in
 * choosing a password, and the role and skills move to the profile builder
 * where there is room to explain them.
 */

type Step = 'identity' | 'credentials' | 'password';

const STEPS: Step[] = ['identity', 'credentials', 'password'];

const STEP_COPY: Record<Step, { eyebrow: string; title: string; blurb: string }> = {
  identity: {
    eyebrow: 'Step 1 of 3',
    title: 'What should we call you?',
    blurb: 'This is the name teammates will see on your profile.',
  },
  credentials: {
    eyebrow: 'Step 2 of 3',
    title: 'How do you want to sign in?',
    blurb: 'Use an email address, or connect an account you already have.',
  },
  password: {
    eyebrow: 'Step 3 of 3',
    title: 'Secure your account',
    blurb: 'One password. Make it a good one — we will check it as you type.',
  },
};

function StepPips({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {STEPS.map((step, position) => (
        <span
          key={step}
          className="pip"
          data-state={position < index ? 'done' : position === index ? 'active' : 'todo'}
        />
      ))}
    </div>
  );
}

function ProviderButtons({ providers }: { providers: ProviderStatus[] }) {
  if (providers.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {providers.map((provider) => (
        <Button
          key={provider.provider}
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={!provider.configured}
          // A provider with no credentials on the server would bounce straight
          // back with an error, so it is shown disabled and labelled instead of
          // being offered as if it works.
          title={
            provider.configured
              ? `Continue with ${provider.label}`
              : `${provider.label} sign-in is not set up on this server yet`
          }
          onClick={() => authApi.startOAuth(provider.provider)}
        >
          Continue with {provider.label}
          {!provider.configured && (
            <span className="type-label ml-1 text-ink-500 dark:text-ink-400">soon</span>
          )}
        </Button>
      ))}
    </div>
  );
}

export function SignupWizard({
  onSuccess,
  onSwitch,
}: {
  /** Closes the surrounding modal, when the wizard is rendered inside one. */
  onSuccess?: () => void;
  onSwitch?: () => void;
}) {
  const { signup } = useAuth();
  const state = useSubmitState();

  const [step, setStep] = useState<Step>('identity');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  const index = STEPS.indexOf(step);
  const copy = STEP_COPY[step];

  useEffect(() => {
    authApi.providers().then(setProviders).catch(() => {
      // The email path still works; there is nothing useful to say about a
      // provider list that could not be fetched.
    });
  }, []);

  const identityValid = firstName.trim().length >= 2;
  const satisfied = PASSWORD_RULES.filter((rule) => rule.test(password));
  const passwordValid = satisfied.length === PASSWORD_RULES.length;

  /** Step 2 → 3, gated on the address actually being free. */
  async function continueFromEmail(event: FormEvent) {
    event.preventDefault();
    state.reset();
    setCheckingEmail(true);
    try {
      const available = await authApi.checkEmail(email);
      if (!available) {
        state.setFieldErrors({ email: 'An account with this email already exists.' });
        return;
      }
      setStep('password');
    } catch (error) {
      // A malformed address comes back as a field issue; anything else is ours.
      if (error instanceof ApiError && error.issues.length > 0) state.handleFailure(error);
      else state.setFieldErrors({ email: 'We could not check that address. Try again.' });
    } finally {
      setCheckingEmail(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    state.reset();
    state.setSubmitting(true);
    try {
      await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email,
        password,
      });
      // The auth context routes on the server's `next` step, so the wizard
      // does not decide *where* to go — but when it is rendered inside the
      // auth modal, that modal still has to be dismissed. Without this the
      // dialog sat on top of the confirmation page it had just navigated to.
      onSuccess?.();
    } catch (error) {
      state.handleFailure(error);
      // A duplicate email is only detectable at submit if someone registered it
      // between step 2 and now — send them back to the field that is wrong.
      if (error instanceof ApiError && error.status === 409) setStep('credentials');
    } finally {
      state.setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="type-label text-accent-text">{copy.eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold text-ink-900 dark:text-white">{copy.title}</h2>
        </div>
        <StepPips index={index} />
      </div>

      <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{copy.blurb}</p>

      {state.formError && (
        <div
          role="alert"
          className="rounded-[var(--radius-soft-sm)] border border-signal-bad bg-signal-bad px-4 py-3 text-sm font-medium text-white"
        >
          {state.formError}
        </div>
      )}

      {step === 'identity' && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (identityValid) setStep('credentials');
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              autoComplete="given-name"
              placeholder="Ada"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={state.fieldErrors.firstName}
              autoFocus
              required
            />
            <Input
              label="Last name"
              autoComplete="family-name"
              placeholder="Rzayeva"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={state.fieldErrors.lastName}
              hint="Optional"
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={!identityValid}>
            Continue
          </Button>
        </form>
      )}

      {step === 'credentials' && (
        <div className="space-y-5">
          <form className="space-y-4" noValidate onSubmit={continueFromEmail}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={state.fieldErrors.email}
              autoFocus
              required
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={checkingEmail || email.trim().length === 0}
            >
              {checkingEmail && <Spinner />}
              {checkingEmail ? 'Checking…' : 'Continue with email'}
            </Button>
          </form>

          {providers.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
                <span className="type-label text-ink-500 dark:text-ink-400">or</span>
                <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
              </div>
              <ProviderButtons providers={providers} />
            </>
          )}

          <button
            type="button"
            onClick={() => setStep('identity')}
            className="type-label cursor-pointer text-ink-600 underline decoration-2 underline-offset-4 hover:text-accent-text dark:text-ink-400"
          >
            ← Back
          </button>
        </div>
      )}

      {step === 'password' && (
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={state.fieldErrors.password}
            autoFocus
            required
          />

          {/* Live checklist. `aria-live="polite"` so a screen reader hears rules
              being satisfied without every keystroke interrupting. */}
          <ul className="space-y-1.5" aria-live="polite">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    'flex items-center gap-2 text-xs transition-colors duration-150',
                    met ? 'text-success-text' : 'text-ink-500 dark:text-ink-400',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-bold',
                      met
                        ? 'border-fern-600 bg-fern-600 text-white'
                        : 'border-ink-300 dark:border-ink-600',
                    )}
                  >
                    {met ? '✓' : ''}
                  </span>
                  {rule.label}
                  <span className="sr-only">{met ? ' — met' : ' — not met yet'}</span>
                </li>
              );
            })}
          </ul>

          <div className="meter-track" aria-hidden="true">
            <div
              className="meter-fill"
              style={{ width: `${(satisfied.length / PASSWORD_RULES.length) * 100}%` }}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={state.submitting || !passwordValid}
          >
            {state.submitting && <Spinner />}
            {state.submitting ? 'Creating your account…' : 'Create account'}
          </Button>

          <button
            type="button"
            onClick={() => setStep('credentials')}
            className="type-label cursor-pointer text-ink-600 underline decoration-2 underline-offset-4 hover:text-accent-text dark:text-ink-400"
          >
            ← Back
          </button>
        </form>
      )}

      {onSwitch && (
        <p className="text-center text-sm text-ink-600 dark:text-ink-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="cursor-pointer font-bold text-accent-text underline decoration-2 underline-offset-4 hover:text-iris-700 dark:hover:text-iris-400"
          >
            Log in
          </button>
        </p>
      )}
    </div>
  );
}
