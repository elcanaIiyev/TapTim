import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { PRIMARY_ROLES } from '../../lib/types';
import type { PrimaryRole } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

/** Maps the API's field-level issues onto the form's inputs. */
function useSubmitState() {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleFailure = (error: unknown) => {
    if (error instanceof ApiError) {
      setFieldErrors(
        Object.fromEntries(error.issues.map((issue) => [issue.field, issue.message])),
      );
      // A validation response carries per-field issues and a message written
      // for developers ("Request validation failed."), which must never reach
      // a signup form. The inputs already say what to fix, so the banner just
      // points at them. Messages sent without issues — "An account with this
      // email already exists.", "Incorrect email or password." — are written
      // for the user and are shown as-is.
      setFormError(
        error.issues.length > 0 ? 'Please fix the highlighted fields below.' : error.message,
      );
    } else {
      setFormError('Something went wrong. Please try again.');
    }
  };

  const reset = () => {
    setFormError(null);
    setFieldErrors({});
  };

  return { submitting, setSubmitting, formError, fieldErrors, handleFailure, reset };
}

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-2 border-signal-bad bg-signal-bad px-4 py-3 text-sm font-medium text-white"
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

      {onSwitch && (
        <p className="text-center text-sm text-ink-600 dark:text-ink-400">
          No account yet?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="cursor-pointer font-bold uppercase tracking-wide text-accent-text underline decoration-2 underline-offset-4 hover:text-flame-700 dark:hover:text-flame-400"
          >
            Create one
          </button>
        </p>
      )}
    </form>
  );
}

export function SignupForm({ onSuccess, onSwitch }: FormProps) {
  const { signup } = useAuth();
  const state = useSubmitState();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [primaryRole, setPrimaryRole] = useState<PrimaryRole>(PRIMARY_ROLES[0]);
  const [skills, setSkills] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    state.reset();
    state.setSubmitting(true);
    try {
      await signup({
        fullName,
        email,
        password,
        primaryRole,
        skills: skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      });
      onSuccess?.();
    } catch (error) {
      state.handleFailure(error);
    } finally {
      state.setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {state.formError && <FormError message={state.formError} />}

      <Input
        label="Full name"
        autoComplete="name"
        placeholder="Ada Lovelace"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={state.fieldErrors.fullName}
        required
      />
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
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={state.fieldErrors.password}
        hint="Minimum 8 characters."
        required
      />
      <Select
        label="Primary role"
        value={primaryRole}
        onChange={(e) => setPrimaryRole(e.target.value as PrimaryRole)}
        error={state.fieldErrors.primaryRole}
      >
        {PRIMARY_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </Select>
      <Input
        label="Skills"
        placeholder="React, Node.js, Figma"
        value={skills}
        onChange={(e) => setSkills(e.target.value)}
        hint="Comma separated. You can refine these later."
      />

      <Button type="submit" className="w-full" size="lg" disabled={state.submitting}>
        {state.submitting ? <Spinner /> : null}
        {state.submitting ? 'Creating account…' : 'Create account'}
      </Button>

      {onSwitch && (
        <p className="text-center text-sm text-ink-600 dark:text-ink-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="cursor-pointer font-bold uppercase tracking-wide text-accent-text underline decoration-2 underline-offset-4 hover:text-flame-700 dark:hover:text-flame-400"
          >
            Log in
          </button>
        </p>
      )}
    </form>
  );
}
