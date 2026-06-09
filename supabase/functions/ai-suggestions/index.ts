// Supabase Edge Function: ai-suggestions
// Looks at the club's real history and asks Gemini for concrete next-event ideas
// and locations worth trying. Caches them on club_settings.ai_suggestions.
// verify_jwt = true -> only signed-in members can spend the Gemini quota.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const [{ data: events }, { data: locations }, { data: settings }] = await Promise.all([
    supabase.from('events').select('name,date,location,raised,hours,is_tentative,event_signups(member_id)'),
    supabase.from('locations').select('name,status,address'),
    supabase.from('club_settings').select('raise_target,gofundme_raised').eq('id', true).single(),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const summary = {
    today,
    fundraising: { goal: settings?.raise_target, raised: settings?.gofundme_raised },
    pastEvents: (events ?? [])
      .filter((e) => e.date && e.date < today && !e.is_tentative)
      .map((e) => ({
        name: e.name,
        day: e.date ? DOW[new Date(e.date + 'T00:00:00Z').getUTCDay()] : null,
        location: e.location,
        raised: Number(e.raised),
        crew: (e.event_signups ?? []).length,
      })),
    locations: (locations ?? []).map((l) => ({ name: l.name, status: l.status })),
  }

  const prompt =
    'You are an event strategist for the Janyaa BCP club, a high-school STEM-education nonprofit that runs ' +
    'fundraisers and STEM-education sessions in the San Jose / Bay Area. Using the REAL history below, propose: ' +
    '(1) 3-4 specific NEXT EVENTS worth running - each with a short title, a one-sentence reason grounded in the ' +
    'data (e.g. which past events or days raised the most), the best day of week, and a rough expected outcome; ' +
    'and (2) EXACTLY 4 specific LOCATIONS worth trying, of which AT LEAST 2 must be BRAND-NEW real places that are ' +
    'NOT already in our saved locations list. For every location give a real place name and a one-sentence reason. ' +
    'Set isNew=true for places not in our saved list, isNew=false for ones we already have. For each isNew location ' +
    'you MUST include real approximate coordinates in the San Jose / Bay Area (latitude ~37.2-37.45, longitude ' +
    '~-122.05 to -121.8) and a short street address. Favor what has actually worked. Be concrete, use real Bay Area ' +
    'venues, and avoid generic advice. DATA: ' +
    JSON.stringify(summary)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              events: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    why: { type: 'STRING' },
                    bestDay: { type: 'STRING' },
                    expected: { type: 'STRING' },
                  },
                  required: ['title', 'why'],
                },
              },
              locations: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    why: { type: 'STRING' },
                    isNew: { type: 'BOOLEAN' },
                    address: { type: 'STRING' },
                    lat: { type: 'NUMBER' },
                    lng: { type: 'NUMBER' },
                  },
                  required: ['name', 'why', 'isNew'],
                },
              },
            },
            required: ['events', 'locations'],
          },
        },
      }),
    },
  )

  if (!res.ok) return json({ ok: false, error: `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502)
  const gd = await res.json()
  let suggestions: unknown = { events: [], locations: [] }
  try {
    suggestions = JSON.parse(gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
  } catch {
    suggestions = { events: [], locations: [] }
  }

  await supabase
    .from('club_settings')
    .update({ ai_suggestions: suggestions, ai_suggestions_at: new Date().toISOString() })
    .eq('id', true)

  return json({ ok: true, suggestions })
})
