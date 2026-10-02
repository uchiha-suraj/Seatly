import { fieldErrors } from '@seatly/shared';
import type { z } from 'zod';
import { AppError } from './errors';

export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 'Some fields need attention.', {
      fieldErrors: fieldErrors(result.error),
    });
  }
  return result.data;
}
