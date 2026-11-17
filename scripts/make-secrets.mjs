// Prints fresh secrets for cloud backup and alerts. Run:  npm run secrets
// Paste each line into Vercel → Project → Settings → Environment Variables
// (type "Secret", Production). Never commit these.
import { randomBytes } from 'node:crypto';
import * as webpush from 'web-push';

const vapid = webpush.generateVAPIDKeys();
const lines = [
  ['SESSION_SECRET', randomBytes(32).toString('base64url')],
  ['CRON_SECRET', randomBytes(24).toString('base64url')],
  ['VAPID_PUBLIC_KEY', vapid.publicKey],
  ['VAPID_PRIVATE_KEY', vapid.privateKey],
];
console.log('\nAdd these to Vercel (and to .env.local for local testing):\n');
for (const [key, value] of lines) console.log(`${key}=${value}`);
console.log('\nKeep them private. Generating new ones signs everyone out (SESSION_SECRET) or turns alerts off until re-enabled (VAPID).\n');
