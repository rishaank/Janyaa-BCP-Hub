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
  `updateProfile`. The provider shows a sub-second brand **splash** until the session resolves from
  localStorage (so signed-in users never flash the guest UI) and **caches the profile row** in
  `localStorage('janyaa-profile')`, hydrating it instantly on the next visit (role/admin nav doesn't
  pop in late). **The Dashboard (`/`) is public** — viewable logged-out via the
  `get_public_dashboard()` RPC (returns only the dashboard's own data: counts, hours, fundraising,
  leaderboard, insights, goals, upcoming events/meetings — no emails, no raw tables). `ProtectedRoute`
  gates **every other** page; the sidebar shows those locked (→ `/login`) and the account card becomes a
  Sign-in CTA for guests. Other public routes are `Login`, `SetPassword` (`/set-password` — the
  landing for invite + reset links; verifies the link's `token_hash` with `verifyOtp` then calls
  `auth.updateUser`. **A one-time token must be spent by a tap, never by a page load.** Both Edge
  Functions rewrite `generateLink`'s result to `…/set-password?token_hash=…&type=…` — never hand out
  Supabase's `/auth/v1/verify` URL, which is spent by the first GET of it — and the page then holds
  that token behind a **Continue** button. Anything that opens a link before its owner does kills it:
  Apple's iMessage preview *runs the page's JavaScript*, Slack/WhatsApp fetch it, a school mailbox
  scans it, and StrictMode mounts this page twice in dev. Never verify in an effect. The page also
  honours `error_code` rather than falling through to whatever session the browser already holds.
  **Verifying a link signs that member in** — that is what a recovery token is, and why it is worth
  guarding — so the page names the account it is acting on, warns when it is about to displace
  whoever is already signed in, and **signs the session back out if you leave without setting a
  password** (an admin testing a member's link used to walk away signed in as that member). Only a
  session this page opened is dropped that way, never one the browser already had), and the **`/privacy` + `/terms`**
  legal pages (`LegalPage.jsx`, linked from the Login screen + the `Layout` footer). **Signup is
  invite-only** — admins create accounts (the public Login is sign-in only); a member can **delete their
  own account + data** from their profile (`deleteOwnAccount` → admin-users `deleteSelf`, the California
  SB 568 "eraser" right). Email/password with **auto-confirm ON** (no email step). `profile.is_admin` drives admin UI; admin-only pages (e.g. `/history`) are gated
  in the sidebar nav **and** by RLS.
- **Onboarding a member: hand over a temporary password, not a link.** A one-time link is the
  fragile option — anything that opens it first spends it (a message preview that runs JS, a mailbox
  scanner, a tapped-and-abandoned tab), and it dies in an hour. So **Add member** defaults to
  **Temporary password**: `generateTempPassword()` (`src/lib/tempPassword.js`, unambiguous alphabet,
  `XXXX-XXXX-XXXX`) fills the field, the admin reads it out or texts it with the member's email, and
  the modal shows it with a Copy button afterwards. `admin-users` stamps
  **`user_metadata.must_set_password`** on any password an admin sets for *someone else* (create + the
  profile's Admin Controls field, which has the same generator); `AuthContext` exposes it as
  `mustSetPassword`. **Don't make that flag the only signal for anything.** Only the Edge Function
  writes `true` and only the app writes `false`, so any `admin-users` deploy older than the feature
  leaves it stuck at whatever the member last set — a failure with no symptom, which cost four rounds
  of debugging that each looked like a frontend bug. `Layout`'s `SetupNudge` therefore fires on
  **`mustSetPassword` OR no saved recovery email** (`getRecoveryEmail`, which the app can read for
  itself): same population, no deploy to get wrong. Dismissible modal, Not now / Take me there → their
  own profile (which carries both the Password and Recovery Email cards). **Four rules in it are scar
  tissue — don't undo them:** the dismissal key is `sessionStorage('janyaa-setup-nudge:<uid>')`,
  **per member**, because sessionStorage is scoped to the tab and a shared key let an admin's dismissal
  silence the member who signed in next in that same tab; the metadata is read with
  `supabase.auth.getUser()` (the server), **never** the persisted session, because setting a member's
  password does not revoke their sessions and an already-signed-in phone holds the metadata snapshot
  from whenever its token was issued; the modal passes **`closeOnVeil={false}`** (a `Modal` prop added
  for it) because it is the app's only unprompted popup and iOS's trailing synthesized click lands on
  a veil that wasn't there when the finger went down; and both lookups race a 5 s timeout, because iOS
  suspends in-flight requests when the member backgrounds the app to copy the password out of Messages,
  and an unsettled promise used to mean the nudge silently never opened. **`/whoami`** (unlisted,
  `WhoAmI.jsx`) prints what the app sees for your own account — build SHA (`__BUILD_SHA__`, injected
  from `VERCEL_GIT_COMMIT_SHA` in `vite.config.js`), recovery email, the flag as held by the browser
  **and** as read from the server, and whether the nudge would fire. Reach for it before theorising. **A recommendation, never a gate** — the admin who
  set that password may have meant it to stand, and nothing in the app is withheld. Invite links still
  exist as the second tab.
- **Password recovery (recovery emails).** Members sign in with their **school Microsoft email**, whose
  tenant quarantines/badly delays our mail — so reset links do **not** go there by default. Each member
  can save a personal **recovery email** (`member_recovery`, migration 0033; own-row + admin RLS, its own
  table so it isn't exposed by the all-members-read `profiles` policy) on their profile. **Reset mail is
  only ever sent to a recovery address — there is deliberately no fallback to the school login address**,
  since a link sent there usually never arrives and the member is left assuming the reset itself failed.
  A member with no recovery address on file therefore can't receive a reset email at all: an admin sets
  them a password instead. **The recovery address is only for the locked-out case.** A signed-in member
  changes their password in place on their own profile (`ChangePasswordCard` → `supabase.auth.updateUser`,
  deep-linked as `/members/:id?password=1`): they have already proved who they are, so mailing them a
  link would be a slower route to the same call. That form does ask for the **current** password
  (verified with `signInWithPassword` on the same user, which only refreshes the session) — that is
  what stops someone at an unlocked laptop from taking the account over. The Dashboard shows a gold **"Set a recovery email"** chip (desktop stat-pill
  row + mobile chip row) linking to the member's own profile whenever they haven't set one. The Login
  screen has a **Forgot password?** modal → `requestPasswordReset()`, which accepts *either* the login or
  the recovery address to identify the member; it reports a masked destination **only** when mail actually
  went out, so "no account" and "no recovery address" are indistinguishable. Members edit their recovery email on their own profile — **except admins**, who edit theirs
  inside Admin Controls (the standalone card is hidden for them). The profile's admin **Account** section
  **auto-saves**: name/role/admin, login email and recovery email commit 1.2 s after the last
  keystroke (status line reads Saving… → Saved), so there is no Save button and no unsaved-changes
  prompt. An address still being typed waits — `looksLikeEmail()` gates the write, because half of
  `name@bcp.org` is a plausible `name@bcp` that would otherwise land on the account mid-type.
  **Passwords are deliberately NOT part of that draft** — a generated password sitting in a field looks
  set but isn't, and the admin only finds out when the member can't sign in. They live in **Password
  controls** below it: **Set new** and **Generate temporary**, each opening a modal that commits the
  moment it's confirmed (`adminSetPassword`), the generate one showing **Copy only after the password is live**
  (a Copy button beside an unset password is how an admin texts a password the member can't sign in
  with — the exact failure the modal exists to prevent). Beside them, **Email reset link (legacy)** — labelled that way because the temporary password
  is the path that can't expire or be spent in transit; it runs through the `password-recovery` Edge
  Function and stays disabled until a recovery address is saved. **Copy reset link is gone from the UI**
  (the `adminLink` action remains in the function): a temporary password does the same job without a
  token to lose. Reset links are **single-use**
  and expire per Supabase's **Auth → Providers → Email → Email OTP Expiration** (the reset email states
  1 hour, so keep that setting at 3600s).
- **Routing:** `src/App.jsx`. Providers wrap as `ThemeProvider > ErrorBoundary > AuthProvider >
  BrowserRouter`. The `<Layout>` shell wraps **both** the public `/` and the `<ProtectedRoute>`-gated
  children. Pages live in `src/pages/`, shared primitives in `src/components/ui.jsx`. **Routes are
  code-split** (`React.lazy` + one `<Suspense>`): only Dashboard, Login, and NotFound are eager, so
  Leaflet/Recharts/cropper load per page, not on first paint. `src/components/ErrorBoundary.jsx`
  catches render crashes **and** stale-chunk loads after a redeploy (offers a Reload).
- **`src/data/mockData.js`** only holds constants now (`CURRENT_TERM` = "Summer 2026", `eventTypes`,
  `plannedInsights`) — not live data.
- **Notable pages** (`src/pages/`): `Dashboard` (**public**, all data via `getPublicDashboard`; stat chips
  with **upcoming events + meetings split side by side**, hours leaderboard with a **This term / All time**
  toggle, active goals, top AI-insight chips), `Members` / `ProfilePage` (**Founder** + **Admin** badges,
  avatar cropping, admin Account controls), `Events` (**List ↔ Calendar** toggle via `EventsCalendar.jsx`;
  times, Maps link, linked Instagram posts, to-dos; **Tentative events** — a `Tentative` flag + “TBD”
  date/time/location (they bucket into their own **Tentative** section, which is the only label they
  need: there is deliberately no Tentative chip on the cards, only on the full-screen event view
  where nothing else says so), and members **can sign up for one** (it's how the club gauges interest before
  confirming); the two event screens used to disagree on that, and `EventView` was the one that blocked
  it. An undated event sorts last wherever events are ordered — never dereference `e.date`;
  click any event for a **public, shareable full-screen view** at `/events/:id`
  (`EventView.jsx` — Leaflet map, full Instagram-post embeds, profits/hours/attendees; viewable
  logged-out via the `get_public_event` RPC), `Meetings` (`/meetings` — leaner cards: title/date/time/attendance/notes;
  **recurring schedules** in `meeting_series` auto-materialize occurrences you can cancel or edit
  individually; **tagged links** (`meetings.links`) render as favicon+name chips (`LinkChip.jsx`); click
  any meeting for a **public full-screen view** at `/meetings/:id` (`MeetingView.jsx`, `get_public_meeting`
  RPC — mirrors the event view); a meeting flips **upcoming → past** and grants attendee hours once its
  **end time passes in PST** — see Hours model), `Fundraising` (live Givebutter + the **In-Person Fundraising
  Over Time** graph: a navigable 6-month window ending on the current month, with prev/next arrows, a
  dashed year-boundary line, and a "Jump to current" button), `ClubTerms` (`/club-terms`, sidebar label **Terms** — every club term
  with an expandable breakdown: events, meetings, participants, profits, and a cached per-term **AI
  summary**; admins edit/add terms + toggle **auto terming**; routed at `/club-terms` because `/terms`
  is the legal page), `Goals` (`/goals` — a **person × month grid** (rows = members grouped Leadership /
  Non-Leadership, columns = a Term goal + the current term's months); each cell is a goal card with text +
  progress, done = 100%; admins add/edit and **drag cards** between cells, members are read-only; rows +
  sections collapse; an editable club-wide **Semester targets** strip (`club_settings.term_targets`) also
  shows on the dashboard. Data model: `goals.owner_id` (the person) + `goals.period` (`'TERM'` | `'YYYY-MM'`)
  + `sort`), `AutoHours` (`/auto-hours`, sidebar label **Role Hours** — role-based automatic volunteer hours;
  admin-only, rules editable; each role has a **Grant Now** button + a granted-this-month state, plus a
  "Next auto grant in N days" chip), `Locations` (Leaflet, dark-aware tiles; desktop = full-height map +
  scrollable AI-suggestions/saved panes),
  `Insights` (Gemini), `AIStudio` (`/studio` — **Plan events** wizard (auto-creates an event +
  to-dos + timeline) beside **Event suggestions** (next-event + location ideas), then the **Ask the Janyaa
  assistant** chatbot and monthly **social-media** ideas; every AI block here auto-refreshes monthly),
  `History` (admin audit + GitHub commits), `ClubInfo` (`/club-info`,
  member-accessible — Janyaa reference links + impact facts), `Restaurants` (placeholder). AI insight
  cards are the shared `src/components/InsightCard.jsx` (Dashboard + Insights). GitHub commits come from
  `src/lib/useGithubCommits.js` (30-min `localStorage` cache).
- **Shared UI conventions:**
  - **Auto-hyperlinking:** member-entered free text (event/meeting notes, location notes, meeting
    location, goal text) renders through `<Linkify>` (`src/components/Linkify.jsx`, regex in
    `src/lib/links.js`) so URLs become links. Tagged links render as favicon+name chips via
    `<LinkChip>` (`linkMeta()` recognizes common sites + uses Google's favicon service).
  - **Times are PST.** All event/meeting times are displayed labelled "PST" (the club is in
    America/Los_Angeles); meeting bucketing + hours use that timezone.
  - **Browser tab titles** are per-screen via `useDocumentTitle(suffix)` (`src/lib/useDocumentTitle.js`):
    each page calls it to set `document.title` to `Janyaa BCP Hub | <screen>` (a static label for fixed
    pages, the loaded record's name for detail views like `EventView` / `MeetingView` / `ProfilePage`, the
    active tab for `EventsMeetings`). A falsy suffix (data still loading) leaves just the base. Keep the base
    in sync with the static `<title>` in `index.html`. New routed pages should call it too. **Note:** this only
    updates the live tab title — server-rendered link previews come from `api/og.js` (see Deployment).
  - **Access indicators:** the single `AccessChip` in `ui.jsx` is the standard — `mode="edit"` (blue
    Shield, "Admin edit"/"Admin only") and `mode="view"` (gray Lock, "Read-only"). Page-level access
    goes in the `PageHeader` `badge` slot (a node, beside the title); section-level sits inline after
    that section's heading. `EditAccessChip` is a back-compat wrapper for `mode="edit"`. Don't hand-roll
    new access pills.
  - **Admins can edit attendees** on any event or meeting via `ManageAttendeesModal.jsx` (add/remove
    anyone; meetings also toggle attendee↔contributor) — backed by the admin-all RLS on
    `event_signups` / `meeting_attendees`.
  - **Popups: one z-layer scale, and they always lock the page.** Layers are page content `0` ·
    sticky page headers `z-30` · desktop sidebar `z-40` · mobile bottom sheet `60/61` (`mobile.css`) ·
    modals `z-[200]` · toasts `z-[300]`. **Nothing outside a modal or a toast may exceed `z-30`** — a `z-[500]` header on the
    event/meeting full-screen views used to paint over the modal veil. Leaflet maps don't need a high
    header: wrap the map in `relative z-0 … isolate` (as `EventView` / `Locations` do) and its internal
    panes stay contained. Every overlay calls `useScrollLock()` (`src/lib/useScrollLock.js`), which
    refcounts a `ja-scroll-locked` class on `<html>`; the CSS in `index.css` freezes **both** the
    document scroller *and* the mobile shell's `.jh-body` pane, and pads out the hidden scrollbar so
    the background doesn't shift. The shared `Modal` does this for you — new popups should use it.
  - **Toasts + draft rescue.** `src/context/ToastContext.jsx` (`ToastProvider`, wrapped in `App.jsx`
    inside `AuthProvider`) shows small auto-dismissing chips — bottom-centre above the mobile FAB,
    bottom-right on desktop — with an optional action button and a countdown rail (`.ja-toast-timer`).
    `useToast()` → `showToast({ message, detail, actionLabel, onAction, duration = 7000, tone })`.
    Its main job is **draft rescue** (`src/lib/useDraftRescue.js`): closing a multi-field popup with
    the X, Cancel, or a veil click used to bin everything typed. Now the modal wraps its close in
    `useDraftRescue({ label, value, onClose, reopen })` and, when the fields differ from the baseline,
    the close shows a “<label> draft cleared” chip for 7 s whose **Undo** reopens the popup with every
    field intact. Wired into the event, meeting, recurring-schedule, hours-entry, hours-request, goal,
    semester-targets, add-member, location (save + edit) and term forms; the parent passes an
    `onReopen` beside `onClose`. Two rules make it work: the modal's reset effect must bail out
    **while closed** (`if (!open) return`) so the draft outlives the close, and must bail out on
    `rescue.consumeRestore()` so Undo isn't overwritten. Most form modals stay mounted while closed,
    so their own state holds the draft; one that the parent unmounts (`GoalEditModal`) gets it back
    through `reopen(draft)` → a `draft` field on its `state` prop.
  - **One box for a place.** The event form asks for a location **once**:
    `src/components/LocationPicker.jsx` holds name + address + lat/lng behind a single
    field. Its dropdown ranks **Saved spots** (`locations`, bookmark icon) → **Used before**
    (every past event's place, newest first, history icon, via `getEventPlaces()`) → **live
    place search** (Google Places, OpenStreetMap fallback), each row showing the name large
    with the address as its subtitle. The input carries the name; the resolved address sits
    under it. On submit, a name typed without picking a suggestion is resolved through
    `lookupAddress()` so `location` **and** `address` + coordinates all land in the row —
    the DB columns are unchanged, so every existing display keeps working.
    `LocationAutocomplete.jsx` is the older single-value picker, still used for meetings
    (one free-text location, no address column) and the Locations page.
  - **Optional fields hide until asked for.** In the event form, *Amount raised* and *Notes*
    are behind `+ Add Amount Raised` / `+ Add Notes` buttons styled exactly like the link
    adder, and an edit opens them automatically when the event already has a value
    (`extrasFor`). Collapsing one clears it, so a hidden box never saves an invisible value.
    Form helper text is kept to what a member can't infer — don't re-explain a labelled field.
  - **Native date/time inputs need `appearance: none`.** In WebKit they size themselves from
    their own content and ignore the width they're given, so on iOS the Date / Start / End fields
    rendered wider than every other input — past the modal's own padding. `index.css` pins
    `date`/`time`/`datetime-local`/`month` to `appearance: none` + `box-sizing: border-box` +
    `width: 100%` (and re-styles the WebKit inner parts + picker indicator, which `appearance:
    none` would otherwise strip). Belt and braces, two-column date/time rows are
    `grid-cols-1 gap-3 min-[22rem]:grid-cols-2` so they stack rather than clip on a very narrow
    phone (the event, meeting, term and hours-entry forms) — use that, not a bare `grid-cols-2`.
  - **Row-removal X buttons fire on pointerdown, then eat the trailing click** —
    `RemoveRowButton` in `ui.jsx` (links, optional fields). Two iOS problems: the first tap after
    typing in a field goes to dismissing the keyboard (so act on `pointerdown`, with
    `preventDefault` so focus stays put), and removing the row shifts everything below it upward,
    so the click that still trails the press is hit-tested against the **new** layout — on Safari
    it landed on “Add a Link”, which put the row straight back the instant it went. Hence
    `swallowNextClick()`, which eats exactly one click wherever it lands. That guard lives at
    **module scope on purpose**: the button is usually unmounted by the very action it guards, so
    a guard owned by the component tears itself down before the click it was meant to eat arrives.
    Keyboard activation (a plain click with no press) is left alone. Use it for any new removable
    row. All four paths are worth re-checking with a throwaway probe page against a real browser
    if you touch it — reasoning about this one twice got it wrong twice.
  - **Numbers on screen go through `src/lib/format.js`** — `num(v)` and `money(v)` round to at most
    the hundredths place (a maximum, so whole numbers stay whole) and add thousands separators.
    Hours are derived, not typed — a 50-minute meeting is `0.8333…` hours — so any raw `{x.hours}`
    or `${x.raised}` in JSX is a bug waiting to print a full float. Rounding is display-only; stored
    values keep their precision so totals still sum from the exact figures.

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

### Writing (microcopy) — READ THIS BEFORE WRITING ANY UI TEXT

The Hub is read by busy high-schoolers on a phone between classes. Copy is UI, not documentation.
Every screen was swept once to this standard; keep it there.

1. **Front-load.** The meaning lives in the first two or three words. People scan roughly a quarter
   of what is on screen. "Where **Forgot password?** sends your reset link", not "For the day you're
   locked out, the sign-in screen will mail…".
2. **One idea per line.** Three ideas means three bullets, never one sentence joined by commas.
3. **Parentheses carry examples**, not sentences: `a personal address (Gmail, iCloud)`,
   `(message previews, mailbox scanners)`.
4. **Cut what the label already says.** A card headed *Recovery Email* does not need a line saying it
   is your recovery email. A field labelled *Ends* needs no helper text.
5. **Cut the why.** Keep a reason only when the reader must act differently because of it. No threat
   models, no mail-server history, no architecture. That belongs in this file, not on screen.
6. **Ceiling: about 12 words a line, 2 lines a block.** Past that, bullet it or delete it.
7. **No em dashes.** Use a period, a comma, a colon, or a bullet. They are the loudest AI tell, and
   an audit found 296 of them in this repo. Only exception: a bare `—` as the "no value" glyph in a
   table cell or an empty grid slot (`{m.name || '—'}`), which is a data placeholder, not prose.
8. **Banned filler:** simply, just, easily, actually, seamlessly, please note, in order to, make sure,
   anytime, and more, a full/complete/personal look at, handy, worth a glance.
9. **Speak to the reader.** "You pick your own at first sign-in", not "The Hub asks them to choose
   their own the first time they sign in".
10. **Facts as facts.** `Single use, expires in 1 hour`, not a sentence explaining that the link may
    only be used one time and will stop working after an hour.
11. **Empty states** get what belongs here plus the one action, two lines maximum:
    `No targets yet. Add the club's term targets.`
12. **Status chips** use a colon, not a dash: `Pending: 4h · Bake sale`.

Reference: NN/g on concise + scannable + objective writing, GOV.UK content design, Shopify Polaris
and Atlassian content guidelines.

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

Base schema is `supabase/schema.sql`; incremental changes are `supabase/migrations/0002…0031*.sql`
(all already applied to the live project). Migration 0026 is the **security-hardening** pass: pinned
`search_path` on `current_term_start()`, avatars-bucket listing scoped to the caller's own folder
(public avatar URLs unaffected), and `club_settings.reminders_sent_at` for the send-reminders throttle.
Migration 0027 adds **club terms + member AI insights**: a `terms` table (label/start/end, RLS:
member-read, **admin-write**; in the realtime publication) auto-materialized seasonally by
`ensure_terms()` (SECURITY DEFINER, no-op when `club_settings.auto_terming` is off; never overwrites a
window covered by an existing/edited term), `current_term_start()` now **prefers the terms table** (so
admin edits move "this term" hours everywhere) with the seasonal rule as fallback, plus
`profiles.ai_insight(_at)` and `terms.ai_summary(_at)` caches for the AI functions below.
Migration 0028 adds the **AI chatbot rate limiter**: `ai_chat_log` (one row per answered message, own-row
read) + `check_ai_chat_rate(member)` (SECURITY DEFINER, service-role only) enforcing 4/min · 20/hr ·
60/day per member and stamping usage in the same call.
Migration 0029 locks `role_hours_rules` reads to admins and adds event/meeting **counts** (this-term +
all-time) to `get_public_dashboard()`.
Migration 0030 adds the **meeting full-screen view + tagged links + Goals grid**: `meetings.links`
(`text[]`), `get_public_meeting(uuid)` (anon RPC, mirrors `get_public_event`), `goals.period`/`sort` +
`club_settings.term_targets` for the person×month Goals grid (existing goals migrated into each owner's
Term cell), and makes **meeting hours end-time aware** — `get_hours_breakdowns()` + `get_public_dashboard()`
count a meeting (and flip it to "past") once `(date + end_time)` passes in `America/Los_Angeles`.
Migration 0031 adds **per-role monthly granting** for the Role Hours page: `role_hours_rules.last_granted_month`
('YYYY-MM', stamped when granted, PST) + `grant_role_month(role)` (admin-only); `ensure_monthly_role_hours()`
now stamps every monthly rule it grants.
Migration 0032 gives **events** the same end-time rule 0030 gave meetings: `get_hours_breakdowns()` +
`get_public_dashboard()` credit an event's sign-ups (and flip it to "past") once `(date + end_time)` — or
end of day if untimed — passes in `America/Los_Angeles`, instead of the old `date < current_date`, which
fired at UTC midnight = **5 PM PDT the same day** and so paid out before evening events ended. It also
stops tentative events from ever earning hours (`not is_tentative`, previously only enforced by convention).
Migration 0033 adds **recovery emails**: `member_recovery` (member_id → personal email; RLS = own row or
admin, deliberately a separate table so the all-members-read `profiles` policy doesn't expose everyone's
personal address) plus `password_reset_log` + `check_password_reset_rate(email)` (SECURITY DEFINER,
service-role only) throttling the public Forgot-password endpoint to 3/hour per address and 30/hour
club-wide. The log stores the address **hashed** — strangers can hit that endpoint.
Migration 0034 makes **event hours self-consistent** — attendee list ⇔ ledger ⇔ `events.hours`. Adding a
member to an event dated **before `hours_cutoff_date`** used to grant nothing: derived sign-up hours are
suppressed there (so the 0019 import isn't double-counted) and nothing wrote the ledger, so the member
showed on the event but the event was absent from their hours history. `sync_event_hours_ledger(event)`
(SECURITY DEFINER) now reconciles one event and is fired by triggers on `event_signups`
(insert → write a `source = 'signup'` ledger row at `events.hours`; delete → remove **only** that row, never
an `import`/`manual` one) and on `events` (update of `hours`/`date`/`is_tentative` → every event-linked row
bar `role_*` follows the new figure, and rows are added/dropped when an event moves across the cutoff or is
flagged tentative). The migration also backfilled: `events.hours` was set to the imported per-attendee
figure where they disagreed (EVSFM 2026-03-29 + 2025-11-30 `3 → 4`, St. Andrew's 2025-03-20 `1 → 6`),
four uncredited attendees got rows, and one member with imported event hours but no sign-up was added to
that event's attendee list. **Imported hours are the precedent when history disagrees; a later admin edit
of `events.hours` overrides them.**
Migration 0035 closes the matching hole: the own-row `event_signups` policies checked *who* but never
*when*, so a member could self-sign-up for a finished event through the API (the UI has always hidden
Sign up / Leave once an event ends) and mint their own hours for it. Both self policies now require the
event to be unfinished by the same PST end instant `hasEnded()` uses; **leaving** is restricted too, so
nobody can drop off a past event and erase the hours they earned. Admins still add/remove anyone via
`signups_admin_all`. 0035 also adds `hours_grants` to the realtime publication for the now-live
`ProfilePage`.
Migration 0036 carries all of that onto **meetings**, which had the same three holes: (1) members could
self-report attendance on *any* past meeting, however old, and the hours landed unreviewed — attendance
is now **final once a meeting ends** (same PST instant), members register while it's upcoming and an
admin fixes it afterwards, so the "I attended" button is gone from past meeting cards; (2) `registerMeeting()`
**upserts**, so "Switch to contributor/attendee" runs `INSERT … ON CONFLICT DO UPDATE` and needs an
UPDATE policy — 0013 never shipped one, so that button had always failed RLS silently for non-admins
(the first Attend/Contribute click worked: no conflicting row yet, so a plain insert). The new own-row
UPDATE policy repeats the meeting test in **`with check` as well as `using`**, or a member could
re-point an upcoming row at a finished meeting; (3) `sync_meeting_hours_ledger()` + triggers mirror 0034
so a **pre-cutoff** meeting credits its attendees (source `attendance`, the meeting counterpart of
`signup`) — no meeting predates the cutoff today, so there was nothing to backfill.
Migration 0037 gives **events the general `links` array** meetings have had since 0030: an event could
only ever carry Instagram posts (`instagram_urls`), so a sign-up sheet, flyer or drive folder had nowhere
to go. `events.links` (`text[]`) is backfilled from `instagram_urls`, `get_public_event()` returns both
(so a cached older bundle doesn't lose the posts mid-rollout), and the legacy column is left in place as
the rollback path — **deprecated, no longer written**.
Tables: `profiles`, `events`, `event_signups`,
`event_todos`, `meetings` / `meeting_series` / `meeting_attendees` (club meetings — see below),
`goals` (leadership goals), `role_hours_rules` / `hours_grants` (role-based auto-hours, migration 0015),
`locations`, `club_settings` (single shared row, `id = true`),
`activity_log` (admin-only audit trail). Notable added columns:

- **`events`:** `address`, `start_time` / `end_time` (migration 0008 — when set, the calendar feed emits
  a timed block with a `VTIMEZONE` for America/Los_Angeles), `instagram_urls` (`text[]` of linked IG
  posts shown on the event card; migration 0012), `is_tentative` + **nullable `date`** (migration 0013 —
  a not-yet-confirmed event whose date/time/location can be left “TBD”; tentative events bucket into their
  own section, never earn hours, and are marked `STATUS:TENTATIVE` / skipped in the `.ics` feed),
  `latitude` / `longitude` (migration 0016 — captured from the location autocomplete so the public event
  view can show a map; the view geocodes the address as a fallback), `links` (`text[]`, migration 0037 —
  **every** event URL, the same shape as `meetings.links`). `get_public_event(uuid)` (anon RPC,
  migration 0016, extended in 0037) returns one event's public data + attendees for `/events/:id`.
  **`instagram_urls` is deprecated** (migration 0037 folded it into `links` and backfilled it): the app
  no longer writes it, reads fall back to it only for a row `links` hasn't reached, and a later migration
  should drop it. Instagram URLs are just links now — `EventView` still detects them and renders the full
  `embed.js` posts, while every other link renders as a `LinkChip`.
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
Sign-ups and meeting attendance are own-row only — and both are **time-gated**: a member can only add,
change or remove *their own* row while the event/meeting hasn't ended (migrations 0035 + 0036); after
that it's an admin record via `ManageAttendeesModal`. Profiles are **admin-only to edit** (`is_admin()`
SECURITY DEFINER helper + admin override policies); the prior self-update policy was dropped
(migration 0005). First member was bootstrapped as admin. (The dashboard's anonymous read path is the
`get_public_dashboard()` RPC, not table-level `anon` grants.)

**Hours model:** a member's hours = sum of `events.hours` for **past** events they signed up for, plus
`profiles.hours_adjustment` (admin correction). The admin hours stepper on the profile page shows the
*total* and writes the adjustment delta behind the scenes. The dashboard leaderboard toggles **This term**
(only past events on/after `club_settings.term_start_date`; adjustments excluded) vs **All time**; both are
computed in `get_public_dashboard()`. Tentative events never count.

**Auto hours (migration 0015):** members also accrue role-based hours. `role_hours_rules` (admin-editable
per role: `hours` + `monthly`/`per_event` cadence; defaults seeded) writes to the `hours_grants` ledger
via a per-event INSERT trigger (`grant_event_role_hours`) and the `ensure_monthly_role_hours()` monthly
**pg_cron** (1st of month; admins can also grant a single role's current month early with the per-role
**Grant Now** button on the `/auto-hours` page — sidebar **Role Hours** — via `grant_role_month`, 0031). Grants
fold into **both** total + term hours everywhere they're computed (`get_public_dashboard()`,
`getMembersWithHours`, `getProfileDetails`, the ai-insights function). Accrual is forward-only, so set each
member's accurate baseline via the profile hours stepper. Role `pr_lead` is labelled "PR and Tech Lead".

**Unified hours ledger (migrations 0017–0019):** `hours_grants` is now the general ledger (added
`entry_date`, `meeting_id`; sources `import` / `role_*` / `manual` / `signup` — the last one trigger-managed,
see migration 0034). A member's **total = ledger +
cutoff-filtered event sign-ups + meeting attendance + `hours_adjustment`**, all computed in
`get_public_dashboard()` and `get_hours_breakdowns(member)`. `club_settings.hours_cutoff_date` (set to the
import date) makes derived event/meeting hours count only **on/after** the cutoff, so the imported history
(below) doesn't double-count old sign-ups; sign-ups stay for attendance display. **Meetings grant hours**
(0017): `meeting_attendees.role` — *attendee* earns the meeting length, *contributor* earns length + 1.
**Events and meetings both land the moment they end in PST** — `(date + end_time)` (or end of day if
untimed) `at time zone 'America/Los_Angeles' <= now()`, in `get_hours_breakdowns()` +
`get_public_dashboard()` (meetings 0030, events 0032) — so an item flips upcoming→past and credits its
people the same instant. **Nothing is materialized**: hours are re-derived on every read, so moving an
event/meeting to a later date/time (e.g. it got rescheduled because nobody showed) **removes those hours
again** until the new end passes, with sign-ups/attendance left intact. The client mirrors the same rule
via `hasEnded()` in `src/lib/time.js` — always use it (and `laToday()`) for upcoming/past splits; a UTC
`new Date().toISOString().slice(0,10)` is already tomorrow after 5 PM PDT and will disagree with the server.
The one thing a reschedule does **not** claw back is a `role_event` grant, which is credited on event
**creation** (for organizing it), not attendance.
Role hours also accrue per role (`role_hours_rules` / `hours_grants`, source `role_monthly`/`role_event`);
the monthly cron + the per-role **Grant Now** button (`grant_role_month`, 0031) materialize the current
month's grants idempotently.
**Hours breakdown (Feature 3):** `get_hours_breakdowns(p_member uuid)` (null = everyone) returns each
member's itemized history; shown on `ProfilePage` and exported to **.xlsx** via `src/lib/exportHours.js`
(SheetJS, lazy-loaded) — per-user on the profile, **global on the Members page**. Each row in that
history carries a hover **Copy** button for the **operations lead** (`copyHoursEntry` in `api.js`):
one activity often covers several people, and re-typing it per profile is where the ledger drifts.
Every pick gets its own editable `manual` row keeping the original's hours, date, description and
event/meeting link — it does **not** de-duplicate, so check the target isn't already credited.
**Spreadsheet import
(0019):** a one-time load from "Janyaa Member Hours.xlsx" set everyone's history (exact per-member totals,
event rows linked by date); the member **Aarush** was created (auth user, no password) and **Rohan**'s
sign-up hours were materialized into the ledger.

**Pinned AI cards (Feature 1, migration 0017):** `pinned_items` (surface + kind + jsonb payload snapshot)
lets any member **pin** an AI insight / suggestion / social idea so it survives regeneration. `PinButton`
in `ui.jsx`; pinned cards render in a "Pinned" section on `Insights` + `AIStudio` (suggestions + social),
de-duped from the live cards by title.

**Fundraising:** `club_settings.raise_target` is the shared goal (anyone can edit). Online donation
figures (`donations_*`, migration 0038) are scraped server-side by `sync-donations`. Per-event in-person
revenue is `events.raised`.

**Donation platform (migration 0038 — GoFundMe → Givebutter).** Donations go through Givebutter, on
Janyaa's campaign (`https://givebutter.com/59uJ48`, goal $10,000). The club has **its own page inside
that campaign**:

    https://givebutter.com/59uJ48/bellarmine-youth-chapter

**That team page is the club's donate link everywhere** — shared by members, encoded in the QR, opened by
the Donate button, and scraped for the club's own credited total. A donor who lands on the *parent*
campaign instead has to pick **"Bellarmine Youth Chapter"** under **"Credit a team"**, which is the only
reason the UI mentions that field at all. Janyaa BCP does **not** own the Givebutter account, so there is
no API key to obtain and `sync-donations` scrapes the public pages, as `sync-gofundme` did.
Columns are **provider-neutral** (`donations_*`, not `givebutter_*`) — this is the second platform in the
Hub's life and the third should cost a settings edit. `donations_url` = **the club's page** (ours,
scraped for `donations_raised`/`_count`), `donations_campaign_url` = Janyaa's parent campaign (context
only, `donations_campaign_*`), `donations_legacy_*` = the **final GoFundMe numbers, merged into every
displayed total** (so the headline didn't drop to zero at cutover) while staying a separate column so the
two platforms remain distinguishable. `donations_sync_status` records which parse strategy worked (or the
error) — the scraper reads someone else's HTML, so a break has to be visible from the table. A failure on
the club's page fails the sync; a failure on the parent campaign costs only a context bar.
The old `gofundme_*` columns and the `sync-gofundme` function are **deprecated but retained** as the
rollback path (as 0037 did with `events.instagram_urls`); a later migration should drop both.
The QR code is `public/givebutter-qr.png` (it encodes the **club's** page, not the campaign), offered on
**Club Info** alongside the Linktree QR.

**The shared goal is admin-only (0038).** `raise_target` moved to **$10,000** to match the campaign, and
only an admin can change it. `club_settings` stays member-writable on purpose (term targets, auto-terming
and the AI caches live there), so the goal is guarded **by column, with a trigger**
(`enforce_admin_raise_target`): RLS has no way to say "this one field is admin-only", and a `with check`
clause cannot see the OLD row to detect a change. `auth.uid()` is NULL for the service role, so the sync
function and the crons write the `donations_*` columns untouched by the guard. The Fundraising page's
`EditableGoal` is gated on `profile.is_admin` to match, so a member sees the figure as plain text.

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

- **`sync-donations`** (`verify_jwt: false`) — scrapes the club's online donation totals (Givebutter,
  migration 0038) and writes the `donations_*` columns. Reads `donations_url` (**the club's own page**)
  and `donations_campaign_url` (Janyaa's parent campaign, context only). Givebutter is a **Laravel** app
  (not Next): its own blobs are read first — the inline `window.GB_CAMPAIGN = {…}` object for a campaign,
  the HTML-escaped `data-active-team="{…}"` attribute for a team page — **scoped** to what the page is
  being read *for* (a team page carries both, and the parent page has a `data-active-team` for whichever
  team is first, so `scope: 'team' | 'campaign'` decides which is trusted; without it the club would report
  Janyaa's whole-campaign total as its own). Only when neither is present do **four generic strategies**
  run over the same HTML — `__NEXT_DATA__`, the App-Router
  `self.__next_f` flight stream, other inline JSON state, and the rendered text — and are reconciled: the
  structured data wins on completeness, but the page text is the authority on **units** (Givebutter's
  payloads sometimes carry cents; "$1,234 raised" on the page never does), and if the two disagree by
  anything other than a factor of 100 the *text* wins and the status says so. Whichever strategy answered
  is recorded in `donations_sync_status`. Runs on the **`sync-donations-3h` pg_cron job** + the
  Fundraising page load + the "Sync now" button; **self-throttled** to 60s like its predecessor, and it
  refuses to fetch any host that isn't a donation platform (it would otherwise be an open fetch proxy).
  A `{ probe: <url> }` call (**admin JWT required**) parses a page and reports what it found *without*
  saving — that's how a parse break gets diagnosed.
- **`sync-gofundme`** (`verify_jwt: false`) — **DEPRECATED (0038)**, kept only as the rollback path while
  the `gofundme_*` columns survive. Nothing invokes it and the cron no longer calls it.
  Scrapes the GoFundMe campaign in `club_settings.gofundme_url`
  (parses the `__NEXT_DATA__` Apollo cache) and writes the totals back. Runs on a **pg_cron schedule
  (every 3h)** + on the Fundraising page load + a manual "Sync now" button. **Self-throttled**: a sync
  newer than 60s is returned as `cached: true` instead of re-scraping (the endpoint is public).
- **`calendar`** (`verify_jwt: false`) — serves all events **and uncancelled club meetings** as one `.ics`
  feed for calendar subscriptions (the Events page "Subscribe" button). Tentative events are marked
  `STATUS:TENTATIVE` + `[Tentative]` prefix; undated ones are skipped. Hardened: a DB error returns a
  valid (empty) calendar instead of a 500 that would drop subscribers; lines fold on UTF-8 byte
  boundaries; every entry has a stable UID + `LAST-MODIFIED` + `CATEGORIES:Event|Meeting`.
- **`ai-chat`** (`verify_jwt: true`) — the members-only assistant on `/ai-planning` (component
  `src/components/AIChat.jsx`). Builds a LIVE club snapshot (events, members + hours, fundraising, goals,
  locations, terms, meetings) + baked-in cited Janyaa facts, asks Gemini for an answer **plus structured
  `references`** the client renders as clickable cards (event/member/goal/location/term/fundraising →
  in-app links; `source` → external URL). Reference ids are validated against the real snapshot so cards
  never point at hallucinated records. **Per-member rate-limited** via `check_ai_chat_rate()` (migration
  0028: 4/min, 20/hr, 60/day) because Gemini is on the free tier; a 429 returns a friendly message + a
  client-side cooldown. Requires `GEMINI_API_KEY`.
- **`ai-insights`** (`verify_jwt: true`) — pulls real club data, asks Gemini for actionable insights,
  caches them in `club_settings.ai_insights`. Member hours come from the canonical
  `get_hours_breakdowns` RPC (same totals every screen shows — no double-counting of the imported
  history), the term start from `current_term_start()`. Also feeds **club meetings** (with attendance) and
  **leadership goals** (with % progress), and flags **tentative** events as unconfirmed (so Gemini treats
  them as plans, never as earned hours/money). **Requires the `GEMINI_API_KEY` secret** (set in Supabase
  → Edge Functions → Secrets; free Gemini API tier). Admin can force-regenerate; auto-regenerates
  (throttled ~10 min) when an event or the online donation total changes. Falls back to a "not set up" message
  if the key is missing.
- **`ai-suggestions`** (`verify_jwt: true`) — Gemini next-event + location ideas from real history, cached in
  `club_settings.ai_suggestions`. Surfaced on `/studio` (AI Studio).
- **`ai-plan-event`** (`verify_jwt: true`) — the planner wizard's backend: takes the answers (blank field =
  "you decide") and returns a full event plan (fields + timeline + to-dos) **without saving**; the client
  creates the event + to-dos on accept (no cache).
- **`ai-social`** (`verify_jwt: false`) — monthly Instagram content ideas using Gemini **Google-Search
  grounding** (trend/audio hints are directional — no free API for exact trending audio). Cached in
  `club_settings.social_posts`, throttled (>25 days), run by the **`monthly-social` pg_cron** (1st of
  month, migration 0016) + an admin "Refresh". `verify_jwt:false` so the cron can call it (like
  `send-reminders`) — but `force: true` (the Refresh button) **requires a signed-in member's JWT**, so
  strangers can't burn the Gemini quota.
- **`ai-member-insight`** (`verify_jwt: true`) — ONE personal Gemini insight per member (progress +
  areas to improve), cached on `profiles.ai_insight`. Auto-regenerates when a profile is viewed with a
  cache >30 days old; `force` (the profile Refresh button) is allowed only for the member themself or
  an admin. Uses `get_hours_breakdowns` + club averages; sends first name + last initial only.
- **`ai-terms`** (`verify_jwt: true`) — per-term AI breakdowns cached on `terms.ai_summary`, all terms
  in ONE Gemini call. Self-throttled: past terms regenerate only when missing, the current term when
  >7 days old; `force` (admin Refresh on `/club-terms`) regenerates everything. Calls `ensure_terms()`
  first so seasonal rows exist.
- **`admin-users`** (`verify_jwt: true`) — admin-only account management needing the service role:
  create (with a set password, an emailed invite, OR a **copied invite link**), set password, change
  login email, delete. Confirms the caller is an admin (`profiles.is_admin`) before acting. Called via
  `src/lib/api.js` (`adminCreateUser` / `adminInviteUser` / `adminCreateUserLink` / `adminSetPassword` /
  `adminSetEmail` / `adminDeleteUser`), surfaced in the Members "Add member" modal + the profile page's
  admin Account section. The **Copy invite link** button (`link: true` → `generateLink({type:'invite'})`,
  which creates the account exactly like `inviteUserByEmail` minus the send) mirrors the profile page's
  **Copy reset link**: it returns the set-password link for the admin to hand over by text/DM/in person,
  the path that works when the member's school mailbox swallows our mail. Both that link and the
  emailed invite are **`…/set-password?token_hash=…&type=invite`**, not Supabase's `/auth/v1/verify`
  URL (see `SetPassword`). The **emailed** invite also goes out over the club Gmail SMTP from this
  function (same `SMTP_*` secrets as `send-reminders`) instead of via `inviteUserByEmail`; if the send
  fails the account still exists, so the function returns the link and the modal shows it. The modal then swaps to a
  link panel (the account can't be created twice); a stale link is re-issued from that member's profile
  via Copy reset link. Invite links are single-use and expire per the same **Auth → Providers → Email →
  Email OTP Expiration** setting as reset links (keep it at 3600s — the modal says 1 hour). Password
  **resets** are not here — they live in `password-recovery` (below), which routes them off the school
  mailbox.
- **`password-recovery`** (`verify_jwt: false`) — all password resets. Supabase's own
  `resetPasswordForEmail()` can only mail the **login** address (a school Microsoft mailbox that
  quarantines us), so this generates the link itself with `auth.admin.generateLink({ type: 'recovery' })`
  — which returns the link instead of sending it — rewrites it to `…/set-password?token_hash=…&type=recovery`
  (see `SetPassword`: the raw `/auth/v1/verify` URL is spent by the first GET, so a link scanner
  expires it in transit) and delivers it over the club Gmail SMTP to the
  member's `member_recovery` address when they have one. Actions: `request` (public, from the Login
  screen's Forgot-password modal — matches the typed address against login **and** recovery emails with
  an exact `eq`, never `ilike`, so a typed `%` can't wildcard-match a member; rate-limited via
  `check_password_reset_rate`; returns a masked `sentTo` **only** when mail actually went out), `adminSend`
  (admin JWT → emails the link; **400s when that member has no recovery address**, which is why the
  profile's "Email reset link" button is disabled until one is saved), `adminLink` (admin JWT → returns the
  raw link to copy — the only path for a member without a recovery address). `verify_jwt: false` is required for the signed-out `request`; the two admin actions
  verify the JWT + `profiles.is_admin` in-function, same pattern as `send-reminders`. Shares the `SMTP_*`
  / `FROM_EMAIL` secrets with `send-reminders`. The redirect target (`…/set-password`) must be in
  Supabase **Auth → URL Configuration**, or `generateLink` silently falls back to the Site URL. The mail
  body is assembled line-by-line with **no trailing whitespace** — denomailer sends quoted-printable,
  where a space before a newline is delivered as a literal `=20`, which is what an indentation-only line
  in a template literal produces. Its logo URL comes from `redirectTo`'s origin, not a hardcoded host.
- **`send-reminders`** (`verify_jwt: false`) — emails each member the to-do items they claimed for
  events happening **tomorrow**, via the club Gmail over SMTP. Runs **automatically** on a daily
  **pg_cron schedule (15:00 UTC ≈ 8 AM PT, migration 0010)**. (The manual "Email reminders" button was
  removed from the Events tab; the cron still runs, and `send-reminders` remains deployed.)
  **Requires the `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `FROM_EMAIL` secrets** (the
  club Gmail + an app password — the same custom-SMTP creds Supabase uses for invite/reset emails).
  Returns a "SMTP not set" message until configured. **Abuse-guarded**: a signed-in **admin** JWT runs
  immediately (the manual button); any other caller (the cron, or a stranger — the endpoint is public)
  is throttled to one run per 20h via `club_settings.reminders_sent_at`, stamped *before* sending.

## Deployment (Vercel)

- Push to `main` → Vercel auto-builds & deploys. Production URL: **`hub.janyaabcp.org`** (the
  club's own domain, bought through Squarespace Domains; the `hub` subdomain is a **CNAME** pointing
  at the per-project target Vercel shows in Settings → Domains, e.g. `<id>.vercel-dns-017.com`).
  The old `janyaa-bcp-hub.vercel.app` is kept as a **redirect** to it in the Vercel project's Domains
  tab, so every previously shared link still works. Code should never hardcode the host — the only
  place that does is `src/lib/exportHours.js` (`SITE`, used for event links inside the .xlsx export);
  everything else uses `window.location.origin` or, in `api/og.js`, the incoming request's `Host`.
- Vercel **Environment Variables** must hold `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (not in repo).
- `vercel.json` has the **SPA fallback rewrite** (`/(.*) → /index.html`) so deep links like `/events`
  work on hard refresh. Don't remove it. It also sets **security headers** (nosniff, SAMEORIGIN
  frame-options, referrer policy, a minimal Permissions-Policy that keeps `geolocation=(self)` for the
  Locations map) and immutable caching for `/assets/*` (hashed build files).
- **Dynamic link previews (`api/og.js`).** The two **public** shareable views — `/events/:id` and
  `/meetings/:id` — are rewritten (in `vercel.json`, *before* the SPA fallback) to the `api/og.js`
  Vercel serverless function. Because the app is a client-only SPA, link-unfurlers (iMessage, Slack,
  Discord, WhatsApp) that fetch the URL but don't run our JS would otherwise only see the generic
  static `index.html` tags. The function fetches the deployed `index.html`, looks up the record via the
  public `get_public_event` / `get_public_meeting` RPC (REST, using `VITE_SUPABASE_*` env — also
  available to functions at runtime), and injects per-record `<title>` + Open Graph / Twitter meta
  (title = `Janyaa BCP Hub | <name>`, description = date · time · location, image = the logo). Humans
  get that same `index.html` so the SPA still boots (and `useDocumentTitle` sets the live title); any
  failure falls back to the untouched `index.html` so a share link never breaks. Only these two routes
  are prerendered — everything else (incl. the noindex member pages) stays a pure SPA.
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
