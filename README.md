# Janyaa BCP Hub — Full Project Brief

**Purpose of this document:** Hand off complete context on the Janyaa BCP Hub project to a new Claude session (or any AI assistant / new collaborator). After reading this, you should be able to help Rishaan with implementation, strategy, communication, and risk management without asking setup questions.

**Last updated:** Late May 2026, summer break of sophomore year.

---

## TL;DR

Rishaan Kotian — sophomore at Bellarmine College Preparatory (San Jose, CA), going into junior year — is building a custom web platform to replace the Google Sheets/Drive/Forms operations of his school club, **Janyaa BCP**. The platform's MVP will ship by mid-August 2026 as Rishaan's capstone for learning full-stack development over summer.

The build serves three goals simultaneously:
1. **Real impact:** Replaces a manual ops backbone for a real club with real members.
2. **College narrative:** Strongest portfolio piece — real stakeholders, real users, real metrics, defensible authorship.
3. **Skill-building:** Capstone project for a 12-week full-stack curriculum (React + Node + Supabase + Vercel).

**Status:** Proposal stage. Roadmap drafted. Not yet shared with Krishna (club president). Not yet a single line of Janyaa Hub code written. Rishaan is at Week 1 Day 1 of the full-stack roadmap as of this writing.

---

## Section 1 — Who is Rishaan (the builder)

**Profile relevant to this project:**

- Sophomore at Bellarmine College Prep, Class of 2028.
- CS/AI/ML oriented since childhood (Linux builds, custom ROMs, Java starting now).
- **Current skills:** Solid vanilla HTML/CSS/JS. Personal website built. No experience with React, Node, Express, databases, or auth as of summer start.
- **Learning right now:** MOOC.fi Java (Part 2 of 7), full-stack curriculum starting fresh.
- **Hardware:** MacBook M4 Max, 36GB RAM, 2TB. No constraints.
- **Role at Janyaa BCP:** Design & Socials. ~20 hours logged. Made club logo, designed first Janyaa social post. Recognized by Krishna (president) as one of the club's MVPs.

**Critical context for any AI assistant working with him:**

- **Response format.** Direct, low-padding paragraphs (max 4 sentences). End substantive messages with one-sentence Summary + one-sentence Next steps. Don't sandbag with disclaimers.
- **Honesty preference.** He responds to direct feedback about skill gaps better than false encouragement. Tell him when his code is AI-pattern-matched vs genuinely understood. Tell him when an idea won't work. He values this.

**Priority stack** (use this to weight tradeoffs):
1. Junior year GPA (target ~3.875 UW per semester)
2. Java for FRC 254 (AP CSA + MOOC.fi)
3. Real full-stack competence (this project)
4. Museum project completion (Sunnyvale Heritage Park Museum — separate ongoing work)
5. Eagle Scout (3-year runway, start planning)
6. College app strategy
7. Other side projects (low priority)

If Janyaa Hub starts to threaten 1, 2, or 4 — scope it down. It is not the top priority, but it is the project most likely to differentiate his application portfolio if shipped well.

---

## Section 2 — What is Janyaa BCP (the club)

**The parent organization.** [Janyaa Foundation](https://janyaa.org) is a non-profit focused on STEM education for underprivileged children, primarily in India and the SF Bay Area underserved communities. They use a "Study, Teach, Learn" methodology and produce experiential STEM kits called "Lab-in-a-Box."

**Janyaa BCP** is the Bellarmine College Preparatory chapter, founded March 2025. It's the school-club arm of the foundation.

**Mission at the BCP level.** Run educational programming for underprivileged kids in the Bay Area through:
- In-person STEM sessions at partner sites (Sunday Friends, St. Andrew's, public libraries)
- Lab-in-a-Box experiment delivery and facilitation
- Producing educational videos on YouTube / social media
- Fundraising to support operations and direct service

**People** (as of this writing):

| Person | Role | Notes |
|--------|------|-------|
| Krishna | Founder & President | Sophomore, close friend of Rishaan, drives club direction |
| Arjun | VP (likely) | Sophomore, key collaborator |
| Aayush, Abhijay, Anant, Ethan, Aarush | Members | Active core members |
| Rishaan | Design & Socials | ~20 hrs logged, club MVP |
| (TBD) | School Advisor | Bellarmine faculty |
| (External) | Janyaa-BCP Board, Parent Coach | Adult oversight from Janyaa Foundation |

Total active members: ~8–9.

**Governance:** Six-month term cycles. Roles: President, VP, PR, Secretary, Treasurer. Member commitments per term: 8 videos produced, $500 raised, 12 meetings attended.

**Recurring activities:**
- **EVSFM fundraiser** (twice per year, ~Nov and ~Mar — name appears to be a market vendor or community event partner). Past raised: $480 (Nov 2025), $520 (Mar 2026).
- **Vasona Park lemonade stand** (summer). Past raised: ~$230.
- **Library sessions** (recurring).
- **Sunday Friends sessions** (recurring).
- **St. Andrew's sessions** (recurring).

**Current operational tooling:**
- Google Drive (well-organized folders: Events, Meetings, Experiments, Member Hours sheet, etc.)
- Google Form for new member interest
- Google Sheet for member hours (markdown-style entries per person)
- GoFundMe for fundraising campaigns
- Email + group chat for coordination

**Pain points (documented from Drive review):**
- Hours sheet is hard to audit, self-reported, no aggregation
- Location scouting is repeated each fundraiser cycle from scratch (Rishaan logged 2 hours just asking businesses)
- Meeting minutes scattered across Drive
- Fundraising totals not aggregated across events
- Video production targets (8/member/term) not centrally tracked
- No system for role rotations across term transitions

---

## Section 3 — The proposal

### Why build a custom platform vs. staying on Google Sheets

Google Sheets works fine for current scale. The pitch is NOT "save time." The pitch is:

1. **Aggregate impact metrics** that make the club look serious to outsiders (new member recruitment, Janyaa Foundation reporting, college applications for all members).
2. **Operational backbone** that lets the club scale past 8 members without breaking.
3. **Make recurring events near-autonomous** so leadership scales instead of running every detail.
4. **A real platform** (vs. a spreadsheet) signals seriousness to potential partners — restaurants, donors, school admin.

If the club doesn't intend to grow, doesn't want centralized tooling, or won't sustain the platform across leadership transitions — this is overengineering and shouldn't be built. **Krishna's real commitment is the load-bearing dependency.**

### Core modules (full vision, ranked by club value × build feasibility)

**1. Member hub + hours tracker.** Self-service hours logging with leadership approval flow. Per-member, per-event, per-term rollups. Replaces the current sheet. Auto-credits hours when attendance is marked at an event.

**2. Event management.** Create event → assign roles → RSVP → attendance → post-event report. Recurring templates for EVSFM, library series, Vasona, Sunday Friends so each instance takes minutes not hours. This is the "autonomous events" piece.

**3. Fundraising dashboard.** Per-event totals, term progress vs $500 target, year-over-year trend. GoFundMe has a read-only public API for live stats. Visible impact metric on the homepage.

**4. Location/partner scouting map.** Interactive map (using Leaflet, free, no API key) of potential fundraising locations with status (contacted / approved / declined / recurring partner), contact log per location, last-touched date. Kills the recurring "where can we fundraise" cycle.

**5. Meeting minutes.** Standardized template, searchable history, action item tracking with assignees.

**6. Video production tracker.** Per-member topic claims, status, links, prevents duplicate topics. Hits the 8-videos/term metric directly.

**7. Restaurant fundraiser program.** Partner directory + scheduled fundraiser nights using the *Spirit Night model* (see detail below).

**8. AI event insights.** Post-event: pull attendance, hours, $ raised, and a short member survey into a Claude API call that surfaces patterns ("Saturday fundraisers raise 2x weekday ones," "events with 4+ members raise more than 2-member events"). Light feature, big perceived value.

### Restaurant fundraiser program — design detail

The club leader had originally proposed a "customers log what they get on the app, we get a cut of revenue." This has a **fraud problem** (nothing prevents fake logs) and adds unnecessary customer-side technology.

**Recommended model: Spirit Night / Chipotle Night.** Every PTA in America uses this:

1. Restaurant agrees to donate X% (typically 15–25%) of receipts during a specific 2–4 hour window.
2. Customers must show a flyer (paper or screenshot) or mention the club at the register to count.
3. Restaurant tallies at end of night, sends check or transfers funds.
4. Zero customer-side technology needed.

**The platform's role becomes:**
- Restaurant partner directory (active, prospect, past partners)
- Event scheduling (which restaurant, which date, which time window)
- Flyer generation (auto-generated with date, location, percentage)
- Post-event reporting (how much raised, attendance estimate, notes for next time)
- Outreach tracking (which restaurants have been contacted, who responded)

Much smaller and cleaner than the customer-logging app, and it actually works.

### MVP scope (ships by Aug 15, 2026)

Modules 1, 2, 3 only:
- Auth (Google OAuth via Supabase, restricted to Bellarmine email domain if possible)
- Member directory with hours tracking and rollups
- Event creation, attendance, post-event reporting
- Fundraising dashboard (manual $ entry first; GoFundMe API integration deferred to V2)

Hosted on Vercel + Supabase. Open access to all club members.

### V2 (fall 2026, alongside school)

- Module 4 (Location map with Leaflet)
- Module 5 (Meeting minutes)
- Module 6 (Video tracker)
- Migrate existing Google Sheet data into the system
- Polish based on real usage feedback

### V3 (spring + summer 2027)

- Module 7 (Restaurant program)
- Module 8 (AI insights)
- Public-facing impact page for new member recruitment
- Janyaa Foundation reporting export (PDF/CSV for parent org)

---

## Section 4 — Data model

```
members
  id (uuid)
  email (text, unique) — links to auth user
  name (text)
  role (enum: president, vp, pr, secretary, treasurer, member)
  joined_date (date)
  active (bool)
  created_at (timestamp)

events
  id (uuid)
  name (text)
  date (date)
  location (text)
  type (enum: evsfm, vasona, library, sunday_friends, st_andrews, restaurant_night, other)
  raised (decimal, default 0)
  notes (text)
  created_at (timestamp)

hours
  id (uuid)
  member_id (uuid, fk → members.id)
  event_id (uuid, fk → events.id, nullable)
  date (date)
  hours (decimal)
  description (text)
  approved (bool, default false)
  approved_by (uuid, fk → members.id, nullable)
  approved_at (timestamp, nullable)
  created_at (timestamp)

event_attendance
  id (uuid)
  event_id (uuid, fk → events.id)
  member_id (uuid, fk → members.id)
  marked_at (timestamp)

# V2 additions:

locations  (fundraising location scouting)
  id (uuid)
  name (text)
  address (text)
  latitude (decimal)
  longitude (decimal)
  status (enum: prospect, contacted, approved, declined, recurring_partner)
  contact_person (text)
  contact_email (text)
  contact_phone (text)
  last_touched (date)
  notes (text)

meetings
  id (uuid)
  date (date)
  attendees (uuid[] — array of member ids)
  minutes (text)
  action_items (jsonb)

videos
  id (uuid)
  member_id (uuid, fk → members.id)
  topic (text)
  status (enum: claimed, in_progress, published, archived)
  url (text, nullable)
  published_date (date, nullable)

# V3 additions:

restaurants
  id (uuid)
  name (text)
  address (text)
  latitude (decimal)
  longitude (decimal)
  contact_person (text)
  contact_email (text)
  status (enum: prospect, contacted, partnered, past_partner, declined)
  percentage_offered (decimal, nullable)
  notes (text)

restaurant_events
  id (uuid)
  restaurant_id (uuid, fk → restaurants.id)
  event_date (date)
  start_time (time)
  end_time (time)
  raised (decimal, nullable)
  attendance_estimate (int, nullable)
  notes (text)
```

**Auth model:** Supabase Auth with Google OAuth. Restrict to Bellarmine email domain in V1 if possible. Auto-link to member record by email on first sign-in (creates a member record if not present, with default role=member, requires Krishna to approve and assign role).

**Row Level Security (RLS):** Apply in V2. For MVP, all authenticated club members have full read access; only members with role in (president, vp) can mark approvals or create events.

---

## Section 5 — Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite | Modern, fast scaffolding, fits the 12-week learning curve |
| Styling | Tailwind CSS v4 | Utility-first, fast iteration, no separate CSS files |
| Routing | React Router v6+ | Standard for multi-page React apps |
| Backend | Supabase (Postgres + Auth + Storage) | Eliminates need for separate Express server in MVP; gets to "deployed with Google OAuth" fast |
| Auth | Supabase Auth (Google OAuth) | Built-in, free, secure |
| Deployment | Vercel (frontend) | One-click GitHub deploy, free tier, custom domains |
| Database | Postgres (via Supabase) | Real relational DB, free tier covers club scale |
| Maps (V2) | Leaflet + OpenStreetMap | Free, no API key, sufficient for scouting use case |
| AI (V3) | Anthropic Claude API | Aligns with Rishaan's existing tooling; lightweight insight generation |

**Why not Express backend in MVP:** Adds another deployment surface (Railway/Render), more code to maintain, more cognitive load for someone learning. Supabase JS client called directly from React covers all MVP needs. If a custom backend becomes necessary for V2+ features (e.g., GoFundMe webhook handling, scheduled jobs, AI batch processing), add an Express service then.

**Why not Next.js:** Marginal benefit for an app this size. SPA with React Router is simpler and sufficient.

**Why not Firebase:** Postgres is more transferable knowledge. Supabase's RLS model is cleaner than Firestore rules.

---

## Section 6 — Build plan / timeline

Tied to Rishaan's [12-week full-stack roadmap](full_stack_roadmap.md). Full-stack learning runs in parallel; Janyaa Hub actual construction happens in weeks 4–12.

| Week | Roadmap topic | Janyaa Hub milestone |
|------|---------------|----------------------|
| 1 (late May) | Setup + Modern JS | None — pure learning |
| 2 | React basics (Habit Tracker) | None — pure learning |
| 3 | React Router + mock data | **Janyaa Hub frontend started**: member list, event list, basic routing with hardcoded data |
| 4 | Node + Express basics | Janyaa Hub backend: Express API with file-based storage |
| 5 | Supabase + SQL | Janyaa Hub migrated to Supabase: real DB, CRUD endpoints |
| 6 | Auth | Janyaa Hub: Google OAuth, protected routes, user-to-member linking |
| 7 | Deploy + real users | **Janyaa Hub MVP deployed**, Krishna + 2 members sign in |
| 8–11 | Polish + V2 features | Iterate based on real usage: pick 2–3 of (location map, attendance auto-credit, fundraising dashboard polish, term-based rollups) |
| 12 | Wrap-up | README, demo video, ROADMAP.md, Krishna commitment confirmation |

**Surgery contingency:** If Rishaan's surgery proceeds, weeks 1–2 of recovery = MOOC.fi + AP Lit reading only, no heavy coding. Easy weeks to slot recovery into: Week 5 (SQL is reading-heavy, low motor demand) or Week 1 (pre-coding setup).

**Hard checkpoint at end of Week 6:** If MVP auth + member directory + hours logging isn't working end-to-end by Aug 1, cut V2 scope entirely. Ship what exists, polish, document. Better to ship a tight MVP than a half-built ambitious version.

---

## Section 7 — Risks and dependencies

### Risk: Krishna doesn't actually commit to using it
**Severity: Project-killing.** If Krishna says "cool, sounds good" without engaging on which modules matter or committing to migrate the club's ops, the platform becomes dead software in 3 months. That's worse than no project — it's a college-app story about poor judgment, not impact.

**Mitigation:** Before building, get explicit yes/no from Krishna on:
1. Will the club commit to using this in place of (or alongside) the current Google Sheet by end of fall?
2. Which 3 modules matter most for the MVP?
3. Will he attend 1–2 co-design sessions before construction starts?
4. Will the next president inherit and continue using it?

If any answer is soft, scope down or don't build.

### Risk: Sustainability across term transitions
**Severity: Long-term killer.** Club presidents change every term. If the next president doesn't want the platform, it dies.

**Mitigation:** Build a "platform ownership" transition document. Document admin access transfer. Encourage Krishna to add his successor (likely Arjun?) to admin access early.

### Risk: Feature creep
**Severity: Time risk.** Restaurant program, AI insights, maps are tempting to start in MVP but will torpedo the August deadline.

**Mitigation:** Hard scope lock: MVP = Modules 1, 2, 3 only. Everything else is V2+.

### Risk: Overengineering / wrong abstractions early
**Severity: Medium.** Tempting to add RLS, multi-tenancy, complex permissions in MVP. Don't.

**Mitigation:** MVP: all authenticated members have full access. Permissions added in V2 only when there's evidence they're needed.

---

## Section 8 — What's needed from Krishna

Before building starts (ideally before Week 4 of the roadmap, ~late June):

1. **30-minute call** to walk through this proposal. Not "thoughts?" via text — a real conversation.
2. **Yes/no commitment** to using the platform once the MVP ships.
3. **Module prioritization** — which 3 modules matter most for MVP, in his view.
4. **Sustainability plan** — who inherits when his term ends.
5. **Data access** — permission to view the current Drive structure for migration planning.
6. **Co-design sessions** — 2 one-hour calls in June to align on data model + flows before construction.

Followed during build (~weekly during construction):

7. **15-min check-ins** every 1–2 weeks for feedback on progress.
8. **User testing** in Week 7 — sit with him while he uses the deployed MVP, watch for confusions silently.
9. **Onboarding 2–3 more members** to the platform in Weeks 8–11 for broader usability feedback.

---

## Section 9 — Current state (as of late May 2026)

- **Roadmap:** Drafted (`full_stack_roadmap.md`), Rishaan has it.
- **Janyaa Hub proposal:** Drafted (in conversation, not yet shared with Krishna).
- **Code written:** Zero. Not started.
- **Krishna conversation:** Not yet had.
- **Rishaan's full-stack progress:** Week 1, Day 1.
- **MOOC.fi progress:** Part 2 Exercise 17.
- **Drive access:** Rishaan has access to all Janyaa BCP Drive folders. Member hours sheet, charter, events, experiments, meetings folders all reviewed.
- **Other concurrent commitments:**
  - MOOC.fi Java (daily, parallel track)
  - AP Lit reading: *The Round House* + *There There* (target dates: July 5 + Aug 5)
  - Cooking Merit Badge (low-priority, knock out on a weekend)
  - Sunnyvale Heritage Park Museum site (separate ongoing project, ~2hr/week maintenance)
  - Possible surgery (date TBD)
  - Eagle Scout planning (deferred to fall)

---

## Section 10 — Useful references

**External links:**
- [Janyaa Foundation main site](https://janyaa.org)
- [Bellarmine College Prep](https://www.bcp.org)
- [Supabase docs](https://supabase.com/docs)
- [React docs](https://react.dev)
- [Tailwind v4 docs](https://tailwindcss.com)
- [Vercel docs](https://vercel.com/docs)
- [Leaflet docs](https://leafletjs.com) — for V2 location map
- [Anthropic API docs](https://docs.anthropic.com) — for V3 AI insights

**Companion documents:**
- `full_stack_roadmap.md` — the 12-week learning plan that this project is the capstone of
- Rishaan's Sunnyvale Heritage Park Museum handover document — separate project, similar pattern of stakeholder-driven build

**Drive folders to reference** (Rishaan has access):
- Janyaa BCP root folder
- Member Hours sheet
- Events folder
- Meetings folder
- Charter / governance docs

---

## How to use this document

**If you're a new Claude session helping Rishaan on this project:**

1. Read sections 1, and 2 first (who he is and what the club is).
2. When he asks for help, check section 6 for which week of the build he should be on.
3. When he proposes a feature, check section 3 for whether it's MVP, V2, or V3 scope.
4. When he asks "should I build X" — default to scope discipline (section 7 risks).
5. If you're uncertain about a fact, ask Rishaan rather than guessing.

**If you're a human collaborator (Krishna, an advisor, a teacher):**

Sections 2, 3, 7, 8 are the most relevant. Skip the rest unless you're curious about implementation.

**If you're future-Rishaan opening this in 6 months:**

Section 7 (risks) is the most important. Re-read it before scoping new features.
