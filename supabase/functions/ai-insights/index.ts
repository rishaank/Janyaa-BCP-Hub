// Supabase Edge Function: ai-insights
// Pulls the club's real data, asks Gemini for specific actionable insights, and
// caches them on club_settings. verify_jwt = true → only signed-in members can
// trigger it (protects the Gemini quota). Needs the GEMINI_API_KEY secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS })
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Members are mostly minors — send only first name + last initial to the model so
// full names don't enter the free tier's training / human-review pipeline.
const shortName = (n?: string) => {
  const parts = (n ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'A member'
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const [{ data: events }, { data: profiles }, { data: settings }, { data: locations }, { data: meetings }, { data: goals }] = await Promise.all([
    supabase.from('events').select('id,name,date,location,raised,hours,min_people,max_people,notes,start_time,end_time,is_tentative,event_signups(member_id)'),
    supabase.from('profiles').select('id,name,role,hours_adjustment'),
    supabase.from('club_settings').select('raise_target,gofundme_raised,gofundme_goal,gofundme_donations,term_start_date').eq('id', true).single(),
    supabase.from('locations').select('name,status'),
    supabase.from('meetings').select('title,date,start_time,canceled,meeting_attendees(member_id)'),
    supabase.from('goals').select('title,detail,progress,status,target_date'),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const hoursByMember: Record<string, number> = {}
  for (const e of events ?? []) {
    // Only confirmed, past events earn hours — tentative/undated ones don't count.
    if (e.date && e.date < today && !e.is_tentative) for (const s of e.event_signups ?? []) {
      hoursByMember[s.member_id] = (hoursByMember[s.member_id] ?? 0) + Number(e.hours)
    }
  }

  const summary = {
    today,
    fundraising: {
      goal: settings?.raise_target,
      gofundmeRaised: settings?.gofundme_raised,
      gofundmeGoal: settings?.gofundme_goal,
      donations: settings?.gofundme_donations,
    },
    termStart: settings?.term_start_date ?? null,
    events: (events ?? []).map((e) => ({
      name: e.name,
      date: e.date,
      day: e.date ? DOW[new Date(e.date + 'T00:00:00Z').getUTCDay()] : null,
      time: e.start_time ?? null,
      tentative: !!e.is_tentative,
      past: e.date ? e.date < today : false,
      crew: (e.event_signups ?? []).length,
      raised: Number(e.raised),
      hours: Number(e.hours),
      min: e.min_people,
      max: e.max_people,
      notes: e.notes ?? '',
    })),
    members: (profiles ?? []).map((p) => ({
      name: shortName(p.name),
      role: p.role,
      hours: (hoursByMember[p.id] ?? 0) + Number(p.hours_adjustment ?? 0),
    })),
    meetings: (meetings ?? []).map((m) => ({
      title: m.title,
      date: m.date,
      day: m.date ? DOW[new Date(m.date + 'T00:00:00Z').getUTCDay()] : null,
      past: m.date ? m.date < today : false,
      canceled: !!m.canceled,
      attendance: (m.meeting_attendees ?? []).length,
    })),
    goals: (goals ?? []).map((g) => ({
      title: g.title,
      detail: g.detail ?? '',
      progress: g.progress,
      status: g.status,
      targetDate: g.target_date ?? null,
    })),
    locations: (locations ?? []).map((l) => ({ name: l.name, status: l.status })),
  }

  const prompt =
    'You are a data analyst for the Janyaa BCP club, a high-school STEM-education nonprofit that runs events, holds club meetings, tracks member volunteer hours, sets leadership goals, and fundraises. Analyze the REAL club data below and return 3 to 5 specific, actionable insights a student leader could act on this week. Cite real numbers from the data and avoid generic advice. ' +
    'Events flagged "tentative": true are NOT confirmed (date/time/details may be undecided) — treat them as plans, never count their hours or money as earned, and at most suggest locking in the details. ' +
    'The data also includes club meetings with attendance counts (flag low or declining attendance, ignore canceled ones) and the leadership goals the club set with percent progress (call out goals that are stalled or close to done, especially any with a nearing targetDate). "termStart" is when the current term began — hours reset then. ' +
    'Event notes often contain revenue breakdowns (online vs cash) and useful context worth drawing on. For each insight give a short title, a one to two sentence detail with concrete numbers, a brief metric string (for example +130% or 5 members or $340 to goal), and a tone of positive, warning, or neutral. DATA: ' +
    JSON.stringify(summary)

  const geminiRes = await fetch(
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
                title: { type: 'STRING' },
                detail: { type: 'STRING' },
                metric: { type: 'STRING' },
                tone: { type: 'STRING', enum: ['positive', 'warning', 'neutral'] },
              },
              required: ['title', 'detail', 'tone'],
            },
          },
        },
      }),
    },
  )

  if (!geminiRes.ok) {
    return json({ ok: false, error: `Gemini ${geminiRes.status}: ${(await geminiRes.text()).slice(0, 300)}` }, 502)
  }
  const gd = await geminiRes.json()
  const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
  let insights: unknown[] = []
  try {
    insights = JSON.parse(text)
  } catch {
    insights = []
  }

  await supabase
    .from('club_settings')
    .update({ ai_insights: insights, ai_insights_at: new Date().toISOString() })
    .eq('id', true)

  return json({ ok: true, insights, generated_at: new Date().toISOString() })
})
