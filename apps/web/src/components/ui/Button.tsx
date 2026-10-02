import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed';
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:bg-muted disabled:text-ink-3',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-subtle disabled:border-line disabled:bg-muted disabled:text-ink-3',
  ghost: 'text-brand hover:bg-brand-subtle disabled:text-ink-3 disabled:hover:bg-transparent',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${base} ${variants[variant]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

/** 44px tall. While loading it stays labelled ("Booking seat A7…") and ignores clicks. */
export function Button({ variant = 'primary', loading = false, className = '', children, disabled, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={buttonClass(variant, className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || disabled || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
    >
      {loading && <Icon name="loader" size={18} className="animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', className = '', ...rest }: LinkProps & { variant?: ButtonVariant }) {
  return <Link {...rest} className={buttonClass(variant, className)} />;
}
