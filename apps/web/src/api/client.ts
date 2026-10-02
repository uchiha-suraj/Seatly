import type { ApiErrorBody, ErrorCode } from '@seatly/shared';

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted';

/** Every failed request becomes an ApiError so callers can branch on kind / status / code. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status = 0,
    readonly code: ErrorCode | null = null,
    readonly retryAfterMs: number | null = null,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The outcome is unknown: the request may or may not have taken effect on the server. */
  get isUncertain(): boolean {
    return this.kind === 'timeout' || this.kind === 'network' || this.status >= 500;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<ApiResponse<T>> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(`${window.location.origin}/api${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw new ApiError('aborted', 'Request cancelled.');
    if (timeout.aborted || (err as Error)?.name === 'TimeoutError') throw new ApiError('timeout', 'The server took too long to respond.');
    throw new ApiError('network', 'We couldn’t reach the server.');
  }

  if (res.status === 204) return { data: undefined as T, status: 204, headers: res.headers };
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.ok) return { data: json as T, status: res.status, headers: res.headers };

  const body = (json as ApiErrorBody | null)?.error;
  const retryAfter = Number(res.headers.get('Retry-After'));
  throw new ApiError(
    'http',
    body?.message ?? `Request failed (${res.status}).`,
    res.status,
    body?.code ?? null,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
    body?.details?.fieldErrors ?? {},
    body?.requestId ?? res.headers.get('X-Request-Id'),
  );
}
