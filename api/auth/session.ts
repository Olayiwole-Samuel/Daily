// /api/auth/session
//   GET    -> who am I? (from the session cookie)
//   POST   -> sign in: { accessToken } from Google's popup; sets the session cookie
//   DELETE -> sign out: clears the cookie
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearedCookie, createSessionToken, currentUser, getSecret, sessionCookie } from '../_lib/session.js';
import { googleClientId, verifyGoogleAccessToken } from '../_lib/google.js';
import { ensureSchema, getDb, upsertUser } from '../_lib/db.js';
import { isObject, methodNotAllowed, sendJson } from '../_lib/http.js';

// Cloud sync only works when both a database and a session secret are configured.
const cloudReady = () => !!getDb() && !!getSecret();

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') {
    const user = currentUser(req);
    sendJson(res, user ? 200 : 401, { user, cloud: cloudReady() });
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearedCookie());
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);

  const secret = getSecret();
  const clientId = googleClientId();
  if (!secret || !clientId) {
    sendJson(res, 503, { error: 'not_configured', message: "Cloud backup isn't set up on the server yet." });
    return;
  }
  const body: unknown = req.body;
  const accessToken = isObject(body) && typeof body.accessToken === 'string' ? body.accessToken : null;
  if (!accessToken || accessToken.length > 4096) {
    sendJson(res, 400, { error: 'invalid_input' });
    return;
  }

  const user = await verifyGoogleAccessToken(accessToken, clientId).catch(() => null);
  if (!user) {
    sendJson(res, 401, { error: 'invalid_token', message: "Couldn't confirm your Google sign-in. Please try again." });
    return;
  }

  const db = getDb();
  if (db) {
    await ensureSchema(db);
    await upsertUser(db, user);
  }
  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(user, secret)));
  sendJson(res, 200, { user, cloud: cloudReady() });
}
