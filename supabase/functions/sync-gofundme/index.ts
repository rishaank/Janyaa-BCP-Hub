// Supabase Edge Function: sync-gofundme
// Scrapes the GoFundMe campaign stored in club_settings.gofundme_url and writes
// the live raised / goal / donation totals back to that row.
//
// Deploy:   supabase functions deploy sync-gofundme
// Call:     from the app via supabase.functions.invoke('sync-gofundme'),
//           or on a schedule via Supabase Cron (see supabase/schema notes).
//
// GoFundMe embeds campaign data in a __NEXT_DATA__ <script> as an Apollo cache.
// The campaign object (Fundraiser:<id>) holds currentAmount / goalAmount as
// Money objects. This parser reads those directly — no headless browser needed.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function parseGoFundMe(html: string) {
  const m = html.match(/id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
  if (!m) throw new Error('Could not find __NEXT_DATA__ on the page')
  const data = JSON.parse(m[1])
  const apollo = data?.props?.pageProps?.__APOLLO_STATE__
  if (!apollo) throw new Error('No Apollo state on the page')

  const fkey = Object.keys(apollo).find((k) => k.startsWith('Fundraiser:'))
  if (!fkey) throw new Error('No Fundraiser object on the page')
  const f = apollo[fkey]

  // Money fields may be an inline object or an Apollo {__ref} pointer.
  const money = (ref: unknown): number | null => {
    if (!ref || typeof ref !== 'object') return null
    const r = ref as Record<string, unknown>
    const o = r.__ref ? apollo[r.__ref as string] : r
    return o && o.amount != null ? Number(o.amount) : null
  }

  return {
    raised: money(f.currentAmount),
    goal: money(f.goalAmount) ?? money(f.userDefinedGoalAmount),
    donations: typeof f.donationCount === 'number' ? f.donationCount : null,
    title: typeof f.title === 'string' ? f.title : null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: settings, error: readErr } = await supabase
      .from('club_settings')
      .select('gofundme_url')
      .eq('id', true)
      .single()
    if (readErr) throw readErr

    const url = settings?.gofundme_url
    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'No gofundme_url set' }), {
        status: 400,
        headers: CORS,
      })
    }

    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`GoFundMe responded ${res.status}`)
    const parsed = parseGoFundMe(await res.text())
    if (parsed.raised == null) throw new Error('Could not parse the raised amount')

    const { error: writeErr } = await supabase
      .from('club_settings')
      .update({
        gofundme_raised: parsed.raised,
        gofundme_goal: parsed.goal,
        gofundme_donations: parsed.donations,
        gofundme_synced_at: new Date().toISOString(),
      })
      .eq('id', true)
    if (writeErr) throw writeErr

    return new Response(JSON.stringify({ ok: true, ...parsed }), { headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: CORS,
    })
  }
})
