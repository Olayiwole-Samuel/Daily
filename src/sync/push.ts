// Turning goal-time alerts (web push) on and off for this device.

export type AlertsSupport = 'supported' | 'needsHomeScreen' | 'unsupported';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function alertsSupport(): AlertsSupport {
  // iPhones only allow web push for apps added to the home screen (iOS 16.4+).
  if (isIOS() && !isInstalled()) return 'needsHomeScreen';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'supported' : 'unsupported';
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // The service worker only exists in the built app (not in `npm run dev`).
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
  return reg;
}

export async function alertsEnabled(): Promise<boolean> {
  const reg = await registration();
  return !!reg && !!(await reg.pushManager.getSubscription());
}

// The server's public key arrives as base64url text; the browser wants bytes.
function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function enableAlerts(): Promise<{ ok: true } | { ok: false; message: string }> {
  const support = alertsSupport();
  if (support === 'needsHomeScreen') return { ok: false, message: 'On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then turn alerts on from there.' };
  if (support === 'unsupported') return { ok: false, message: "This browser can't show alerts. Try Chrome, or the installed app." };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, message: 'Alerts are blocked. Allow notifications for this app in your phone settings.' };

  const keyRes = await fetch('/api/push/subscribe').catch(() => null);
  const publicKey = keyRes?.ok ? ((await keyRes.json()) as { publicKey: string | null }).publicKey : null;
  if (!publicKey) return { ok: false, message: "Alerts aren't set up on the server yet." };

  const reg = await registration();
  if (!reg) return { ok: false, message: 'Alerts need the installed app (they don’t work in the dev preview).' };
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));

  const saved = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  }).catch(() => null);
  if (!saved?.ok) return { ok: false, message: saved?.status === 401 ? 'Turn on cloud backup first (alerts need it).' : "Couldn't save alerts. Try again." };
  return { ok: true };
}

export async function disableAlerts(): Promise<void> {
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe();
}
