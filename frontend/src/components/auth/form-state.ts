import { useState } from 'react';
import { ApiError } from '../../lib/api';

/**
 * Maps the API's field-level issues onto a form's inputs.
 *
 * Extracted so the login form and the signup wizard share one behaviour: a
 * validation response carries per-field issues plus a message written for
 * developers ("Request validation failed."), which must never reach a person.
 * The inputs already say what to fix, so the banner just points at them.
 * Messages sent *without* issues — "An account with this email already
 * exists." — are written for the user and shown as-is.
 */
export function useSubmitState() {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleFailure = (error: unknown) => {
    if (error instanceof ApiError) {
      setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.field, issue.message])));
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

  return { submitting, setSubmitting, formError, fieldErrors, setFieldErrors, handleFailure, reset };
}

/**
 * The password rules, mirrored from the server schema so the wizard can show a
 * live checklist instead of one lump error after submitting.
 *
 * A deliberate duplication: the server stays the authority and rejects anything
 * that slips through, but a rule someone can only discover by failing is a bad
 * rule. Both lists are short and change together.
 */
export const PASSWORD_RULES: ReadonlyArray<{ label: string; test: (value: string) => boolean }> = [
  { label: 'At least 10 characters', test: (v) => v.length >= 10 },
  { label: 'A lower-case letter', test: (v) => /[a-z]/.test(v) },
  { label: 'An upper-case letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
];

export function passwordStrength(value: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(value)).length;
}
