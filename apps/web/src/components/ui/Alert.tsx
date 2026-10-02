import type { ReactNode, Ref } from 'react';
import { Icon, type IconName } from './Icon';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const tone: Record<AlertTone, { box: string; icon: IconName; iconColor: string }> = {
  info: { box: 'bg-info-bg border-info-line', icon: 'info', iconColor: 'text-info' },
  success: { box: 'bg-success-bg border-success-line', icon: 'check-circle', iconColor: 'text-success' },
  warning: { box: 'bg-warning-bg border-warning-line', icon: 'alert-triangle', iconColor: 'text-warning' },
  error: { box: 'bg-error-bg border-error-line', icon: 'alert-circle', iconColor: 'text-error' },
};

interface AlertProps {
  tone: AlertTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** role="alert" for conflicts and session expiry, role="status" for the rest. */
  urgent?: boolean;
  ref?: Ref<HTMLDivElement>;
  className?: string;
}

export function Alert({ tone: t, title, children, action, urgent, ref, className = '' }: AlertProps) {
  const s = tone[t];
  return (
    <div ref={ref} tabIndex={ref ? -1 : undefined} role={urgent ? 'alert' : 'status'} className={`flex gap-3 rounded-md border p-4 outline-none ${s.box} ${className}`}>
      <Icon name={s.icon} className={`mt-0.5 shrink-0 ${s.iconColor}`} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-ink">{title}</p>
        {children && <div className="text-sm text-ink-2">{children}</div>}
        {action}
      </div>
    </div>
  );
}
