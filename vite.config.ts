/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Lets `npm run dev` serve the /api/coach server function too, so you don't need
// `vercel dev` for local work. It loads api/coach.ts and gives it the same
// req.body / res.status().json() helpers Vercel provides. Dev only; on Vercel
// the real platform runs the function.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/coach', async (req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        const vercelReq = Object.assign(req, { body: raw ? JSON.parse(raw) : undefined });
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
          const mod = await server.ssrLoadModule('/api/coach.ts');
          await mod.default(vercelReq, vercelRes);
        } catch (error) {
          console.error(error);
          vercelRes.status(500).json({ ok: false, code: 'server_error', message: 'Dev server error.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only secrets from .env.local (like ANTHROPIC_API_KEY) available to
  // the dev API above. Only VITE_-prefixed variables ever reach the browser bundle.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

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
