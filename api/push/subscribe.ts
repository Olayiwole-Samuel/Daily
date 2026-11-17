// /api/push/subscribe — goal-time alerts on this device.
//   GET    -> { publicKey } the browser needs to subscribe (null if alerts aren't set up)
//   POST   -> save this device's push subscription for the signed-in user
//   DELETE -> { endpoint } stop alerts on this device
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentUser } from '../_lib/session.js';
import { deleteSubscription, ensureSchema, getDb, saveSubscription, upsertUser } from '../_lib/db.js';
import { isObject, methodNotAllowed, sendJson } from '../_lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') {
    sendJson(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY || null });
    return;
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);

  const db = getDb();
  const user = currentUser(req);
  if (!db) return sendJson(res, 503, { error: 'not_configured' });
  if (!user) return sendJson(res, 401, { error: 'signed_out' });
  await ensureSchema(db);

  const body: unknown = req.body;
  if (req.method === 'DELETE') {
    const endpoint = isObject(body) && typeof body.endpoint === 'string' ? body.endpoint : null;
    if (endpoint) await deleteSubscription(db, endpoint, user.sub);
    return sendJson(res, 200, { ok: true });
  }

  // The browser's PushSubscription.toJSON(): { endpoint, keys: { p256dh, auth } }
  const sub = isObject(body) && isObject(body.subscription) ? body.subscription : null;
  const keys = sub && isObject(sub.keys) ? sub.keys : null;
  const valid =
    sub && keys && typeof sub.endpoint === 'string' && sub.endpoint.startsWith('https://') && sub.endpoint.length < 2048 &&
    typeof keys.p256dh === 'string' && typeof keys.auth === 'string';
  if (!valid) return sendJson(res, 400, { error: 'invalid_input' });

  await upsertUser(db, user);
  await saveSubscription(db, user.sub, { endpoint: sub.endpoint as string, p256dh: keys.p256dh as string, auth: keys.auth as string });
  sendJson(res, 200, { ok: true });
}
