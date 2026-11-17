// /api/reminders/tick — the reminder scheduler. An outside timer calls this
// every minute (see README: cron-job.org). It finds goals whose time has come,
// skips any already done or stopped today, and sends a push alert to every
// device the user turned alerts on for. Protected by CRON_SECRET.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as webpush from 'web-push';
import { deleteSubscription, ensureSchema, getDb, getUserData, markReminderSent, remindersWithSubscribers, subscriptionsFor, type Db, type ReminderRow } from '../_lib/db.js';
import { sendJson } from '../_lib/http.js';
import { isReminderDue, type CloudData } from '../../src/sync/shared.js';

export interface Sender {
  send(sub: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<void>;
}

// The work itself, separate from HTTP so tests can run it against a test database.
export async function runTick(db: Db, sender: Sender, now = new Date()): Promise<{ sent: number; due: number }> {
  const rows = await remindersWithSubscribers(db);
  const dataCache = new Map<string, CloudData | null>();
  let sent = 0;
  let due = 0;

  for (const row of rows as ReminderRow[]) {
    // Cheap check first (time window, day, already sent today) before loading user data.
    const quick = isReminderDue({ goalId: row.goal_id, title: row.title, time: row.time, days: row.days }, now, row.time_zone, null);
    if (!quick.due || row.last_sent_on === quick.localDate) continue;

    if (!dataCache.has(row.user_id)) dataCache.set(row.user_id, (await getUserData(db, row.user_id))?.data ?? null);
    const check = isReminderDue({ goalId: row.goal_id, title: row.title, time: row.time, days: row.days }, now, row.time_zone, dataCache.get(row.user_id) ?? null);
    if (!check.due) continue;

    due++;
    await markReminderSent(db, row.user_id, row.goal_id, check.localDate); // mark first: never alert twice
    const payload = JSON.stringify({ title: `⏰ ${row.title}`, body: "It's time. Tap to open Weekly Goals.", goalId: row.goal_id, url: '/' });
    for (const sub of await subscriptionsFor(db, row.user_id)) {
      try {
        await sender.send(sub, payload);
        sent++;
      } catch (error) {
        // 404/410 = the device unsubscribed or the app was removed: forget it.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await deleteSubscription(db, sub.endpoint);
        else console.error('Push failed:', status);
      }
    }
  }
  return { sent, due };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.authorization ?? '').replace(/^Bearer /, '') || (typeof req.query.key === 'string' ? req.query.key : '');
  if (!secret || given !== secret) return sendJson(res, 401, { error: 'unauthorized' });

  const db = getDb();
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!db || !publicKey || !privateKey) return sendJson(res, 503, { error: 'not_configured' });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://daily-opal-eight.vercel.app', publicKey, privateKey);
  await ensureSchema(db);
  const result = await runTick(db, {
    send: async (sub, payload) => {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 600, urgency: 'high' });
    },
  });
  sendJson(res, 200, result);
}
