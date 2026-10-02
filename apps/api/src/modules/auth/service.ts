import argon2 from 'argon2';
import type { Types } from 'mongoose';
import type { LoginInput, RegisterInput, UserDto } from '@seatly/shared';
import type { Config } from '../../config';
import { Session, User } from '../../db/models';
import type { Clock } from '../../lib/clock';
import { newSessionToken, sha256Hex } from '../../lib/crypto';
import { AppError, isDuplicateKey } from '../../lib/errors';

export function toUserDto(u: { _id: Types.ObjectId; name: string; email: string }): UserDto {
  return { id: u._id.toString(), name: u.name, email: u.email };
}

export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly config: Config,
    private readonly clock: Clock,
  ) {}

  private hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: this.config.argon2MemoryKiB });
  }

  async register(input: RegisterInput): Promise<UserDto> {
    const passwordHash = await this.hash(input.password);
    try {
      const user = await User.create({ name: input.name, email: input.email, passwordHash, createdAt: this.clock.now() });
      return toUserDto(user);
    } catch (err) {
      if (isDuplicateKey(err, 'email')) {
        throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.', {
          fieldErrors: { email: ['This email is already registered.'] },
        });
      }
      throw err;
    }
  }

  /** Same error and roughly the same time for "no such email" and "wrong password". */
  async verifyCredentials(input: LoginInput): Promise<UserDto> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash').lean();
    if (!user) {
      this.dummyHash ??= this.hash('not-a-real-password-just-equalising-timing');
      await argon2.verify(await this.dummyHash, input.password).catch(() => false);
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    return toUserDto(user);
  }

  /** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
  async createSession(userId: string, replaceSessionId?: Types.ObjectId): Promise<string> {
    if (replaceSessionId) await Session.deleteOne({ _id: replaceSessionId });
    const now = this.clock.now();
    const token = newSessionToken();
    const idleExpiresAt = new Date(now.getTime() + this.config.sessionIdleMs);
    const absoluteExpiresAt = new Date(now.getTime() + this.config.sessionAbsoluteMs);
    await Session.create({
      tokenHash: sha256Hex(token),
      userId,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
      expiresAt: idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt,
    });
    return token;
  }

  async deleteSession(sessionId: Types.ObjectId): Promise<void> {
    await Session.deleteOne({ _id: sessionId });
  }

  async getUser(userId: Types.ObjectId): Promise<UserDto | null> {
    const user = await User.findById(userId).lean();
    return user ? toUserDto(user) : null;
  }
}
