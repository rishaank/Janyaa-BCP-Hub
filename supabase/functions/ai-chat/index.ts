// Supabase Edge Function: ai-chat
// A members-only assistant that knows Janyaa + Janyaa BCP and answers from the
// club's LIVE data (events, hours, fundraising, goals, locations, terms). It
// returns a written answer plus structured "references" the client renders as
// clickable cards (an event, a member, a goal…) so claims are cited inline.
// verify_jwt = true. Per-member rate-limited via check_ai_chat_rate() because
// Gemini is on the free tier. Requires the GEMINI_API_KEY secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
const MAX_HISTORY = 10 // last N turns sent to the model
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

// Cited background on Janyaa (mirrors the Club Info page). The model may cite
// these as "source" references; the client links them out.
const JANYAA_FACTS = [
  { fact: 'Janyaa is a registered 501(c)(3) nonprofit (Tax ID 01-0922892) headquartered in Fremont, CA, building creative problem-solving skills in rural children in India. "Janyaa" means "life"; founded 2009 by Venu Nadella.', url: 'https://janyaa.org/' },
  { fact: 'Janyaa teaches experiential, hands-on STEM rather than lectures — people retain ~5% of a lecture, 50% of what they see and hear, and 80% of what they experience.', url: 'https://www.projectworldimpact.com/organization/janyaa-ca' },
  { fact: 'Its flagship program, Janyaa Lab in a Box (JLIB), is 600+ curriculum-aligned science and math experiments for grades 6–10, developed with Stanford professors and STEM experts.', url: 'https://www.millenniumpost.in/opinion/nexus-of-good-driven-by-motivation-445803' },
  { fact: 'Cumulative reach: 1,900 schools, 800,000 students, 22,000 teachers trained. A 2023–24 evaluation showed 65% improvement in Science and 57% in Maths.', url: 'https://janyaa.org/janyaas-impact/' },
  { fact: 'More than 98% of donations go directly to the cause; all donations are tax-deductible. Janyaa runs Bay Area student-led youth chapters that raise funds and awareness.', url: 'https://janyaa.org/janyaa-youth/' },
  { fact: 'Janyaa BCP is the Bellarmine College Prep chapter of the Janyaa Foundation — a student club that runs fundraisers and STEM-education outreach and tracks its members, volunteer hours, events, and meetings in this Hub.', url: 'https://linktr.ee/janyaabcp' },
]

const shortName = (n?: string) => {
  const p = (n ?? '').trim().split(/\s+/).filter(Boolean)
  if (!p.length) return 'Member'
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]
}
const rateMessage = (reason: string) =>
  reason === 'minute'
    ? 'You’re sending messages quickly — give it a few seconds and try again.'
    : reason === 'hour'
      ? 'You’ve hit the hourly limit for the assistant. Try again a bit later.'
      : 'You’ve reached today’s limit for the assistant (it runs on a free AI tier). It resets in a day.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  // Identify the caller (verify_jwt is on, but we still need their id).
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ ok: false, error: 'Not signed in' }, 401)

  const body = await req.json().catch(() => ({}))
  const history = Array.isArray(body?.messages) ? body.messages : []
  const turns = history
    .filter((m: { role?: string; content?: string }) => m?.content && (m.role === 'user' || m.role === 'assistant'))
    .slice(-MAX_HISTORY)
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    return json({ ok: false, error: 'Ask a question to start.' }, 400)
  }
  if (String(turns[turns.length - 1].content).length > 1000) {
    return json({ ok: false, error: 'That message is a bit long — please shorten it.' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Rate limit (and stamp usage) before spending any Gemini quota.
  const { data: rate } = await supabase.rpc('check_ai_chat_rate', { p_member: user.id })
  if (rate && rate.allowed === false) {
    return json(
      {
        ok: false,
        rateLimited: true,
        reason: rate.reason,
        retryAfterSeconds: rate.retry_after_seconds,
        error: rateMessage(rate.reason),
        usage: { usedToday: rate.used_today, dayLimit: rate.day_limit },
      },
      429,
    )
  }
  const usage = { usedToday: rate?.used_today ?? null, dayLimit: rate?.day_limit ?? null }

  // ---- Live club snapshot (fresh every call) ----
  const today = new Date().toISOString().slice(0, 10)
  const [
    { data: breakdowns }, { data: events }, { data: settings },
    { data: goals }, { data: locations }, { data: terms }, { data: meetings },
  ] = await Promise.all([
    supabase.rpc('get_hours_breakdowns', { p_member: null }),
    supabase.from('events').select('id, name, date, location, raised, hours, is_tentative, event_signups(member_id)').order('date'),
    supabase.from('club_settings').select('raise_target, gofundme_raised, gofundme_goal, gofundme_donations').eq('id', true).single(),
    supabase.from('goals').select('id, title, detail, progress, status, target_date, owner:profiles!goals_owner_id_fkey(name)').order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name, status, address').order('saved_at', { ascending: false }),
    supabase.from('terms').select('id, label, start_date, end_date').order('start_date', { ascending: false }),
    supabase.from('meetings').select('id, title, date, canceled').order('date'),
  ])

  const byId = new Map((breakdowns ?? []).map((b: { member_id: string }) => [b.member_id, b]))
  const { data: profiles } = await supabase.from('profiles').select('id, name, role, is_admin, is_founder')
  const members = (profiles ?? []).map((p: { id: string; name: string; role: string; is_admin: boolean; is_founder: boolean }) => {
    const b = byId.get(p.id) as { total?: number; term_total?: number } | undefined
    return { id: p.id, name: shortName(p.name), role: p.role, admin: p.is_admin, founder: p.is_founder, totalHours: Number(b?.total ?? 0), termHours: Number(b?.term_total ?? 0) }
  })

  const evList = (events ?? []).map((e: { id: string; name: string; date: string; location: string; raised: number; hours: number; is_tentative: boolean; event_signups: unknown[] }) => ({
    id: e.id, name: e.name, date: e.date, location: e.location, raised: Number(e.raised || 0),
    hours: Number(e.hours || 0), tentative: e.is_tentative, signups: (e.event_signups ?? []).length,
    upcoming: !!e.date && e.date >= today,
  }))

  const snapshot = {
    today,
    membersCount: members.length,
    members,
    events: evList,
    meetings: (meetings ?? []).filter((m: { canceled: boolean }) => !m.canceled).map((m: { id: string; title: string; date: string }) => ({ id: m.id, title: m.title, date: m.date })),
    fundraising: {
      target: Number(settings?.raise_target ?? 0),
      gofundmeRaised: Number(settings?.gofundme_raised ?? 0),
      gofundmeGoal: Number(settings?.gofundme_goal ?? 0),
      gofundmeDonations: Number(settings?.gofundme_donations ?? 0),
      inPersonRaised: evList.reduce((s, e) => s + e.raised, 0),
    },
    goals: (goals ?? []).map((g: { id: string; title: string; detail: string; progress: number; status: string; target_date: string; owner: { name?: string } }) => ({
      id: g.id, title: g.title, detail: g.detail, progress: g.progress, status: g.status,
      due: g.target_date, owner: g.owner?.name ? shortName(g.owner.name) : null,
    })),
    locations: (locations ?? []).map((l: { id: string; name: string; status: string; address: string }) => ({ id: l.id, name: l.name, status: l.status, address: l.address })),
    terms: (terms ?? []).map((t: { id: string; label: string; start_date: string; end_date: string }) => ({ id: t.id, label: t.label, start: t.start_date, end: t.end_date })),
  }

  const system =
    'You are the Janyaa BCP Hub assistant — a friendly, concise helper for members of Janyaa BCP, the ' +
    'Bellarmine College Prep chapter of the Janyaa Foundation. Answer using the LIVE CLUB DATA and the ' +
    'JANYAA BACKGROUND below; both are current and authoritative for this club. Cite specifics: when you ' +
    'mention an event, member, goal, location, or term that appears in the data, add it to "references" ' +
    'with its exact id so the app shows a clickable card. For a Janyaa background claim, cite it as a ' +
    'reference with kind "source" and the url. Use real numbers from the data. If something is not in the ' +
    'data, say you don’t have it rather than guessing — never invent events, people, hours, or money. Keep ' +
    'answers short (a few sentences or tight bullet points). Today is ' + today + '.\n\n' +
    'JANYAA BACKGROUND:\n' + JANYAA_FACTS.map((f, i) => `[S${i + 1}] ${f.fact} (${f.url})`).join('\n') +
    '\n\nLIVE CLUB DATA (JSON):\n' + JSON.stringify(snapshot)

  // Map history into Gemini "contents". A system instruction carries the data.
  const contents = turns.map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content).slice(0, 1000) }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 900,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              answer: { type: 'STRING' },
              references: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    kind: { type: 'STRING', enum: ['event', 'member', 'goal', 'location', 'term', 'fundraising', 'source'] },
                    id: { type: 'STRING' },
                    label: { type: 'STRING' },
                    sub: { type: 'STRING' },
                    url: { type: 'STRING' },
                  },
                  required: ['kind', 'label'],
                },
              },
            },
            required: ['answer'],
          },
        },
      }),
    },
  )
  if (!res.ok) return json({ ok: false, error: `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`, usage }, 502)

  const gd = await res.json()
  const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  let parsed: { answer?: string; references?: unknown[] } = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { answer: text || 'Sorry — I couldn’t put that together. Try rephrasing?' }
  }

  // Validate references against the real snapshot so cards never point at
  // ids the model hallucinated.
  const ids = {
    event: new Set(evList.map((e) => e.id)),
    member: new Set(members.map((m) => m.id)),
    goal: new Set(snapshot.goals.map((g) => g.id)),
    location: new Set(snapshot.locations.map((l) => l.id)),
    term: new Set(snapshot.terms.map((t) => t.id)),
  } as Record<string, Set<string>>
  const refs = (Array.isArray(parsed.references) ? parsed.references : [])
    .filter((r: { kind?: string; id?: string; url?: string }) => {
      if (!r?.kind) return false
      if (r.kind === 'source') return !!r.url
      if (r.kind === 'fundraising') return true
      return !!r.id && ids[r.kind]?.has(r.id)
    })
    .slice(0, 6)

  return json({ ok: true, answer: parsed.answer ?? '', references: refs, usage })
})
