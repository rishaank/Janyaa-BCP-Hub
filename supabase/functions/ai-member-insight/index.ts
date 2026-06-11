// Supabase Edge Function: ai-member-insight
// One Gemini insight per member — their progress + concrete areas to improve —
// cached on profiles.ai_insight. verify_jwt = true. Auto-refreshes when a
// profile is viewed with a cache older than 30 days; `force` (the profile's
// Refresh button) is allowed for the member themself or an admin.
// Requires the GEMINI_API_KEY secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
const CACHE_DAYS = 30
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

// Members are mostly minors — first name + last initial only.
const shortName = (n?: string) => {
  const parts = (n ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'This member'
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
}

type Breakdown = {
  member_id: string
  name?: string
  role?: string
  total?: number
  term_total?: number
  entries?: { date?: string; hours?: number; description?: string; kind?: string }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  const body = await req.json().catch(() => ({}))
  const memberId = body?.memberId
  if (!memberId) return json({ ok: false, error: 'memberId required' }, 400)

  // Who's asking? force-refresh is limited to the member themself or an admin.
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ ok: false, error: 'Not signed in' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: target } = await supabase
    .from('profiles')
    .select('id, name, role, joined_date, is_admin, ai_insight, ai_insight_at')
    .eq('id', memberId)
    .single()
  if (!target) return json({ ok: false, error: 'Member not found' }, 404)

  let force = !!body?.force
  if (force && user.id !== memberId) {
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    force = !!me?.is_admin
  }

  // Cache: regenerate monthly, or on demand.
  const ageDays = target.ai_insight_at
    ? (Date.now() - new Date(target.ai_insight_at).getTime()) / 86400000
    : Infinity
  if (!force && target.ai_insight && ageDays < CACHE_DAYS) {
    return json({ ok: true, insight: target.ai_insight, cached: true })
  }

  // The member's data + the club around them, all from the canonical sources.
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: breakdowns }, { data: upcoming }, { data: goals }, { data: todos }, { data: termStart }] =
    await Promise.all([
      supabase.rpc('get_hours_breakdowns', { p_member: null }),
      supabase
        .from('event_signups')
        .select('events!inner ( name, date )')
        .eq('member_id', memberId)
        .gte('events.date', today),
      supabase.from('goals').select('title, progress, status, target_date').eq('owner_id', memberId),
      supabase.from('event_todos').select('item, done').eq('assignee_id', memberId),
      supabase.rpc('current_term_start'),
    ])

  const all = (breakdowns ?? []) as Breakdown[]
  const mine = all.find((b) => b.member_id === memberId)
  const others = all.filter((b) => b.member_id !== memberId)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

  const summary = {
    today,
    termStart: termStart ?? null,
    member: {
      name: shortName(target.name),
      role: target.role,
      joined: target.joined_date ?? null,
      totalHours: Number(mine?.total ?? 0),
      termHours: Number(mine?.term_total ?? 0),
      recentEntries: (mine?.entries ?? []).slice(0, 8).map((e) => ({
        date: e.date ?? null,
        hours: Number(e.hours ?? 0),
        what: e.description,
        kind: e.kind,
      })),
      upcomingSignups: (upcoming ?? []).map((s: { events: { name: string; date: string } }) => s.events?.name).filter(Boolean),
      goals: (goals ?? []).map((g) => ({ title: g.title, progress: g.progress, status: g.status, due: g.target_date })),
      todos: { claimed: (todos ?? []).length, done: (todos ?? []).filter((t) => t.done).length },
    },
    clubAverages: {
      totalHours: Math.round(avg(others.map((b) => Number(b.total ?? 0))) * 10) / 10,
      termHours: Math.round(avg(others.map((b) => Number(b.term_total ?? 0))) * 10) / 10,
    },
  }

  const prompt =
    'You are a supportive mentor for a member of Janyaa BCP, a high-school STEM-education nonprofit club. ' +
    'Write ONE personal insight about this member from their REAL data below: how their volunteering is going ' +
    '(progress, momentum, standout contributions — cite concrete numbers and compare to the club averages) and ' +
    '1-2 specific, encouraging areas to improve (e.g. sign up for an upcoming event, claim a to-do, push a stalled ' +
    'goal). Address the member as "you". Keep it warm, specific, and useful — never generic. ' +
    'Return: title (short, friendly), detail (2-3 sentences on their progress with numbers), improve (1-2 ' +
    'sentences of specific next steps), metric (a tiny stat string like "12h this term"), and tone — "positive" if ' +
    'they are ahead/on track, "neutral" if steady, "warning" only if engagement clearly dropped. DATA: ' +
    JSON.stringify(summary)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              detail: { type: 'STRING' },
              improve: { type: 'STRING' },
              metric: { type: 'STRING' },
              tone: { type: 'STRING', enum: ['positive', 'warning', 'neutral'] },
            },
            required: ['title', 'detail', 'improve', 'tone'],
          },
        },
      }),
    },
  )
  if (!res.ok) return json({ ok: false, error: `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502)

  const gd = await res.json()
  const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'null'
  let insight: unknown = null
  try {
    insight = JSON.parse(text)
  } catch {
    insight = null
  }
  if (!insight) return json({ ok: false, error: 'Could not parse the insight' }, 502)

  await supabase
    .from('profiles')
    .update({ ai_insight: insight, ai_insight_at: new Date().toISOString() })
    .eq('id', memberId)

  return json({ ok: true, insight })
})
