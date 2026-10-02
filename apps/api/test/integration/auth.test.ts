import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Session, User } from '../../src/db/models';
import { newUser, startTestApp, type TestContext } from '../helpers/app';

let t: TestContext;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.stop());

describe('register', () => {
  it('creates the user, stores only an argon2id hash and sets a safe session cookie (AC-1)', async () => {
    const res = await supertest(t.server)
      .post('/api/auth/register')
      .send({ name: 'Priya Sharma', email: 'Priya@Example.com', password: 'correct-horse-9' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Priya Sharma', email: 'priya@example.com' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^seatly_sid=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    const stored = await User.findOne({ email: 'priya@example.com' }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain('correct-horse-9');
  });

  it('rejects an existing email with 409 EMAIL_TAKEN (AC-2)', async () => {
    const res = await supertest(t.server)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'priya@example.com', password: 'another-pass-1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(res.body.error.details.fieldErrors.email).toEqual(['This email is already registered.']);
  });

  it('returns per-field validation errors (AC-3)', async () => {
    const res = await supertest(t.server).post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('login', () => {
  it('gives one generic 401 for wrong password and for unknown email (AC-4)', async () => {
    const wrong = await supertest(t.server).post('/api/auth/login').send({ email: 'priya@example.com', password: 'wrong-pass-1' });
    const unknown = await supertest(t.server).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-pass-1' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Email or password is incorrect.');
    }
  });

  it('rotates the session: logging in again replaces the previous session', async () => {
    const agent = supertest.agent(t.server);
    await agent.post('/api/auth/login').send({ email: 'priya@example.com', password: 'correct-horse-9' }).expect(200);
    await agent.post('/api/auth/login').send({ email: 'priya@example.com', password: 'correct-horse-9' }).expect(200);
    const user = await User.findOne({ email: 'priya@example.com' }).lean();
    // One from registration (other client) + one for this agent after rotation.
    expect(await Session.countDocuments({ userId: user!._id })).toBe(2);
  });
});

describe('session lifecycle', () => {
  it('logout ends the session; a protected call then returns 401 (AC-5)', async () => {
    const { agent } = await newUser(t.server);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');
    await agent.get('/api/me/bookings').expect(401);
  });

  it('logout without a session still succeeds', async () => {
    await supertest(t.server).post('/api/auth/logout').expect(204);
  });

  it('expires after the idle timeout and clears the cookie', async () => {
    const { agent } = await newUser(t.server);
    t.clock.advance(t.config.sessionIdleMs + 60_000);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']?.[0]).toMatch(/seatly_sid=;/);
  });

  it('slides the idle timeout on activity', async () => {
    const { agent, email } = await newUser(t.server);
    const user = await User.findOne({ email }).lean();
    const before = await Session.findOne({ userId: user!._id }).lean();
    t.clock.advance(6 * 60_000);
    await agent.get('/api/auth/me').expect(200);
    const after = await Session.findOne({ userId: user!._id }).lean();
    expect(after!.idleExpiresAt.getTime()).toBeGreaterThan(before!.idleExpiresAt.getTime());
  });
});

describe('request hygiene', () => {
  it('rejects cross-site POSTs (403) and non-JSON bodies (415)', async () => {
    const cross = await supertest(t.server)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'priya@example.com', password: 'correct-horse-9' });
    expect(cross.status).toBe(403);
    expect(cross.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    const form = await supertest(t.server)
      .post('/api/auth/login')
      .type('form')
      .send('email=priya%40example.com&password=correct-horse-9');
    expect(form.status).toBe(415);
  });

  it('accepts same-origin POSTs', async () => {
    await supertest(t.server)
      .post('/api/auth/login')
      .set('Origin', t.config.appOrigin)
      .send({ email: 'priya@example.com', password: 'correct-horse-9' })
      .expect(200);
  });

  it('rejects unknown fields instead of ignoring them', async () => {
    const res = await supertest(t.server)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'x@example.com', password: 'correct-horse-9', role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.role).toBeDefined();
  });
});
