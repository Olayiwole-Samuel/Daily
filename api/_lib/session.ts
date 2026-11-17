// Signed session cookies, so the server knows who is calling without asking
// Google every time. The cookie holds { sub, email, name, exp } plus an
// HMAC-SHA256 signature made with SESSION_SECRET; anyone changing the
// contents breaks the signature. It's HttpOnly, so page scripts can't read it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const COOKIE_NAME = 'wg_session';
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export interface SessionUser {
  sub: string; // Google's stable user id
  email: string;
  name: string;
}

interface Payload extends SessionUser {
  exp: number; // seconds since 1970
}

const b64 = (data: Buffer | string) => Buffer.from(data).toString('base64url');

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createSessionToken(user: SessionUser, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const body = b64(JSON.stringify({ ...user, exp: nowSeconds + THIRTY_DAYS } satisfies Payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): SessionUser | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  // Constant-time compare, so the signature can't be guessed byte by byte.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<Payload>;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp < nowSeconds) return null;
    return { sub: payload.sub, email: payload.email ?? '', name: payload.name ?? '' };
  } catch {
    return null;
  }
}

export function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}

export function clearedCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

// The signed-in user for this request, or null.
export function currentUser(req: IncomingMessage): SessionUser | null {
  const secret = getSecret();
  return secret ? verifySessionToken(readCookie(req, COOKIE_NAME), secret) : null;
}
