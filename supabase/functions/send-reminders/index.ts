// Supabase Edge Function: send-reminders
// Emails each member the items they claimed to bring for events happening
// TOMORROW. Runs daily on a pg_cron schedule and can also be triggered manually
// by an admin ("Send reminders now"). Sends through the club Gmail over SMTP
// (the same custom-SMTP creds Supabase uses for auth emails).
// verify_jwt = false so cron (pg_net) can call it; it only ever emails assignees
// about real upcoming items, never arbitrary content.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

const fmtTime = (t: string | null) => {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function escapeHtml(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const smtpUser = Deno.env.get('SMTP_USER')
  const smtpPass = Deno.env.get('SMTP_PASS')
  const from = Deno.env.get('FROM_EMAIL') ?? smtpUser
  if (!smtpUser || !smtpPass) {
    return json({ ok: false, error: 'SMTP secrets not set (SMTP_USER / SMTP_PASS)' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Who's calling? An admin pressing "Email reminders" runs immediately. Anything
  // else (the daily cron — or a stranger, since the endpoint is public) is
  // throttled to one run per 20h via club_settings.reminders_sent_at, so nobody
  // can spam members with duplicate reminder emails.
  let isAdmin = false
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (user) {
      const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      isAdmin = !!me?.is_admin
    }
  }
  if (!isAdmin) {
    const { data: s } = await supabase
      .from('club_settings')
      .select('reminders_sent_at')
      .eq('id', true)
      .single()
    const ageH = s?.reminders_sent_at
      ? (Date.now() - new Date(s.reminders_sent_at).getTime()) / 3600000
      : Infinity
    if (ageH < 20) return json({ ok: true, sent: 0, note: 'already ran in the last 20h' })
    // Stamp before sending so concurrent calls can't double-send.
    await supabase
      .from('club_settings')
      .update({ reminders_sent_at: new Date().toISOString() })
      .eq('id', true)
  }

  // Events happening tomorrow + their to-dos.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const { data: events } = await supabase
    .from('events')
    .select('id,name,start_time,location,event_todos(item,assignee_id)')
    .eq('date', tomorrow)

  if (!events || events.length === 0) return json({ ok: true, sent: 0, note: 'no events tomorrow' })

  // Look up the assignees' names + emails.
  const ids = new Set<string>()
  for (const e of events) for (const t of e.event_todos ?? []) if (t.assignee_id) ids.add(t.assignee_id)
  if (ids.size === 0) return json({ ok: true, sent: 0, note: 'no claimed items' })

  const { data: profiles } = await supabase.from('profiles').select('id,name,email').in('id', [...ids])
  const pById = new Map((profiles ?? []).map((p) => [p.id, p]))

  // member email → their claimed items, grouped by event
  type Ev = { name: string; time: string | null; location: string | null; items: string[] }
  const byMember = new Map<string, { name: string; events: Map<string, Ev> }>()
  for (const e of events) {
    for (const t of e.event_todos ?? []) {
      const p = t.assignee_id ? pById.get(t.assignee_id) : null
      if (!p?.email) continue
      if (!byMember.has(p.email)) byMember.set(p.email, { name: p.name ?? 'there', events: new Map() })
      const m = byMember.get(p.email)!
      if (!m.events.has(e.id)) m.events.set(e.id, { name: e.name, time: e.start_time, location: e.location, items: [] })
      m.events.get(e.id)!.items.push(t.item)
    }
  }
  if (byMember.size === 0) return json({ ok: true, sent: 0, note: 'no assignees with email' })

  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com',
      port: Number(Deno.env.get('SMTP_PORT') ?? 465),
      tls: true,
      auth: { username: smtpUser, password: smtpPass },
    },
  })

  let sent = 0
  const failures: string[] = []
  try {
    for (const [email, m] of byMember) {
      const plural = m.events.size > 1 ? 's' : ''
      const blocks = [...m.events.values()]
        .map((ev) => {
          const when = ev.time ? ` at ${fmtTime(ev.time)}` : ''
          const where = ev.location ? ` · ${ev.location}` : ''
          const items = ev.items.map((i) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('')
          return `<p style="margin:14px 0 4px;font-weight:600;color:#1f2937">${escapeHtml(ev.name)}<span style="font-weight:400;color:#6b7280">${escapeHtml(when + where)}</span></p><ul style="margin:0 0 0 18px;padding:0;color:#374151">${items}</ul>`
        })
        .join('')
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#374151">
        <h2 style="color:#15803d;margin:0 0 4px">You're on for tomorrow 👋</h2>
        <p style="margin:0 0 8px;color:#6b7280">Hi ${escapeHtml(m.name)}, here's what you signed up to bring to tomorrow's Janyaa event${plural}:</p>
        ${blocks}
        <p style="margin:18px 0 0;font-size:13px;color:#9ca3af">Thanks for helping out! — Janyaa BCP Hub</p>
      </div>`
      const text = [...m.events.values()]
        .map((ev) => `${ev.name}${ev.time ? ' at ' + fmtTime(ev.time) : ''}\n- ` + ev.items.join('\n- '))
        .join('\n\n')

      try {
        await client.send({
          from: from!,
          to: email,
          subject: `Reminder: what you're bringing to tomorrow's Janyaa event${plural}`,
          content: text,
          html,
        })
        sent++
      } catch (e) {
        failures.push(`${email}: ${String((e as Error)?.message ?? e)}`)
      }
    }
  } finally {
    await client.close()
  }

  return json({ ok: true, sent, total: byMember.size, failures })
})
