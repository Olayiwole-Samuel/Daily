/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Lets `npm run dev` serve the server functions in /api too, so you don't need
// `vercel dev` for local work. /api/auth/session loads api/auth/session.ts, and so on,
// with the same req.body / req.query / res.status().json() helpers Vercel provides.
// Dev only; on Vercel the real platform runs the functions.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        // Only real function files: no helper folders (_lib) and no path tricks.
        const route = url.pathname.replace(/\/+$/, '');
        if (!/^(\/[a-z0-9-]+)+$/.test(route) || !existsSync(path.join(process.cwd(), 'api', `${route}.ts`))) return next();

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        const vercelReq = Object.assign(req, {
          body: raw && (req.headers['content-type'] ?? '').includes('json') ? JSON.parse(raw) : undefined,
          query: Object.fromEntries(url.searchParams),
        });
        const vercelRes = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return vercelRes;
          },
          json(data: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return vercelRes;
          },
        });
        try {
          const mod = await server.ssrLoadModule(`/api${route}.ts`);
          await mod.default(vercelReq, vercelRes);
        } catch (error) {
          console.error(error);
          if (!res.headersSent) vercelRes.status(500).json({ ok: false, code: 'server_error', message: 'Dev server error.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only secrets from .env.local (like ANTHROPIC_API_KEY) available to
  // the dev API above. Only VITE_-prefixed variables ever reach the browser bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const serverOnly = ['ANTHROPIC_API_KEY', 'DATABASE_URL', 'SESSION_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'CRON_SECRET', 'VITE_GOOGLE_CLIENT_ID'];
  for (const key of serverOnly) if (env[key]) process.env[key] = env[key];

  return {
    plugins: [
      react(),
      devApi(),
      // Makes the app installable to the home screen and work offline.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        workbox: {
          // Never answer /api requests from the offline cache.
          navigateFallbackDenylist: [/^\/api\//],
          // Adds goal-time alert handling (public/push-sw.js) to the service worker.
          importScripts: ['push-sw.js'],
        },
        manifest: {
          name: 'Weekly Goals',
          short_name: 'Goals',
          description: 'Turn a weekly plan into a daily checklist with streaks.',
          theme_color: '#05010f',
          background_color: '#05010f',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    test: {
      environment: 'node',
    },
  };
});
