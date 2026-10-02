/** Every error code the API can return. The single source of truth for API and web. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  IDEMPOTENCY_KEY_MISSING: 400,
  IDEMPOTENCY_KEY_INVALID: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ORIGIN_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  SEAT_NOT_FOUND: 404,
  BOOKING_NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  SEAT_TAKEN: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  IDEMPOTENCY_KEY_REUSED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  BOOKING_UNAVAILABLE: 503,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: { fieldErrors: Record<string, string[]> } | null;
    requestId: string;
  };
}

/** Outcomes after which a booking attempt is over: the client must not resend that key. */
export const DEFINITIVE_BOOKING_CODES: readonly ErrorCode[] = [
  'SEAT_TAKEN',
  'EVENT_NOT_FOUND',
  'SEAT_NOT_FOUND',
  'VALIDATION_ERROR',
  'IDEMPOTENCY_KEY_MISSING',
  'IDEMPOTENCY_KEY_INVALID',
  'IDEMPOTENCY_KEY_REUSED',
  'UNAUTHENTICATED',
  'ORIGIN_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
];

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const REPLAY_HEADER = 'Idempotent-Replayed';
