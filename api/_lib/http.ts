import type { VercelResponse } from '@vercel/node';

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { error: 'method_not_allowed' });
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Only accept real IANA time zones like "Africa/Lagos" (Intl throws on others).
export function validTimeZone(value: unknown): string {
  if (typeof value === 'string' && value.length < 64) {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: value });
      return value;
    } catch {
      // fall through
    }
  }
  return 'UTC';
}
