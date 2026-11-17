// Server tests against a real Postgres engine running in memory (PGlite),
// so the SQL itself is exercised, not just the TypeScript.
import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import type { IncomingMessage } from 'node:http';
import { createSessionToken, readCookie, verifySessionToken } from './session';
import { ensureSchema, getUserData, resetSchemaCache, saveReminders, saveSubscription, saveUserData, upsertUser, type Db } from './db';
import { runTick } from '../reminders/tick';
import { remindersFromGoals, type CloudData } from '../../src/sync/shared';
import { createEmptyState } from '../../src/state/storage';
import type { Goal } from '../../src/types';

const SECRET = 'x'.repeat(40);

function pgDb(pg: PGlite): Db {
  return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows };
}

const goal = (partial: Partial<Goal>): Goal => ({
  id: 'bible',
  title: 'Bible study + prayer',
  type: 'daily',
  color: '#fff',
  scheduledDays: [0, 1, 2, 3, 4, 5, 6],
  archived: false,
  createdAt: '2026-11-01',
  reminderTime: '05:30',
  ...partial,
});

function cloud(goals: Goal[], extra: Partial<CloudData> = {}): CloudData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { savedPhotos, ...rest } = createEmptyState();
  return { ...rest, goals, ...extra };
}

describe('session cookies', () => {
  const user = { sub: 'g-123', email: 'a@b.c', name: 'Ada' };

  it('round-trips a valid token', () => {
    expect(verifySessionToken(createSessionToken(user, SECRET), SECRET)).toEqual(user);
  });

  it('rejects tampered, wrongly signed or expired tokens', () => {
    const token = createSessionToken(user, SECRET);
    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...user, sub: 'someone-else', exp: 9e9 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(verifySessionToken(`${body}.${sig}x`, SECRET)).toBeNull();
    expect(verifySessionToken(token, 'y'.repeat(40))).toBeNull();
    expect(verifySessionToken(createSessionToken(user, SECRET, 0), SECRET)).toBeNull(); // expired in 1970
  });

  it('reads the cookie header', () => {
    const req = { headers: { cookie: 'a=1; wg_session=abc%2E123; b=2' } } as unknown as IncomingMessage;
    expect(readCookie(req, 'wg_session')).toBe('abc.123');
  });
});

describe('database', () => {
  let db: Db;

  beforeEach(async () => {
    resetSchemaCache();
    db = pgDb(new PGlite());
    await ensureSchema(db);
    await ensureSchema(db); // safe to run twice
    await upsertUser(db, { sub: 'u1', email: 'u1@x.y', name: 'U1' });
    await upsertUser(db, { sub: 'u2', email: 'u2@x.y', name: 'U2' });
  });

  it('saves data and rejects a write based on an old version', async () => {
    expect(await getUserData(db, 'u1')).toBeNull();
    const v1 = await saveUserData(db, 'u1', cloud([goal({})]), null);
    expect(v1).toBe(1);
    expect(await saveUserData(db, 'u1', cloud([]), null)).toBeNull(); // a second "first save" loses
    const v2 = await saveUserData(db, 'u1', cloud([goal({ title: 'Changed' })]), 1);
    expect(v2).toBe(2);
    expect(await saveUserData(db, 'u1', cloud([]), 1)).toBeNull(); // stale base version
    const stored = await getUserData(db, 'u1');
    expect(stored?.version).toBe(2);
    expect(stored?.data.goals[0].title).toBe('Changed');
  });

  it("keeps each user's data separate", async () => {
    await saveUserData(db, 'u1', cloud([goal({ title: 'Mine' })]), null);
    expect(await getUserData(db, 'u2')).toBeNull();
  });

  it('sends a reminder once, only on time, and skips goals already done', async () => {
    const sent: string[] = [];
    const sender = { send: async (_sub: unknown, payload: string) => void sent.push(JSON.parse(payload).goalId) };
    const goals = [goal({}), goal({ id: 'done-one', title: 'Done already', reminderTime: '05:30' })];
    await saveUserData(db, 'u1', cloud(goals, { entries: [{ id: 'e', goalId: 'done-one', date: '2026-11-17', done: true }] }), null);
    await saveReminders(db, 'u1', remindersFromGoals(goals), 'Africa/Lagos');
    await saveSubscription(db, 'u1', { endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a' });

    // 05:31 in Lagos (UTC+1) on Tuesday 17 Nov 2026 = 04:31 UTC.
    const onTime = new Date('2026-11-17T04:31:00Z');
    expect(await runTick(db, sender, new Date('2026-11-17T04:20:00Z'))).toEqual({ sent: 0, due: 0 }); // too early
    expect(await runTick(db, sender, onTime)).toEqual({ sent: 1, due: 1 });
    expect(sent).toEqual(['bible']);
    expect(await runTick(db, sender, new Date('2026-11-17T04:33:00Z'))).toEqual({ sent: 0, due: 0 }); // already sent today
  });

  it('forgets devices that unsubscribed', async () => {
    const goals = [goal({})];
    await saveUserData(db, 'u1', cloud(goals), null);
    await saveReminders(db, 'u1', remindersFromGoals(goals), 'UTC');
    await saveSubscription(db, 'u1', { endpoint: 'https://push.example/gone', p256dh: 'k', auth: 'a' });
    const gone = { send: async () => Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 })) };
    await runTick(db, gone, new Date('2026-11-17T05:30:00Z'));
    expect(await db.query('select * from push_subscriptions')).toEqual([]);
  });

  it('removes reminders for goals that no longer have a time', async () => {
    await saveReminders(db, 'u1', remindersFromGoals([goal({}), goal({ id: 'gym', reminderTime: '06:00' })]), 'UTC');
    await saveReminders(db, 'u1', remindersFromGoals([goal({}), goal({ id: 'gym', reminderTime: undefined })]), 'UTC');
    const rows = await db.query<{ goal_id: string }>('select goal_id from reminders');
    expect(rows.map((r) => r.goal_id)).toEqual(['bible']);
  });
});
