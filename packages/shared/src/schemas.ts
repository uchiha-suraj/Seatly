import { z } from 'zod';

export const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
export const SEAT_ID_RE = /^[A-Z](?:[1-9]|[1-9][0-9])$/;

export const objectIdSchema = z
  .string()
  .regex(OBJECT_ID_RE, 'Must be a 24-character hex id.')
  .transform((s) => s.toLowerCase());

export const seatIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SEAT_ID_RE, 'Seat ids look like A7.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address, like name@example.com.'));

export const registerSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use 80 characters or fewer.'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Use 72 characters or fewer.'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Body of POST /api/bookings. Strict: a client-supplied userId is rejected, never ignored. */
export const createBookingSchema = z.strictObject({
  eventId: objectIdSchema,
  seatId: seatIdSchema,
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const idempotencyKeySchema = z.uuid();

/** Turns a ZodError into { field: [messages] } for the API error envelope. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (issue.code === 'unrecognized_keys') {
      for (const k of issue.keys) (out[k] ??= []).push('This field is not allowed.');
      continue;
    }
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
