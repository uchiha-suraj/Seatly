import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error';
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-subtle text-ink-2 border-line',
  brand: 'bg-brand-subtle text-brand border-brand-line',
  success: 'bg-success-bg text-success border-success-line',
  warning: 'bg-warning-bg text-warning border-warning-line',
  error: 'bg-error-bg text-error border-error-line',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
