# Weekly Goals

A personal weekly goals tracker: daily checklist, weekly progress, streaks and a food log.
Runs entirely in the browser; data is saved in localStorage under `weekly-goals-v1`.

## Commands

```bash
npm install        # once
npm run dev        # start the dev server at http://localhost:5173
npm test           # run the unit tests (streaks, progress, coach safety, workouts, migration)
npm run build      # type-check and build to dist/
npm run preview    # serve the built app (PWA/offline works here, not in dev)
```

To try it on your phone on the same Wi-Fi: `npm run dev -- --host`, then open the Network URL it prints.
Installing to the home screen needs HTTPS, so for that deploy `dist/` to a static host (Netlify, Vercel, GitHub Pages).

## Google sign-in setup (one time)

The app requires a Google account to get in. You need a free OAuth client ID:

1. Go to https://console.cloud.google.com, create a project, then open **APIs & Services → OAuth consent screen** and fill in the app name and your email (External, Testing is fine to start; add your testers' emails).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
3. Under **Authorized JavaScript origins** add `http://localhost:5173` and later your real site URL (e.g. `https://your-app.netlify.app`).
4. Copy `.env.example` to `.env.local` and paste the client ID after `VITE_GOOGLE_CLIENT_ID=`. Restart `npm run dev`.

Until that's set, dev mode shows a "Continue in dev mode" button so you can keep building. Production builds have no such bypass.

Note: data is still stored on the device (one slot per Google account). Signing in on a new phone starts empty; syncing between devices needs a backend (e.g. Supabase or Firebase).

## AI Coach (Part 2)

The Coach tab builds a personal workout plan and a 7-day meal plan with Claude (`claude-sonnet-5-5`).
The browser calls `POST /api/coach`, a Vercel serverless function (`api/coach.ts`) that holds the API key.

**Without a key the Coach still works**: the server returns a clearly labelled sample plan, so you can try
every screen for free.

### Set the API key locally

1. Create a key at https://console.anthropic.com (Settings → API keys).
2. In `.env.local` add a line `ANTHROPIC_API_KEY=sk-ant-...` (no `VITE_` prefix, so it never reaches the browser).
3. Restart `npm run dev`. The dev server runs `/api/coach` for you, so you don't need `vercel dev`.

If you prefer Vercel's own local runner: `npm i -g vercel`, `vercel link`, `vercel env pull .env.local`, then `vercel dev`.

### Set the API key on Vercel

Vercel → project **daily** → Settings → Environment Variables → add `ANTHROPIC_API_KEY`, type **Secret**,
environment **Production**. Then Deployments → latest → **Redeploy**.

### Deploy

`git push` to `main`. Vercel builds the app and the function together (`vercel.json` sets the function's
time limit to 300 s, since writing a full plan takes about a minute).

### Safety rules (enforced in `src/coach/safety.ts`, tested in `src/coach/coach.test.ts`)

- 18+ only; under-18s get general healthy-habit advice instead of targets.
- Calories never below 1,500 (male) / 1,200 (female), and never more than 500 below estimated maintenance (Mifflin-St Jeor).
- BMI under 18.5: no weight-loss plan.
- Health condition, injury or pregnancy: gentler plan plus a "check with your doctor" note.
- Photos are compressed on the phone, sent once, and never stored or logged on the server.
- Limit of 5 plans per device per day. **Limitation:** the count lives in the function's memory, so it resets when
  Vercel restarts the function. For a hard limit, store counts in Upstash Redis (Vercel Marketplace).

## Where things live

- `src/types.ts`: the data model (app data is version 2; `src/state/storage.ts` migrates version 1)
- `src/lib/`: pure functions for dates, progress and streaks (with tests)
- `src/state/`: reducer, context, localStorage, week template
- `src/coach/`: Coach schemas (zod, shared with the server), safety rules, workout helpers, photo compression
- `api/`: the server function; `api/_lib/` holds its helpers (folders starting with `_` aren't endpoints)
- `src/components/`, `src/pages/`: UI (`src/pages/coach/` for the Coach screens)

Progress and streaks are never stored; they're always calculated from entries.
