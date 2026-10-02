/**
 * Only same-origin relative paths are allowed as a post-login destination (no open redirects).
 * Returns null for anything else.
 */
export function safeReturnTo(raw: string | null | undefined, origin = window.location.origin): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Parses /events/:id?seat=A7 out of a returnTo, to show booking context on the auth pages. */
export function bookingIntentFrom(returnTo: string | null): { eventId: string; seatId: string | null } | null {
  if (!returnTo) return null;
  const url = new URL(returnTo, 'http://x');
  const m = /^\/events\/([^/]+)$/.exec(url.pathname);
  if (!m) return null;
  return { eventId: decodeURIComponent(m[1]!), seatId: url.searchParams.get('seat') };
}

export function loginPath(returnTo: string, reason?: 'expired'): string {
  const q = new URLSearchParams({ returnTo });
  if (reason) q.set('reason', reason);
  return `/login?${q.toString()}`;
}
