import { ERROR_CODES, type ErrorCode } from '@seatly/shared';

/** An expected failure that maps directly onto the API error envelope. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: { fieldErrors: Record<string, string[]> } | null = null,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_CODES[code];
  }
}

export function errorBody(code: ErrorCode, message: string, requestId: string, details: AppError['details'] = null) {
  return { error: { code, message, details, requestId } };
}

interface MongoLikeError {
  code?: number;
  keyPattern?: Record<string, unknown>;
  errorLabels?: string[];
  hasErrorLabel?: (label: string) => boolean;
}

/** True for E11000; when `field` is given, only if that field is part of the violated unique index. */
export function isDuplicateKey(err: unknown, field?: string): boolean {
  const e = err as MongoLikeError | null;
  if (!e || e.code !== 11000) return false;
  if (!field) return true;
  return Boolean(e.keyPattern && field in e.keyPattern);
}

export function hasErrorLabel(err: unknown, label: string): boolean {
  const e = err as MongoLikeError | null;
  if (!e) return false;
  if (typeof e.hasErrorLabel === 'function') return e.hasErrorLabel(label);
  return Array.isArray(e.errorLabels) && e.errorLabels.includes(label);
}
