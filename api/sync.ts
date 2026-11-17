// /api/sync — each signed-in user's app data in the database.
//   GET -> { data, version } or 404 when nothing is saved yet
//   PUT -> { data, baseVersion, timeZone }: saves if nobody saved in between,
//          otherwise 409 with the newer copy so the app can merge and retry.
// Users can only ever read or write their own row: the user id comes from the
// signed session cookie, never from the request body.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentUser } from './_lib/session.js';
import { ensureSchema, getDb, getUserData, saveReminders, saveUserData, upsertUser } from './_lib/db.js';
import { isObject, methodNotAllowed, sendJson, validTimeZone } from './_lib/http.js';
import { isCloudData, remindersFromGoals } from '../src/sync/shared.js';

const MAX_BYTES = 2_000_000; // plenty for years of entries; photos are never synced

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);

  const db = getDb();
  if (!db) {
    sendJson(res, 503, { error: 'not_configured' });
    return;
  }
  const user = currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'signed_out' });
    return;
  }
  await ensureSchema(db);

  if (req.method === 'GET') {
    const stored = await getUserData(db, user.sub);
    if (!stored) sendJson(res, 404, { error: 'empty' });
    else sendJson(res, 200, stored);
    return;
  }

  const body: unknown = req.body;
  if (!isObject(body) || !isCloudData(body.data)) {
    sendJson(res, 400, { error: 'invalid_input' });
    return;
  }
  if (JSON.stringify(body.data).length > MAX_BYTES) {
    sendJson(res, 413, { error: 'too_large' });
    return;
  }
  const baseVersion = typeof body.baseVersion === 'number' ? body.baseVersion : null;
  // Make sure the account row exists (e.g. signed in before the database was added).
  await upsertUser(db, user);

  const version = await saveUserData(db, user.sub, body.data, baseVersion);
  if (version === null) {
    // Someone (another device) saved first: send back their copy to merge.
    const stored = await getUserData(db, user.sub);
    sendJson(res, 409, stored ?? { error: 'conflict' });
    return;
  }
  await saveReminders(db, user.sub, remindersFromGoals(body.data.goals), validTimeZone(body.timeZone));
  sendJson(res, 200, { version });
}
