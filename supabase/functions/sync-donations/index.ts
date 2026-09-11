// Supabase Edge Function: sync-donations
//
// Reads the club's live online-fundraising totals and writes them back to
// club_settings. Successor to `sync-gofundme` (migration 0038).
//
// Deploy:  supabase functions deploy sync-donations
// Call:    supabase.functions.invoke('sync-donations') from the app, or the
//          `sync-donations-3h` pg_cron job (migration 0038).
//
// WHY A SCRAPER AND NOT THE API
// Donations go through Janyaa's official Givebutter campaign. Janyaa BCP does
// not own that account, so there is no API key the club can issue for itself.
// This reads the same public pages a donor sees.
//
// WHAT IT READS
//   club_settings.donations_url       the campaign page — whole-Janyaa figures
//   club_settings.donations_team_url  the "Bellarmine Youth Chapter" team page —
//                                     the club's OWN credited total. Optional:
//                                     until it is filled in, the club total stays
//                                     NULL rather than borrowing Janyaa's.
//
// HOW IT PARSES
// Givebutter's markup is not ours and will change without warning, so this does
// not depend on one shape. Four independent strategies run over the same HTML
// and the results are reconciled; whichever produced the answer is recorded in
// club_settings.donations_sync_status, so a break is diagnosable from the table
// instead of from the function logs.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

type Figures = {
  raised: number | null
  goal: number | null
  donations: number | null
  title: string | null
  strategy: string
}

const EMPTY: Figures = { raised: null, goal: null, donations: null, title: null, strategy: 'none' }

// Key names Givebutter has used for each figure, plus the ones its underlying
// API returns. Matched case-insensitively against every object in the payload.
const RAISED_KEYS = ['raised', 'amountraised', 'raisedamount', 'totalraised', 'currentamount', 'raised_in_cents']
const GOAL_KEYS = ['goal', 'goalamount', 'targetamount', 'fundraisinggoal', 'goal_in_cents']
const COUNT_KEYS = ['donations', 'donationcount', 'donationscount', 'supporters', 'supporterscount', 'donors', 'donorscount']
const TITLE_KEYS = ['title', 'name']

const norm = (k: string) => k.toLowerCase().replace(/[_\s-]/g, '')

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '')
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned)
  }
  // Money objects: { amount: 123, currency: 'USD' } / { value: 123 }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['amount', 'value', 'dollars', 'cents']) {
      if (o[k] != null) {
        const n = asNumber(o[k])
        if (n != null) return k === 'cents' ? n / 100 : n
      }
    }
  }
  return null
}

// Walk an arbitrary JSON tree and pick the object that looks most like a
// campaign: the one carrying BOTH a raised-ish and a goal-ish key. Falls back to
// a raised-ish key alone. Deepest-first so a nested team object beats the
// campaign object wrapping it.
function harvest(root: unknown): Figures {
  let best: Figures | null = null
  let bestScore = -1
  const seen = new Set<unknown>()

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }

    const obj = node as Record<string, unknown>
    let raised: number | null = null
    let goal: number | null = null
    let donations: number | null = null
    let title: string | null = null

    for (const [key, value] of Object.entries(obj)) {
      const n = norm(key)
      if (raised == null && RAISED_KEYS.includes(n)) {
        const v = asNumber(value)
        if (v != null) raised = n.endsWith('incents') ? v / 100 : v
      }
      if (goal == null && GOAL_KEYS.includes(n)) {
        const v = asNumber(value)
        if (v != null) goal = n.endsWith('incents') ? v / 100 : v
      }
      if (donations == null && COUNT_KEYS.includes(n)) {
        const v = asNumber(value)
        if (v != null && Number.isInteger(v)) donations = v
      }
      if (title == null && TITLE_KEYS.includes(n) && typeof value === 'string' && value.length < 200) {
        title = value
      }
    }

    if (raised != null) {
      // Prefer a complete campaign-shaped object over a stray "goal" field.
      const score = (goal != null ? 2 : 0) + (donations != null ? 1 : 0)
      if (score > bestScore) {
        bestScore = score
        best = { raised, goal, donations, title, strategy: 'json' }
      }
    }

    for (const child of Object.values(obj)) visit(child)
  }

  visit(root)
  return best ?? EMPTY
}

function tryJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// --- strategy 1: the classic Next.js Pages-Router blob -------------------
function fromNextData(html: string): Figures {
  const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return EMPTY
  const data = tryJson(m[1])
  if (!data) return EMPTY
  const got = harvest(data)
  return got.raised == null ? EMPTY : { ...got, strategy: 'next-data' }
}

// --- strategy 2: the App-Router flight stream ----------------------------
// Next 13+ streams the payload as many self.__next_f.push([1,"<chunk>"]) calls.
// The chunks are JS string literals that concatenate into one blob containing
// embedded JSON. Parse each brace-balanced object found in the joined text.
function fromFlight(html: string): Figures {
  const chunks: string[] = []
  const re = /self\.__next_f\.push\(\[\d+,\s*"([\s\S]*?)"\]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const unescaped = tryJson(`"${m[1]}"`)
    if (typeof unescaped === 'string') chunks.push(unescaped)
  }
  if (!chunks.length) return EMPTY

  const blob = chunks.join('')
  let best = EMPTY
  let bestScore = -1

  // Scan for balanced {...} regions and try each as JSON.
  for (let i = 0; i < blob.length; i++) {
    if (blob[i] !== '{') continue
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let j = i; j < blob.length && j - i < 400_000; j++) {
      const c = blob[j]
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) { end = j; break }
      }
    }
    if (end < 0) continue
    const candidate = tryJson(blob.slice(i, end + 1))
    if (candidate) {
      const got = harvest(candidate)
      if (got.raised != null) {
        const score = (got.goal != null ? 2 : 0) + (got.donations != null ? 1 : 0)
        if (score > bestScore) { bestScore = score; best = { ...got, strategy: 'flight' } }
      }
    }
    i = end // don't rescan the inside of an object we already parsed
  }
  return best
}

// --- strategy 3: any other inline JSON state -----------------------------
function fromInlineState(html: string): Figures {
  const patterns = [
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/g,
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/g,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const data = tryJson(m[1].trim())
      if (!data) continue
      const got = harvest(data)
      if (got.raised != null) return { ...got, strategy: 'inline-state' }
    }
  }
  return EMPTY
}

// --- strategy 4: the rendered text --------------------------------------
// The least structured but the most stable across redesigns, and the only one
// that is unambiguously in DOLLARS — which is what disambiguates cents below.
function fromText(html: string): Figures {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

  const money = (s: string) => Number(s.replace(/[$,]/g, ''))
  // "$1,234 raised" / "$1,234.50 raised of $10,000"
  const raisedM = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)\s*(?:raised|donated)/i)
  const goalM =
    text.match(/of\s*\$\s?([\d,]+(?:\.\d{1,2})?)\s*goal/i) ||
    text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)\s*goal/i)
  const countM = text.match(/([\d,]+)\s*(?:donations?|donors?|supporters?)/i)

  if (!raisedM) return EMPTY
  return {
    raised: money(raisedM[1]),
    goal: goalM ? money(goalM[1]) : null,
    donations: countM ? Number(countM[1].replace(/,/g, '')) : null,
    title: null,
    strategy: 'text',
  }
}

// Run every strategy and reconcile. Structured data wins on completeness, but
// the rendered text is the authority on UNITS: Givebutter's internal payloads
// sometimes carry cents, and "$1,234 raised" on the page never does. When the
// structured figure is exactly 100x the text figure, the payload was in cents.
function parseGivebutter(html: string): Figures {
  const text = fromText(html)
  const structured = [fromNextData(html), fromFlight(html), fromInlineState(html)].filter(
    (f) => f.raised != null,
  )

  if (!structured.length) return text

  structured.sort(
    (a, b) =>
      (b.goal != null ? 2 : 0) + (b.donations != null ? 1 : 0) -
      ((a.goal != null ? 2 : 0) + (a.donations != null ? 1 : 0)),
  )
  const best = { ...structured[0] }

  if (text.raised != null && best.raised != null && text.raised > 0) {
    const ratio = best.raised / text.raised
    if (Math.abs(ratio - 100) < 0.5) {
      best.raised = best.raised / 100
      if (best.goal != null) best.goal = best.goal / 100
      best.strategy += '+cents'
    } else if (Math.abs(ratio - 1) > 0.02) {
      // The two disagree and not by a factor of 100 — trust what a human would
      // read off the page, and say so in the status.
      return { ...text, strategy: `text(structured-disagreed:${best.raised})` }
    }
  }

  best.donations ??= text.donations
  best.goal ??= text.goal
  return best
}

async function scrape(url: string): Promise<Figures> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`)
  return parseGivebutter(await res.text())
}

// Only ever fetch the donation platform. Without this the function is an open
// URL-fetch proxy sitting on Supabase's egress.
function assertAllowed(url: string) {
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') throw new Error('not https')
    host = u.hostname.replace(/^www\./, '')
  } catch {
    throw new Error(`Not a usable URL: ${url}`)
  }
  const ok = host === 'givebutter.com' || host.endsWith('.givebutter.com') ||
    host === 'gofundme.com' || host.endsWith('.gofundme.com')
  if (!ok) throw new Error(`Refusing to fetch ${host} — donation platforms only`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    const { data: settings, error: readErr } = await supabase
      .from('club_settings')
      .select(
        'donations_url, donations_team_url, donations_raised, donations_goal, donations_count, ' +
          'donations_synced_at, donations_campaign_raised, donations_campaign_goal, donations_campaign_donations',
      )
      .eq('id', true)
      .single()
    if (readErr) throw readErr

    // --- probe: parse a page and report, without writing anything ---------
    // How the team URL gets found in the first place, and how a parse break gets
    // diagnosed. Admin-only, because it makes the function fetch a chosen URL.
    if (body?.probe) {
      const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!jwt) return new Response(JSON.stringify({ ok: false, error: 'Sign in required' }), { status: 401, headers: CORS })
      const { data: userRes } = await supabase.auth.getUser(jwt)
      const uid = userRes?.user?.id
      if (!uid) return new Response(JSON.stringify({ ok: false, error: 'Sign in required' }), { status: 401, headers: CORS })
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', uid).single()
      if (!prof?.is_admin) return new Response(JSON.stringify({ ok: false, error: 'Admins only' }), { status: 403, headers: CORS })

      const url = String(body.probe)
      assertAllowed(url)
      const figures = await scrape(url)
      return new Response(JSON.stringify({ ok: true, probe: url, figures }), { headers: CORS })
    }

    // --- throttle ---------------------------------------------------------
    // The endpoint is public (the cron calls it), so a sync from the last minute
    // is served as-is rather than hitting Givebutter again.
    const ageMs = settings?.donations_synced_at
      ? Date.now() - new Date(settings.donations_synced_at).getTime()
      : Infinity
    if (ageMs < 60_000 && !body?.force) {
      return new Response(
        JSON.stringify({
          ok: true,
          cached: true,
          raised: settings.donations_raised,
          goal: settings.donations_goal,
          donations: settings.donations_count,
          campaign_raised: settings.donations_campaign_raised,
        }),
        { headers: CORS },
      )
    }

    const campaignUrl = settings?.donations_url
    if (!campaignUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'No donations_url set' }), {
        status: 400,
        headers: CORS,
      })
    }
    assertAllowed(campaignUrl)

    const update: Record<string, unknown> = { donations_synced_at: new Date().toISOString() }
    const notes: string[] = []

    // The whole-Janyaa campaign: always available, gives the $10,000 context.
    try {
      const c = await scrape(campaignUrl)
      if (c.raised == null) throw new Error('no raised figure on the campaign page')
      update.donations_campaign_raised = c.raised
      update.donations_campaign_donations = c.donations
      if (c.goal != null) update.donations_campaign_goal = c.goal
      notes.push(`campaign:${c.strategy}`)
    } catch (e) {
      notes.push(`campaign-error:${(e as Error).message}`)
    }

    // The club's own credited total. Only the team page can report this — the
    // campaign page cannot be split by team — so without that URL the club total
    // is left untouched rather than filled with a number that isn't the club's.
    const teamUrl = settings?.donations_team_url
    if (teamUrl) {
      try {
        assertAllowed(teamUrl)
        const t = await scrape(teamUrl)
        if (t.raised == null) throw new Error('no raised figure on the team page')
        update.donations_raised = t.raised
        update.donations_count = t.donations
        if (t.goal != null) update.donations_goal = t.goal
        notes.push(`team:${t.strategy}`)
      } catch (e) {
        notes.push(`team-error:${(e as Error).message}`)
      }
    } else {
      notes.push('team:not-configured')
    }

    const failedEverything = notes.every((n) => n.includes('error') || n === 'team:not-configured')
    update.donations_sync_status = (failedEverything ? 'error ' : 'ok ') + notes.join(' · ')

    const { error: writeErr } = await supabase.from('club_settings').update(update).eq('id', true)
    if (writeErr) throw writeErr

    return new Response(
      JSON.stringify({
        ok: !failedEverything,
        status: update.donations_sync_status,
        raised: update.donations_raised ?? settings?.donations_raised ?? null,
        campaign_raised: update.donations_campaign_raised ?? null,
        campaign_goal: update.donations_campaign_goal ?? null,
      }),
      { headers: CORS },
    )
  } catch (e) {
    const message = String((e as Error)?.message ?? e)
    // Record the failure so the Fundraising page can say the figure is stale
    // instead of silently showing an old number as if it were fresh.
    await supabase
      .from('club_settings')
      .update({ donations_sync_status: `error ${message}` })
      .eq('id', true)
      .then(() => {}, () => {})
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: CORS })
  }
})
