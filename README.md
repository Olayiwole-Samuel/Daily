# Weekly Goals

A personal weekly goals tracker: daily checklist, weekly progress, streaks and a food log.
Runs entirely in the browser; data is saved in localStorage under `weekly-goals-v1`.

## Commands

```bash
npm install        # once
npm run dev        # start the dev server at http://localhost:5173
npm test           # run the streak/progress unit tests
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

## Where things live

- `src/types.ts`: the data model
- `src/lib/`: pure functions for dates, progress and streaks (with tests)
- `src/state/`: reducer, context, localStorage, week template
- `src/components/`, `src/pages/`: UI

Progress and streaks are never stored; they're always calculated from entries.
