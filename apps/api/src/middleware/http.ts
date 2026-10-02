import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError, errorBody } from '../lib/errors';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && /^[\w-]{6,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence in depth (cookies are also SameSite=Lax): browsers always send Origin on
 * cross-site POSTs, so a present-but-foreign Origin is rejected. Non-browser clients send none.
 */
export function originCheck(appOrigin: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (UNSAFE.has(req.method) && origin && origin !== appOrigin) {
      return next(new AppError('ORIGIN_NOT_ALLOWED', 'Cross-site requests are not allowed.'));
    }
    next();
  };
}

/** Bodies must be JSON; an HTML form on another site cannot send that without a CORS preflight. */
export function requireJson(req: Request, _res: Response, next: NextFunction): void {
  const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding') !== undefined;
  if (UNSAFE.has(req.method) && hasBody && !req.is('application/json')) {
    return next(new AppError('UNSUPPORTED_MEDIA_TYPE', 'Send the request body as application/json.'));
  }
  next();
}

export function apiNotFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}.`));
}

interface Logger {
  error(obj: unknown, msg?: string): void;
}

export function errorHandler(logger: Logger) {
  // Express recognises error middleware by its four parameters.
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.requestId ?? 'unknown';
    if (err instanceof AppError) {
      for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v);
      res.status(err.status).json(errorBody(err.code, err.message, requestId, err.details));
      return;
    }
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Request body is not valid JSON.', requestId));
      return;
    }
    if (e?.type === 'entity.too.large') {
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Request body is too large.', requestId));
      return;
    }
    logger.error({ err, requestId }, 'unhandled error');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Something went wrong on our side.', requestId));
  };
}
