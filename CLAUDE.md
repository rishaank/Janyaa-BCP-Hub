# Janyaa BCP Hub — guide for Claude

Club-operations web app for **Janyaa BCP** (the Bellarmine College Prep chapter of the Janyaa
Foundation, a STEM-education nonprofit). It replaces the club's spreadsheets: member directory +
volunteer hours, event sign-ups with to-dos, fundraising, location scouting, and AI insights.

Single-page React app on Supabase, deployed on Vercel. Small, trusted user base (club members).

## Commands

```bash
npm run dev      # Vite dev server on :5173 (needs .env.local — see below)
npm run build    # production build — THIS IS THE VERIFICATION STEP
npm run preview  # serve the build
```

There is **no test suite and no linter configured**. After changes, run `npm run build` to confirm it
compiles. The codebase is **JSX (not TypeScript)** except the Supabase Edge Functions (Deno/TS).

## Tech stack

- **React 19 + Vite 6 + React Router 7** (SPA, `BrowserRouter`)
- **Tailwind CSS v4** (CSS-first config via `@theme`; no `tailwind.config.js`) + `@tailwindcss/vite`
- **Supabase** — Postgres + Auth + Storage + Edge Functions (project ref `sgjcliwmzshhkhjlbdjy`)
- **lucide-react** icons · **recharts** charts · **react-leaflet / leaflet** maps (OpenStreetMap)
- **Gemini API** (`gemini-2.5-flash`) for AI insights, called server-side from an Edge Function
- Deployed on **Vercel** (auto-deploys `main`). Remote: `github.com/rishaank/Janyaa-BCP-Hub`.

## Environment

`.env.local` (gitignored — never commit) holds:

```
VITE_SUPABASE_URL=https://sgjcliwmzshhkhjlbdjy.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key, sb_publishable_...>
```

The "anon key" is actually the new-style **publishable** key — safe for the browser; security is
enforced by Postgres RLS, not by hiding the key. `.env.example` documents this.

## Architecture & conventions

- **All data access goes through `src/lib/api.js`.** Components import named functions from there
  (e.g. `getEvents`, `signUpForEvent`, `adminUpdateProfile`). Don't scatter raw `supabase.from(...)`
  calls through pages. `src/lib/supabase.js` is the single client.
- **Live sync:** `src/lib/useRealtime.js` — `useRealtime(table(s), reloadFn)` subscribes to Postgres
  changes so the UI updates across clients. All core tables are in the `supabase_realtime` publication.
- **Auth:** `src/context/AuthContext.jsx` exposes `session`, `user`, `profile`, `signIn/Up/Out`,
  `updateProfile`. `ProtectedRoute` gates the app; `Login` is the only public page.
  Email/password with **auto-confirm ON** (no email step). `profile.is_admin` drives admin UI.
- **Routing:** `src/App.jsx`. Providers wrap as `ThemeProvider > AuthProvider > BrowserRouter`.
  Pages live in `src/pages/`, shared primitives in `src/components/ui.jsx`.
- **`src/data/mockData.js`** only holds constants now (`CURRENT_TERM`, `eventTypes`,
  `plannedInsights`) — not live data.

## Design system — READ THIS BEFORE TOUCHING UI

The brand system is grounded in the club logo (`public/janyaa-logo.png`). Source of truth:
`src/styles/tailwind-theme.css` (Tailwind v4 `@theme` tokens) and `src/styles/dark-theme.css`
(reference). Applied + extended in `src/index.css`.

- **Brand colors (semantic):** `green` = primary/actions/success · `blue` = Bellarmine/structure/nav/
  links · `gold` = fundraising/progress/attention · `coral` = danger · warm `ink` neutrals + `paper`
  (app bg) + `surface` (cards). Use these, e.g. `bg-green-600`, `text-ink-900`, `border-ink-200`,
  `bg-surface`, `font-display`.
- **Compatibility remap (in `index.css`):** the app was first built on Tailwind's stock palette, so
  `index.css` remaps `slate→ink`, `indigo/emerald/teal→green`, `amber→gold`, `sky/violet→blue`,
  `rose/red→coral`. That means existing `bg-slate-50` / `text-indigo-600` etc. already render on-brand.
  **New code should prefer the brand names directly.**
- **Fonts:** `font-display` = Bricolage Grotesque (headings, big numbers) · default sans = Hanken
  Grotesk (body/UI) · `font-mono` = Space Mono (overlines + tabular numbers, use `tabular-nums` for $/hrs).
- **Radii/shadows** come from tokens: `rounded-xl` ≈ 18px (cards), `rounded-lg` ≈ 14px, warm soft shadows.
- **Members:** big contexts (list, leaderboard, profile header, sidebar) show the uploaded photo via
  `<Avatar src={...}>`. **Inline references use initials in role color via `<MemberChip>`** (event
  attendees, to-do owners) — keep that consistent and clickable to `/members/:id`.

### Dark mode

`src/context/ThemeContext.jsx` toggles `light | dark | system` (default system), persisted to
`localStorage('janyaa-theme')`, applied as `data-theme="dark"` on `<html>`. A small inline script in
`index.html` sets it before paint (no flash). The whole app flips because `index.css` overrides the
brand tokens under `:root[data-theme='dark']`. **Gotchas when adding UI:**

- Brand `-700` steps (e.g. `green-700`, `blue-700`) are remapped to *light* text in dark mode, so they
  **cannot** be used as gradient backgrounds. Brand gradients use `-800` steps (which aren't flipped),
  e.g. `from-blue-800 to-green-800`.
- A panel that is *always* dark (e.g. the login brand panel) must use fixed `text-white/xx`, not a
  light brand tint, or it'll go invisible in dark mode.
- Recharts can't read CSS vars in SVG attributes — grid/axis use translucent warm rgba so they read in
  both themes; data series use brand hex.

## Database (Supabase)

Base schema is `supabase/schema.sql`; incremental changes are `supabase/migrations/0002…0007*.sql`
(all already applied to the live project). Tables: `profiles`, `events`, `event_signups`,
`event_todos`, `locations`, `club_settings` (single shared row, `id = true`).

**To change the schema:** write a new `supabase/migrations/000N_*.sql` AND apply it — via the
**Supabase MCP** (`apply_migration` / `execute_sql` / `deploy_edge_function`, configured in `.mcp.json`,
needs auth) or by pasting the SQL into the Supabase dashboard SQL editor. After DDL, run
`get_advisors` (security) if the MCP is available.

**RLS model (deliberate — small trusted club):** any signed-in member can read everything and manage
shared data (events / todos / locations / `club_settings`). Sign-ups are own-row only. Profiles are
**admin-only to edit** (`is_admin()` SECURITY DEFINER helper + admin override policies); the prior
self-update policy was dropped (migration 0005). First member was bootstrapped as admin.

**Hours model:** a member's hours = sum of `events.hours` for **past** events they signed up for, plus
`profiles.hours_adjustment` (admin correction). The admin hours stepper on the profile page shows the
*total* and writes the adjustment delta behind the scenes.

**Fundraising:** `club_settings.raise_target` is the shared goal (anyone can edit). GoFundMe figures
(`gofundme_raised/goal/donations`) are scraped server-side. Per-event in-person revenue is `events.raised`.

**Avatars:** public `avatars` storage bucket, users can only write their own `uid/…` folder;
`profiles.avatar_url` holds the public URL.

## Edge Functions (`supabase/functions/`)

Deployed via the Supabase MCP (`deploy_edge_function`) or the Supabase CLI.

- **`sync-gofundme`** (`verify_jwt: false`) — scrapes the GoFundMe campaign in `club_settings.gofundme_url`
  (parses the `__NEXT_DATA__` Apollo cache) and writes the totals back. Runs on a **pg_cron schedule
  (every 3h)** + on the Fundraising page load + a manual "Sync now" button.
- **`calendar`** (`verify_jwt: false`) — serves all events as an `.ics` feed for calendar subscriptions
  (the Events page "Subscribe" button).
- **`ai-insights`** (`verify_jwt: true`) — pulls real club data, asks Gemini for actionable insights,
  caches them in `club_settings.ai_insights`. **Requires the `GEMINI_API_KEY` secret** (set in Supabase
  → Edge Functions → Secrets; free Gemini API tier). Admin can force-regenerate; auto-regenerates
  (throttled ~10 min) when an event or the GoFundMe total changes. Falls back to a "not set up" message
  if the key is missing.

## Deployment (Vercel)

- Push to `main` → Vercel auto-builds & deploys. Production URL: `janyaa-bcp-hub.vercel.app`.
- Vercel **Environment Variables** must hold `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (not in repo).
- `vercel.json` has the **SPA fallback rewrite** (`/(.*) → /index.html`) so deep links like `/events`
  work on hard refresh. Don't remove it.
- After deploying, the Supabase **Auth → URL Configuration** Site/Redirect URLs should include the
  Vercel domain.

## Gotchas / house rules

- Only commit or push when the user asks. Commit-message trailer: `Co-Authored-By: Claude …`.
- Build is the gate (no tests). Most pages are behind auth, so you usually can't screenshot them in a
  preview — verify with `npm run build` + reasoning, and ask the user to eyeball auth'd screens.
- `src/pages/Restaurants.jsx` is an **intentional placeholder** ("coming soon").
- The bundle-size warning on build is known/acceptable (Leaflet + Recharts); not an error.
- Keep changes scoped and on-brand; don't reintroduce raw `slate/indigo/...` when a brand token fits.
