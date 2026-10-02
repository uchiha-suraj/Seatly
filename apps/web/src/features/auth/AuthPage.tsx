import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldErrors, loginSchema, registerSchema } from '@seatly/shared';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { getEvent, login, register } from '../../api/endpoints';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { TextInput } from '../../components/ui/TextInput';
import { bookingIntentFrom, safeReturnTo } from '../../lib/returnTo';
import { meKey } from './useMe';

type Mode = 'login' | 'register';
type Fields = { name: string; email: string; password: string };
type TopError = { tone: 'error'; title: string; body: string; loginLink?: boolean } | null;

export function AuthPage({ mode }: { mode: Mode }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const expired = mode === 'login' && params.get('reason') === 'expired';
  const intent = bookingIntentFrom(returnTo);
  const event = useQuery({ queryKey: ['event', intent?.eventId], queryFn: () => getEvent(intent!.eventId), enabled: !!intent, retry: false });

  const [values, setValues] = useState<Fields>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [top, setTop] = useState<TopError>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const focusField = (f: keyof Fields) => ({ name: nameRef, email: emailRef, password: passwordRef })[f].current?.focus();

  const schema = mode === 'register' ? registerSchema : loginSchema;
  const fieldOrder: (keyof Fields)[] = mode === 'register' ? ['name', 'email', 'password'] : ['email', 'password'];

  function validate(v: Fields) {
    const input = mode === 'register' ? v : { email: v.email, password: v.password };
    const r = schema.safeParse(input);
    if (r.success) return {};
    const fe = fieldErrors(r.error);
    return Object.fromEntries(fieldOrder.filter((f) => fe[f]).map((f) => [f, fe[f]![0]])) as Partial<Record<keyof Fields, string>>;
  }

  function update(field: keyof Fields, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTop(null);
    const v = validate(values);
    setErrors(v);
    const firstInvalid = fieldOrder.find((f) => v[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    setBusy(true);
    try {
      const user =
        mode === 'register'
          ? await register({ name: values.name, email: values.email, password: values.password })
          : await login({ email: values.email, password: values.password });
      // Navigate first so the GuestOnly guard never redirects this page to "/".
      navigate(returnTo ?? '/', { replace: true, state: { fromAuth: true } });
      queryClient.setQueryData(meKey, user);
      void queryClient.invalidateQueries({ queryKey: ['myBookings'] });
    } catch (err) {
      setBusy(false);
      if (!(err instanceof ApiError)) throw err;
      if (err.code === 'INVALID_CREDENTIALS') {
        setTop({ tone: 'error', title: 'Email or password is incorrect', body: 'Check both and try again.' });
        setValues((s) => ({ ...s, password: '' }));
        passwordRef.current?.focus();
      } else if (err.code === 'EMAIL_TAKEN') {
        setTop({ tone: 'error', title: 'An account with this email already exists', body: 'Log in instead, or use a different email.', loginLink: true });
        setErrors({ email: 'This email is already registered.' });
      } else if (err.code === 'VALIDATION_ERROR') {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      } else if (err.code === 'RATE_LIMITED') {
        setTop({ tone: 'error', title: 'Too many attempts', body: 'Wait a minute and try again.' });
      } else {
        setTop({ tone: 'error', title: mode === 'login' ? 'We couldn’t log you in right now' : 'We couldn’t create your account right now', body: 'Something went wrong on our side. Please try again in a moment.' });
      }
    }
  }

  const otherHref = `${mode === 'login' ? '/register' : '/login'}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  const eventTitle = event.data?.title.split(' at ')[0] ?? 'this event';
  const contextText = intent?.seatId
    ? `${mode === 'login' ? 'Log in' : 'Create an account'} to book seat ${intent.seatId} at ${eventTitle}. The seat isn’t held while you ${mode === 'login' ? 'log in' : 'sign up'}.`
    : returnTo === '/bookings'
      ? 'Log in to see your bookings.'
      : null;

  return (
    <div className="flex justify-center px-4 py-6 sm:py-16">
      <div className="flex w-full max-w-[440px] flex-col gap-6 sm:rounded-xl sm:border sm:border-line sm:bg-surface sm:p-10 sm:shadow-card">
        {expired ? (
          <Alert tone="warning" title="Your session expired" urgent>
            {intent?.seatId
              ? `Log in again to continue booking seat ${intent.seatId} at ${eventTitle}. We’ll take you back to the event — the seat isn’t held.`
              : 'Log in again to continue.'}
          </Alert>
        ) : top ? (
          <Alert
            tone="error"
            title={top.title}
            urgent
            action={
              top.loginLink ? (
                <Link to={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-sm font-medium text-error underline">
                  Log in instead
                </Link>
              ) : undefined
            }
          >
            {top.body}
          </Alert>
        ) : contextText ? (
          <div className="flex items-center gap-2.5 rounded-md bg-brand-subtle p-3 text-sm text-ink">
            <Icon name={returnTo === '/bookings' ? 'lock' : 'ticket'} size={18} className="shrink-0 text-brand" />
            <span>{contextText}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] leading-10 font-semibold tracking-tight">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
          <p className="text-ink-2">
            {mode === 'login' ? 'Welcome back. Log in to book seats and see your bookings.' : 'Booking needs an account so your seats show up in My bookings.'}
          </p>
        </div>

        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <TextInput ref={nameRef} label="Full name" autoComplete="name" value={values.name} onChange={(e) => update('name', e.target.value)} onBlur={() => submitted && setErrors(validate(values))} error={errors.name} disabled={busy} />
          )}
          <TextInput ref={emailRef} label="Email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={(e) => update('email', e.target.value)} onBlur={() => submitted && setErrors(validate(values))} error={errors.email} disabled={busy} />
          <TextInput
            ref={passwordRef}
            label="Password"
            type="password"
            passwordToggle
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={values.password}
            onChange={(e) => update('password', e.target.value)}
            onBlur={() => submitted && setErrors(validate(values))}
            error={errors.password}
            hint={mode === 'register' ? 'At least 8 characters.' : undefined}
            disabled={busy}
          />
          <Button type="submit" loading={busy} className="w-full">
            {busy ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-2">
          {mode === 'login' ? 'New to Seatly? ' : 'Already have an account? '}
          <Link to={otherHref} className="font-medium text-brand hover:underline">
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
