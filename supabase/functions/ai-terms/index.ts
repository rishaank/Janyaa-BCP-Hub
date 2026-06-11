// Supabase Edge Function: ai-terms
// One short Gemini breakdown per club term, cached on terms.ai_summary.
// verify_jwt = true. Called on Terms-page load (self-throttled: past terms
// regenerate only if missing, the current term when older than 7 days) and by
// the page's Refresh button (`force` regenerates everything). A single Gemini
// call covers every term that needs one. Requires the GEMINI_API_KEY secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
const CURRENT_TERM_CACHE_DAYS = 7
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  const body = await req.json().catch(() => ({}))
  const force = !!body?.force

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Make sure the seasonal rows exist, then load everything once.
  await supabase.rpc('ensure_terms')
  const [{ data: terms }, { data: events }, { data: meetings }] = await Promise.all([
    supabase.from('terms').select('*').order('start_date'),
    supabase.from('events').select('name, date, raised, hours, is_tentative, event_signups(member_id)'),
    supabase.from('meetings').select('title, date, canceled, meeting_attendees(member_id)'),
  ])
  if (!terms?.length) return json({ ok: true, updated: 0, note: 'no terms' })

  const today = new Date().toISOString().slice(0, 10)
  const stale = (t: { start_date: string; end_date: string; ai_summary: unknown; ai_summary_at: string | null }) => {
    if (force) return true
    if (!t.ai_summary) return true
    // Past terms don't change; the in-progress term refreshes weekly.
    const isCurrent = t.start_date <= today && t.end_date >= today
    if (!isCurrent) return false
    const ageDays = t.ai_summary_at ? (Date.now() - new Date(t.ai_summary_at).getTime()) / 86400000 : Infinity
    return ageDays > CURRENT_TERM_CACHE_DAYS
  }

  const needed = terms.filter(stale)
  if (!needed.length) return json({ ok: true, updated: 0, cached: true })

  // Per-term stats from real data (confirmed events only).
  const statsFor = (t: { start_date: string; end_date: string }) => {
    const evs = (events ?? []).filter((e) => e.date && !e.is_tentative && e.date >= t.start_date && e.date <= t.end_date)
    const mts = (meetings ?? []).filter((m) => m.date >= t.start_date && m.date <= t.end_date && !m.canceled)
    const people = new Set<string>()
    for (const e of evs) for (const s of e.event_signups ?? []) people.add(s.member_id)
    for (const m of mts) for (const a of m.meeting_attendees ?? []) people.add(a.member_id)
    return {
      events: evs.map((e) => ({ name: e.name, date: e.date, raised: Number(e.raised), crew: (e.event_signups ?? []).length })),
      meetingsCount: mts.length,
      avgMeetingAttendance: mts.length
        ? Math.round((mts.reduce((s, m) => s + (m.meeting_attendees ?? []).length, 0) / mts.length) * 10) / 10
        : 0,
      participants: people.size,
      profit: evs.reduce((s, e) => s + Number(e.raised), 0),
    }
  }

  const payload = needed.map((t) => ({
    id: t.id,
    label: t.label,
    start: t.start_date,
    end: t.end_date,
    inProgress: t.start_date <= today && t.end_date >= today,
    ...statsFor(t),
  }))

  const prompt =
    'You are a data analyst for Janyaa BCP, a high-school STEM-education nonprofit club. For EACH club term ' +
    'below, write a quick breakdown from its REAL numbers: what happened (events, money raised, meetings, how many ' +
    'members took part), what stood out, and — for terms still in progress — what to focus on before it ends. ' +
    'Cite concrete numbers. A term with no activity gets a short factual note, not filler. ' +
    'Return one object per term: id (copied exactly), summary (2-3 sentences), metric (a tiny stat string like ' +
    '"$340 · 4 events"), and tone — "positive" for strong terms, "neutral" for quiet/average, "warning" if activity ' +
    'clearly dropped versus other terms. TERMS: ' +
    JSON.stringify(payload)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                summary: { type: 'STRING' },
                metric: { type: 'STRING' },
                tone: { type: 'STRING', enum: ['positive', 'warning', 'neutral'] },
              },
              required: ['id', 'summary', 'tone'],
            },
          },
        },
      }),
    },
  )
  if (!res.ok) return json({ ok: false, error: `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502)

  const gd = await res.json()
  const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
  let rows: { id: string; summary: string; metric?: string; tone: string }[] = []
  try {
    rows = JSON.parse(text)
  } catch {
    rows = []
  }

  const validIds = new Set(needed.map((t) => t.id))
  let updated = 0
  const now = new Date().toISOString()
  for (const r of rows) {
    if (!validIds.has(r.id) || !r.summary) continue
    await supabase
      .from('terms')
      .update({ ai_summary: { summary: r.summary, metric: r.metric ?? null, tone: r.tone }, ai_summary_at: now })
      .eq('id', r.id)
    updated++
  }

  return json({ ok: true, updated })
})
