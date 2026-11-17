// Database access (Neon Postgres). Every query is parameterised ($1, $2...),
// never built by gluing strings together, so user data can't inject SQL.
import { neon } from '@neondatabase/serverless';
import type { CloudData, Reminder } from '../../src/sync/shared.js';

// The tiny interface the rest of the server uses. Tests plug in an in-memory
// Postgres (PGlite) with the same shape.
export interface Db {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
}

let cached: Db | null | undefined;

export function getDb(): Db | null {
  if (cached !== undefined) return cached;
  // The Vercel Neon integration sets DATABASE_URL (older setups: POSTGRES_URL).
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return (cached = null);
  if (url === 'memory') return (cached = memoryDb());
  const sql = neon(url);
  cached = {
    query: async <T>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[],
  };
  return cached;
}

// LOCAL DEVELOPMENT ONLY: DATABASE_URL=memory runs a throwaway Postgres in
// memory (PGlite), so sync can be tried without a Neon account. The package
// name is in a variable so Vercel never bundles this dev tool into the server.
function memoryDb(): Db {
  const pkg = '@electric-sql/pglite';
  const ready = import(/* @vite-ignore */ pkg).then(({ PGlite }: { PGlite: new () => { query: <T>(t: string, p?: unknown[]) => Promise<{ rows: T[] }> } }) => new PGlite());
  return { query: async <T>(text: string, params: unknown[] = []) => (await (await ready).query<T>(text, params)).rows };
}

let schemaReady: Promise<void> | null = null;

// Creates the tables on first use. Safe to run many times.
export function ensureSchema(db: Db): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`create table if not exists users (
        id text primary key,
        email text not null,
        name text not null default '',
        created_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now()
      )`);
      await db.query(`create table if not exists user_data (
        user_id text primary key references users(id) on delete cascade,
        data jsonb not null,
        version integer not null default 1,
        updated_at timestamptz not null default now()
      )`);
      await db.query(`create table if not exists reminders (
        user_id text not null references users(id) on delete cascade,
        goal_id text not null,
        title text not null,
        time text not null,
        days integer[] not null,
        time_zone text not null,
        last_sent_on text,
        primary key (user_id, goal_id)
      )`);
      await db.query(`create table if not exists push_subscriptions (
        endpoint text primary key,
        user_id text not null references users(id) on delete cascade,
        p256dh text not null,
        auth text not null,
        created_at timestamptz not null default now()
      )`);
    })().catch((error) => {
      schemaReady = null; // try again next time
      throw error;
    });
  }
  return schemaReady;
}

// For tests: forget the cached schema promise when a fresh database is used.
export function resetSchemaCache(): void {
  schemaReady = null;
}

// ---------- Users ----------

export async function upsertUser(db: Db, user: { sub: string; email: string; name: string }): Promise<void> {
  await db.query(
    `insert into users (id, email, name) values ($1, $2, $3)
     on conflict (id) do update set email = excluded.email, name = excluded.name, last_seen_at = now()`,
    [user.sub, user.email, user.name],
  );
}

// ---------- Synced app data ----------

export interface StoredData {
  data: CloudData;
  version: number;
}

export async function getUserData(db: Db, userId: string): Promise<StoredData | null> {
  const rows = await db.query<{ data: CloudData | string; version: number }>(`select data, version from user_data where user_id = $1`, [userId]);
  if (rows.length === 0) return null;
  const data = typeof rows[0].data === 'string' ? (JSON.parse(rows[0].data) as CloudData) : rows[0].data;
  return { data, version: rows[0].version };
}

// Saves only if nobody else saved in between (optimistic concurrency):
// the caller says which version it started from. Returns the new version, or
// null if the stored version moved on (the caller must merge and retry).
export async function saveUserData(db: Db, userId: string, data: CloudData, baseVersion: number | null): Promise<number | null> {
  const json = JSON.stringify(data);
  if (baseVersion === null) {
    const inserted = await db.query<{ version: number }>(
      `insert into user_data (user_id, data, version) values ($1, $2::jsonb, 1)
       on conflict (user_id) do nothing returning version`,
      [userId, json],
    );
    return inserted.length > 0 ? inserted[0].version : null;
  }
  const updated = await db.query<{ version: number }>(
    `update user_data set data = $2::jsonb, version = version + 1, updated_at = now()
     where user_id = $1 and version = $3 returning version`,
    [userId, json, baseVersion],
  );
  return updated.length > 0 ? updated[0].version : null;
}

// ---------- Reminders ----------

// Replaces this user's reminders with the current list from their goals.
export async function saveReminders(db: Db, userId: string, reminders: Reminder[], timeZone: string): Promise<void> {
  await db.query(`delete from reminders where user_id = $1 and not (goal_id = any($2::text[]))`, [userId, reminders.map((r) => r.goalId)]);
  for (const r of reminders) {
    await db.query(
      `insert into reminders (user_id, goal_id, title, time, days, time_zone) values ($1, $2, $3, $4, $5::integer[], $6)
       on conflict (user_id, goal_id) do update set title = excluded.title, time = excluded.time,
         days = excluded.days, time_zone = excluded.time_zone`,
      [userId, r.goalId, r.title, r.time, r.days, timeZone],
    );
  }
}

export interface ReminderRow {
  user_id: string;
  goal_id: string;
  title: string;
  time: string;
  days: number[];
  time_zone: string;
  last_sent_on: string | null;
}

// Reminders for users who have at least one device subscribed to alerts.
export async function remindersWithSubscribers(db: Db): Promise<ReminderRow[]> {
  return db.query<ReminderRow>(
    `select r.* from reminders r where exists (select 1 from push_subscriptions s where s.user_id = r.user_id)`,
  );
}

export async function markReminderSent(db: Db, userId: string, goalId: string, localDate: string): Promise<void> {
  await db.query(`update reminders set last_sent_on = $3 where user_id = $1 and goal_id = $2`, [userId, goalId, localDate]);
}

// ---------- Push subscriptions ----------

export interface SubscriptionRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

export async function saveSubscription(db: Db, userId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  await db.query(
    `insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [sub.endpoint, userId, sub.p256dh, sub.auth],
  );
}

export async function deleteSubscription(db: Db, endpoint: string, userId?: string): Promise<void> {
  if (userId) await db.query(`delete from push_subscriptions where endpoint = $1 and user_id = $2`, [endpoint, userId]);
  else await db.query(`delete from push_subscriptions where endpoint = $1`, [endpoint]);
}

export async function subscriptionsFor(db: Db, userId: string): Promise<SubscriptionRow[]> {
  return db.query<SubscriptionRow>(`select endpoint, user_id, p256dh, auth from push_subscriptions where user_id = $1`, [userId]);
}
