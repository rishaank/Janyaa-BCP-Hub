// Supabase Edge Function: ai-social
// Monthly social-media content suggestions for the club's Instagram. Uses Gemini
// with Google Search grounding to reference *current* trends (best-effort - there
// is no free API for exact Instagram trending audio, so trend/audio hints are
// directional, not guaranteed). Caches on club_settings.social_posts.
// verify_jwt = false so the monthly pg_cron can call it; regen is throttled.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'gemini-2.5-flash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

// Pull the first JSON array out of a grounded (free-form) model response.
function extractArray(text: string): unknown[] {
  try {
    return JSON.parse(text)
  } catch {
    /* not pure JSON - fall through */
  }
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      /* give up */
    }
  }
  return []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ ok: false, error: 'GEMINI_API_KEY secret is not set' }, 400)

  const body = await req.json().catch(() => ({}))
  const force = !!body?.force

  // The endpoint is public so the monthly cron can call it — but a *forced*
  // regeneration (the admin "Refresh" button) must come from a signed-in member,
  // or anyone on the internet could burn the Gemini quota at will.
  if (force) {
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ ok: false, error: 'Sign in to refresh' }, 401)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: settings } = await supabase
    .from('club_settings')
    .select('social_posts, social_posts_at')
    .eq('id', true)
    .single()

  // Throttle: regenerate only when forced (by a member) or stale (>25 days) —
  // the monthly cron always lands on the stale side, and anonymous callers can
  // never trigger more than the schedule already would.
  const ageDays = settings?.social_posts_at
    ? (Date.now() - new Date(settings.social_posts_at).getTime()) / 86400000
    : Infinity
  if (!force && ageDays < 25 && Array.isArray(settings?.social_posts)) {
    return json({ ok: true, posts: settings.social_posts, cached: true })
  }

  // A little real context so ideas reference the club's actual events.
  const today = new Date().toISOString().slice(0, 10)
  const { data: events } = await supabase
    .from('events')
    .select('name,date,is_tentative')
    .gte('date', today)
    .order('date')
    .limit(6)
  const upcoming = (events ?? []).filter((e) => !e.is_tentative).map((e) => e.name)
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prompt =
    `It is ${month}. You are the social-media lead for Janyaa BCP, a high-school STEM-education nonprofit ` +
    `club that runs fundraisers and STEM sessions and posts on Instagram (Reels, carousels, stories). ` +
    `Use Google Search to check what is trending on Instagram / short-form video RIGHT NOW (formats, audio ` +
    `styles, content trends for nonprofits and student orgs) and propose 5 specific post ideas for this month ` +
    `that fit the club. ${upcoming.length ? 'Upcoming events to promote: ' + upcoming.join(', ') + '. ' : ''}` +
    `For each idea include: idea (what to post), format (Reel, Carousel, Story, or Post), caption (a ready ` +
    `caption), hashtags (an array of 3 to 6 tags), trend (the current trend or audio style it rides; note this ` +
    `is directional since exact trending-audio data is not publicly available), and bestTime (when to post). ` +
    `Respond with ONLY a JSON array of these 5 objects, no prose.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.85 },
      }),
    },
  )

  if (!res.ok) return json({ ok: false, error: `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502)
  const gd = await res.json()
  const parts = gd?.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((p: { text?: string }) => p.text ?? '').join('\n')
  const posts = extractArray(text)

  if (posts.length) {
    await supabase
      .from('club_settings')
      .update({ social_posts: posts, social_posts_at: new Date().toISOString() })
      .eq('id', true)
  }

  return json({ ok: true, posts })
})
