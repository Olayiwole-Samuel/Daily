// Checks a Google access token from the browser with Google itself, and makes
// sure it was issued to THIS app (not some other site's token being replayed).
import type { SessionUser } from './session.js';

interface TokenInfo {
  aud?: string;
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  expires_in?: string;
}

interface UserInfo {
  name?: string;
}

export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null;
}

export async function verifyGoogleAccessToken(accessToken: string, clientId: string): Promise<SessionUser | null> {
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as TokenInfo;
  const audienceOk = info.aud === clientId || info.azp === clientId;
  if (!audienceOk || !info.sub || !info.email) return null;

  // Name is only in userinfo; it's optional, so a failure here isn't fatal.
  let name = info.email;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (userRes.ok) name = ((await userRes.json()) as UserInfo).name || name;
  } catch {
    // keep the email as the name
  }
  return { sub: info.sub, email: info.email, name };
}
