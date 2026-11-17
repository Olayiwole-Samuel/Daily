// Browser calls to the cloud endpoints. Every call fails softly: if the
// server or the internet isn't there, the app keeps working from this device.
import type { CloudData } from './shared';

// userId: who the server's session cookie belongs to (null if none).
export type CloudCheck = { userId: string | null; cloud: boolean } | 'offline';

const json = { 'Content-Type': 'application/json' };

export async function checkServerSession(): Promise<CloudCheck> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
    const body = (await res.json()) as { cloud?: boolean; user?: { sub?: string } | null };
    return { userId: res.ok ? body.user?.sub ?? null : null, cloud: !!body.cloud };
  } catch {
    return 'offline';
  }
}

// Swaps Google's access token for our own session cookie.
export async function startServerSession(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', { method: 'POST', headers: json, body: JSON.stringify({ accessToken }), credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function endServerSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined);
}

export type PullResult = { kind: 'data'; data: CloudData; version: number } | { kind: 'empty' } | { kind: 'signedOut' } | { kind: 'unavailable' };

export async function pullCloud(): Promise<PullResult> {
  try {
    const res = await fetch('/api/sync', { credentials: 'same-origin' });
    if (res.status === 404) return { kind: 'empty' };
    if (res.status === 401) return { kind: 'signedOut' };
    if (!res.ok) return { kind: 'unavailable' };
    const body = (await res.json()) as { data: CloudData; version: number };
    return { kind: 'data', data: body.data, version: body.version };
  } catch {
    return { kind: 'unavailable' };
  }
}

export type PushResult = { kind: 'saved'; version: number } | { kind: 'conflict'; data: CloudData; version: number } | { kind: 'signedOut' } | { kind: 'unavailable' };

export async function pushCloud(data: CloudData, baseVersion: number | null): Promise<PushResult> {
  try {
    const res = await fetch('/api/sync', {
      method: 'PUT',
      headers: json,
      credentials: 'same-origin',
      body: JSON.stringify({ data, baseVersion, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (res.status === 401) return { kind: 'signedOut' };
    if (res.status === 409) {
      const body = (await res.json()) as { data: CloudData; version: number };
      return { kind: 'conflict', data: body.data, version: body.version };
    }
    if (!res.ok) return { kind: 'unavailable' };
    return { kind: 'saved', version: ((await res.json()) as { version: number }).version };
  } catch {
    return { kind: 'unavailable' };
  }
}
