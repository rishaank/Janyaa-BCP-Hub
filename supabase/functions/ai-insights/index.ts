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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const [{ data: events }, { data: profiles }, { data: settings }, { data: locations }] = await Promise.all([
    supabase.from('events').select('id,name,date,location,raised,hours,min_people,max_people,event_signups(member_id)'),
    supabase.from('profiles').select('id,name,role,hours_adjustment'),
    supabase.from('club_settings').select('raise_target,gofundme_raised,gofundme_goal,gofundme_donations').eq('id', true).single(),
    supabase.from('locations').select('name,status'),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const hoursByMember: Record<string, number> = {}
  for (const e of events ?? []) {
    if (e.date < today) for (const s of e.event_signups ?? []) {
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
    events: (events ?? []).map((e) => ({
      name: e.name,
      date: e.date,
      day: DOW[new Date(e.date + 'T00:00:00Z').getUTCDay()],
      past: e.date < today,
      crew: (e.event_signups ?? []).length,
      raised: Number(e.raised),
      hours: Number(e.hours),
      min: e.min_people,
      max: e.max_people,
    })),
    members: (profiles ?? []).map((p) => ({
      name: p.name,
      role: p.role,
      hours: (hoursByMember[p.id] ?? 0) + Number(p.hours_adjustment ?? 0),
    })),
    locations: (locations ?? []).map((l) => ({ name: l.name, status: l.status })),
  }

  const prompt =
    'You are a data analyst for the Janyaa BCP club, a high-school STEM-education nonprofit that runs events, tracks member volunteer hours, and fundraises. Analyze the REAL club data below and return 3 to 5 specific, actionable insights a student leader could act on this week. Cite real numbers from the data and avoid generic advice. For each insight give a short title, a one to two sentence detail with concrete numbers, a brief metric string (for example +130% or 5 members or $340 to goal), and a tone of positive, warning, or neutral. DATA: ' +
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
