import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Hard-framed fields. Focus is handled by the global focus-visible outline, so
// the field itself only signals hover and error state.
const FIELD =
  'w-full rounded-[var(--radius-soft-sm)] border bg-white px-3.5 py-2.5 text-sm text-ink-900 transition-colors duration-150 ' +
  'placeholder:text-ink-400 dark:bg-ink-950 dark:text-white dark:placeholder:text-ink-400';

const FIELD_OK =
  'border-ink-950 hover:border-iris-600 dark:border-ink-700 dark:hover:border-iris-500';

const FIELD_ERROR = 'border-signal-bad dark:border-signal-bad';

const LABEL = 'type-label block text-ink-700 dark:text-ink-300';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
}

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <p
      id={id}
      className={cn(
        'text-xs',
        error
          ? 'flex items-start gap-1.5 font-medium text-signal-bad'
          : 'text-ink-600 dark:text-ink-400',
      )}
    >
      {error && (
        <span aria-hidden="true" className="mt-px font-mono font-bold">
          !
        </span>
      )}
      <span>{error ?? hint}</span>
    </p>
  );
}

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className={LABEL}>
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(FIELD, error ? FIELD_ERROR : FIELD_OK, className)}
        {...props}
      />
      <Message id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...props
}: FieldWrapperProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className={LABEL}>
        {label}
      </label>
      <select
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(FIELD, error ? FIELD_ERROR : FIELD_OK, 'cursor-pointer', className)}
        {...props}
      >
        {children}
      </select>
      <Message id={messageId} error={error} hint={hint} />
    </div>
  );
}
