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
- **lucide-react** icons · **recharts** charts · **react-leaflet / leaflet** maps (OpenStreetMap) ·
  **react-easy-crop** (avatar + theme image cropping)
- **Gemini API** (`gemini-2.5-flash`) for AI insights, called server-side from an Edge Function
- Deployed on **Vercel** (auto-deploys `main`). Remote: `github.com/rishaank/Janyaa-BCP-Hub` —
  a **public** repo, so the What's-new bell can read its commits via the unauthenticated GitHub API.

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
  `updateProfile`. **The Dashboard (`/`) is public** — viewable logged-out via the
  `get_public_dashboard()` RPC (returns only the dashboard's own data: counts, hours, fundraising,
  leaderboard, insights, goals, upcoming events/meetings — no emails, no raw tables). `ProtectedRoute`
  gates **every other** page; the sidebar shows those locked (→ `/login`) and the account card becomes a
  Sign-in CTA for guests. Other public routes are `Login` and `SetPassword` (`/set-password` — the
  landing for invite + reset email links; calls `auth.updateUser`). Email/password with **auto-confirm
  ON** (no email step). `profile.is_admin` drives admin UI; admin-only pages (e.g. `/history`) are gated
  in the sidebar nav **and** by RLS.
- **Routing:** `src/App.jsx`. Providers wrap as `ThemeProvider > AuthProvider > BrowserRouter`. The
  `<Layout>` shell wraps **both** the public `/` and the `<ProtectedRoute>`-gated children. Pages live in
  `src/pages/`, shared primitives in `src/components/ui.jsx`.
- **`src/data/mockData.js`** only holds constants now (`CURRENT_TERM` = "Summer 2026", `eventTypes`,
  `plannedInsights`) — not live data.
- **Notable pages** (`src/pages/`): `Dashboard` (**public**, all data via `getPublicDashboard`; stat chips
  with **upcoming events + meetings split side by side**, hours leaderboard with a **This term / All time**
  toggle, active goals, top AI-insight chips), `Members` / `ProfilePage` (**Founder** + **Admin** badges,
  avatar cropping, admin Account controls), `Events` (**List ↔ Calendar** toggle via `EventsCalendar.jsx`;
  times, Maps link, linked Instagram posts, to-dos; **Tentative events** — a `Tentative` flag + “TBD”
  date/time/location), `Meetings` (`/meetings` — leaner cards: title/date/time/attendance/notes;
  **recurring schedules** in `meeting_series` auto-materialize occurrences you can cancel or edit
  individually), `Fundraising`, `Goals` (`/goals` — leadership goals with owner/progress/target date, any
  signed-in member can edit, surfaced on the dashboard), `Locations` (Leaflet, dark-aware tiles),
  `Insights` (Gemini), `History` (admin audit + GitHub commits), `ClubInfo` (`/club-info`,
  member-accessible — Janyaa reference links + impact facts), `Restaurants` (placeholder). AI insight
  cards are the shared `src/components/InsightCard.jsx` (Dashboard + Insights). GitHub commits come from
  `src/lib/useGithubCommits.js` (30-min `localStorage` cache).

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

### Theming (light / dark / custom)

`src/context/ThemeContext.jsx` toggles `light | dark | system | custom` (default system), persisted to
`localStorage('janyaa-theme')`. Light/dark/system apply `data-theme="dark"` on `<html>` (a small inline
script in `index.html` sets it before paint; the whole app flips via `index.css` token overrides under
`:root[data-theme='dark']`). **`custom`** is a per-user **image theme** (`src/lib/customTheme.js` +
`src/components/CustomThemeModal.jsx`, the 4th icon in the sidebar theme switcher): an uploaded
background (compressed to a data URL in `localStorage('janyaa-custom-theme')`) plus an auto-extracted,
overridable palette, applied as inline CSS-var overrides on `<html>` — `--color-paper` goes transparent
over the photo (with a `--ja-veil` scrim for contrast) and surface/text/accent + the ink ramp are
overridden. Picking light/dark/system clears the overrides but keeps the saved image. **Gotchas when
adding UI:**

- Brand `-700` steps (e.g. `green-700`, `blue-700`) are remapped to *light* text in dark mode, so they
  **cannot** be used as gradient backgrounds. Brand gradients use `-800` steps (which aren't flipped),
  e.g. `from-blue-800 to-green-800`.
- A panel that is *always* dark (e.g. the login brand panel) must use fixed `text-white/xx`, not a
  light brand tint, or it'll go invisible in dark mode.
- Recharts can't read CSS vars in SVG attributes — grid/axis use translucent warm rgba so they read in
  both themes; data series use brand hex.

## Database (Supabase)

Base schema is `supabase/schema.sql`; incremental changes are `supabase/migrations/0002…0014*.sql`
(all already applied to the live project). Tables: `profiles`, `events`, `event_signups`,
`event_todos`, `meetings` / `meeting_series` / `meeting_attendees` (club meetings — see below),
`goals` (leadership goals), `locations`, `club_settings` (single shared row, `id = true`),
`activity_log` (admin-only audit trail). Notable added columns:

- **`events`:** `address`, `start_time` / `end_time` (migration 0008 — when set, the calendar feed emits
  a timed block with a `VTIMEZONE` for America/Los_Angeles), `instagram_urls` (`text[]` of linked IG
  posts shown on the event card; migration 0012), `is_tentative` + **nullable `date`** (migration 0013 —
  a not-yet-confirmed event whose date/time/location can be left “TBD”; tentative events bucket into their
  own section, never earn hours, and are marked `STATUS:TENTATIVE` / skipped in the `.ics` feed).
- **`profiles`:** `is_admin`, `hours_adjustment`, `avatar_url`, and `is_founder` (migration 0012 — drives
  the **Founder** badge on Members + the profile header; set on the club founders).
- **`club_settings`:** `term_start_date` (migration 0013 — when the current term began; default
  `2026-06-01`, so the dashboard hours leaderboard's **This term** view resets each term).
- **Meetings (migration 0013):** `meeting_series` holds recurring schedules (weekday + time);
  `api.ensureUpcomingMeetings()` materializes concrete `meetings` rows for the next ~8 weeks on
  Meetings-page load (idempotent — a unique `(series_id, date)` index means edited/cancelled occurrences
  are never recreated). `meeting_attendees` is own-row attendance (like `event_signups`).
- **`get_public_dashboard()` (migration 0014):** SECURITY DEFINER RPC, granted to `anon`, that returns the
  whole dashboard payload (no emails/raw tables) so `/` works logged-out. `src/lib/api.js` →
  `getPublicDashboard()`.

**To change the schema:** write a new `supabase/migrations/000N_*.sql` AND apply it — via the
**Supabase MCP** (`apply_migration` / `execute_sql` / `deploy_edge_function`, configured in `.mcp.json`,
needs auth) or by pasting the SQL into the Supabase dashboard SQL editor. After DDL, run
`get_advisors` (security) if the MCP is available.

**RLS model (deliberate — small trusted club):** any signed-in member can read everything and manage
shared data (events / todos / meetings / `meeting_series` / goals / locations / `club_settings`).
Sign-ups and meeting attendance are own-row only. Profiles are **admin-only to edit** (`is_admin()`
SECURITY DEFINER helper + admin override policies); the prior self-update policy was dropped
(migration 0005). First member was bootstrapped as admin. (The dashboard's anonymous read path is the
`get_public_dashboard()` RPC, not table-level `anon` grants.)

**Hours model:** a member's hours = sum of `events.hours` for **past** events they signed up for, plus
`profiles.hours_adjustment` (admin correction). The admin hours stepper on the profile page shows the
*total* and writes the adjustment delta behind the scenes. The dashboard leaderboard toggles **This term**
(only past events on/after `club_settings.term_start_date`; adjustments excluded) vs **All time**; both are
computed in `get_public_dashboard()`. Tentative events never count.

**Fundraising:** `club_settings.raise_target` is the shared goal (anyone can edit). GoFundMe figures
(`gofundme_raised/goal/donations`) are scraped server-side. Per-event in-person revenue is `events.raised`.

**Avatars:** public `avatars` storage bucket, users can only write their own `uid/…` folder;
`profiles.avatar_url` holds the public URL. Photos are square-cropped client-side
(`AvatarCropper`, react-easy-crop) before upload.

**Activity log (migration 0009, extended in 0013):** `activity_log` gets one human-readable row per
change (events / signups / to-dos / meetings / `meeting_series` / goals / locations / profiles /
fundraising goal), written by the `log_activity()` SECURITY DEFINER trigger on each table (captures
`auth.uid()`; NULL ⇒ "System" for cron/edge functions). Auto-generated recurring meeting occurrences are
**not** logged (the schedule is); goal completion logs as `completed`. **RLS: admins read only**; nothing
writes directly (only the trigger does — its EXECUTE is revoked from `public`). It's in the realtime
publication, so the admin `/history` page (which also merges in GitHub commits as "website updates" via
`useGithubCommits`) updates live.

## Edge Functions (`supabase/functions/`)

Deployed via the Supabase MCP (`deploy_edge_function`) or the Supabase CLI.

- **`sync-gofundme`** (`verify_jwt: false`) — scrapes the GoFundMe campaign in `club_settings.gofundme_url`
  (parses the `__NEXT_DATA__` Apollo cache) and writes the totals back. Runs on a **pg_cron schedule
  (every 3h)** + on the Fundraising page load + a manual "Sync now" button.
- **`calendar`** (`verify_jwt: false`) — serves all events as an `.ics` feed for calendar subscriptions
  (the Events page "Subscribe" button). Tentative events are marked `STATUS:TENTATIVE` + `[Tentative]`
  prefix; undated ones are skipped.
- **`ai-insights`** (`verify_jwt: true`) — pulls real club data, asks Gemini for actionable insights,
  caches them in `club_settings.ai_insights`. Now also feeds **club meetings** (with attendance) and
  **leadership goals** (with % progress), and flags **tentative** events as unconfirmed (so Gemini treats
  them as plans, never as earned hours/money). **Requires the `GEMINI_API_KEY` secret** (set in Supabase
  → Edge Functions → Secrets; free Gemini API tier). Admin can force-regenerate; auto-regenerates
  (throttled ~10 min) when an event or the GoFundMe total changes. Falls back to a "not set up" message
  if the key is missing.
- **`admin-users`** (`verify_jwt: true`) — admin-only account management needing the service role:
  create (with a set password OR an emailed invite), set password, send reset email, delete. Confirms
  the caller is an admin (`profiles.is_admin`) before acting. Called via `src/lib/api.js`
  (`adminCreateUser` / `adminInviteUser` / `adminSetPassword` / `adminSendReset` / `adminDeleteUser`),
  surfaced in the Members "Add member" modal + the profile page's admin Account section.
- **`send-reminders`** (`verify_jwt: false`) — emails each member the to-do items they claimed for
  events happening **tomorrow**, via the club Gmail over SMTP. Runs daily on a **pg_cron schedule
  (15:00 UTC ≈ 8 AM PT, migration 0010)** + a manual admin "Email reminders" button on the Events page.
  **Requires the `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `FROM_EMAIL` secrets** (the
  club Gmail + an app password — the same custom-SMTP creds Supabase uses for invite/reset emails).
  Returns a "SMTP not set" message until configured.

## Deployment (Vercel)

- Push to `main` → Vercel auto-builds & deploys. Production URL: `janyaa-bcp-hub.vercel.app`.
- Vercel **Environment Variables** must hold `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (not in repo).
- `vercel.json` has the **SPA fallback rewrite** (`/(.*) → /index.html`) so deep links like `/events`
  work on hard refresh. Don't remove it.
- After deploying, the Supabase **Auth → URL Configuration** Site/Redirect URLs should include the
  Vercel domain **and `…/set-password`** (so invite/reset email links land in the app). For those
  emails to actually send, **custom SMTP** must be set (Project Settings → Auth → SMTP — the club
  Gmail + app password); the same creds go in the Edge Function secrets for `send-reminders`.

## Gotchas / house rules

- Only commit or push when the user asks. Commit-message trailer: `Co-Authored-By: Claude …`.
- Build is the gate (no tests). Most pages are behind auth, so you usually can't screenshot them in a
  preview — verify with `npm run build` + reasoning, and ask the user to eyeball auth'd screens.
- `src/pages/Restaurants.jsx` is an **intentional placeholder** ("coming soon").
- The bundle-size warning on build is known/acceptable (Leaflet + Recharts); not an error.
- Keep changes scoped and on-brand; don't reintroduce raw `slate/indigo/...` when a brand token fits.
- The repo is **public** on purpose — required for the **What's-new** bell + History "website updates"
  to read commit messages via the unauthenticated GitHub API. Never commit secrets (`.env.local` is
  gitignored; only the publishable Supabase key appears in code, which is safe).
- Custom **SMTP is configured** (the club Gmail + an app password) for Auth invite/reset emails **and**
  reused as the `SMTP_*` Edge Function secrets for `send-reminders`. Gmail rejects an app password with
  spaces — store the 16 chars with **no spaces**.
