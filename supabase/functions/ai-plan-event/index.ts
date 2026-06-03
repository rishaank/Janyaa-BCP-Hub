// Supabase Edge Function: ai-plan-event
// Takes a few answers from the planner wizard (any blank field = you decide)
// and asks Gemini to design a full event: details, a run-of-show timeline, and a
// prep to-do list. Returns the plan WITHOUT saving - the client creates the event
// and to-dos when the user accepts. verify_jwt = true.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
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
  const answers = body?.answers ?? {}

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // A little real context so the plan fits the club.
  const [{ data: events }, { data: locations }] = await Promise.all([
    supabase.from('events').select('name,location,raised,hours').order('date', { ascending: false }).limit(12),
    supabase.from('locations').select('name,status'),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const prompt =
    'You are an event planner for the Janyaa BCP club, a high-school STEM-education nonprofit in San Jose that ' +
    'runs fundraisers and STEM-education sessions. Plan ONE complete event from the organizer answers below. ' +
    'Any answer left blank means no preference, so pick a sensible option and explain it in the ' +
    'summary. Today is ' + today + '; if a concrete date is implied or you can choose a good one, return it as ' +
    'YYYY-MM-DD, otherwise leave date blank. Keep it realistic for a high-school club. Produce a short summary, a ' +
    'run-of-show timeline (a handful of steps with clock times), and a concrete prep to-do list (who-brings-what / ' +
    'setup items). PAST EVENTS for context: ' + JSON.stringify(events ?? []) +
    ' SAVED LOCATIONS: ' + JSON.stringify((locations ?? []).map((l) => l.name)) +
    ' ORGANIZER ANSWERS: ' + JSON.stringify(answers)

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
              name: { type: 'STRING' },
              date: { type: 'STRING' },
              startTime: { type: 'STRING' },
              endTime: { type: 'STRING' },
              location: { type: 'STRING' },
              address: { type: 'STRING' },
              hours: { type: 'NUMBER' },
              minPeople: { type: 'NUMBER' },
              maxPeople: { type: 'NUMBER' },
              summary: { type: 'STRING' },
              timeline: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: { time: { type: 'STRING' }, item: { type: 'STRING' } },
                  required: ['item'],
                },
              },
              todos: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['name', 'summary', 'timeline', 'todos'],
          },
        },
      }),
    },
  )

  if (!res.ok) return json({ ok: false, error: `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502)
  const gd = await res.json()
  let plan: unknown = null
  try {
    plan = JSON.parse(gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'null')
  } catch {
    plan = null
  }
  if (!plan) return json({ ok: false, error: 'Could not parse a plan. Try again.' }, 502)

  return json({ ok: true, plan })
})
