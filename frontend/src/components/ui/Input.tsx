import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const FIELD =
  'w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-ink-900 transition-colors ' +
  'placeholder:text-ink-400 dark:bg-ink-950/60 dark:text-white dark:placeholder:text-ink-500';

const FIELD_OK =
  'border-ink-300 hover:border-ink-400 focus:border-brand-500 dark:border-ink-700 dark:hover:border-ink-600';

const FIELD_ERROR = 'border-red-400 dark:border-red-500/70';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
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
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700 dark:text-ink-200">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(FIELD, error ? FIELD_ERROR : FIELD_OK, className)}
        {...props}
      />
      {(error || hint) && (
        <p
          id={messageId}
          className={cn(
            'text-xs',
            error ? 'text-red-600 dark:text-red-400' : 'text-ink-500 dark:text-ink-400',
          )}
        >
          {error ?? hint}
        </p>
      )}
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
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700 dark:text-ink-200">
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
      {(error || hint) && (
        <p
          id={messageId}
          className={cn(
            'text-xs',
            error ? 'text-red-600 dark:text-red-400' : 'text-ink-500 dark:text-ink-400',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
