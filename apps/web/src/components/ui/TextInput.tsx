import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';
import { Icon } from './Icon';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  passwordToggle?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Label always visible; errors are linked with aria-describedby and marked aria-invalid. */
export function TextInput({ label, error, hint, passwordToggle, type = 'text', className = '', ref, ...rest }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const border = error ? 'border-2 border-error' : 'border border-line-strong focus-within:border-2 focus-within:border-brand';
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className={`flex h-11 items-center gap-2 rounded-md bg-surface px-3 ${border} has-[input:disabled]:bg-subtle`}>
        <input
          {...rest}
          ref={ref}
          id={id}
          type={passwordToggle && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 disabled:text-ink-3"
        />
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            className="-mr-2 flex size-11 items-center justify-center rounded-md text-ink-2 hover:text-ink"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-error">
          <Icon name="alert-circle" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
