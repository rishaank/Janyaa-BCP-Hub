// Supabase Edge Function: hours-request-notify
// Emails the operations lead(s) when a member submits an hours request, with the
// request details + a button that opens the request review on the site. Sends
// through the club Gmail over SMTP (same creds as send-reminders). Best-effort:
// the client calls it after creating the request and ignores failures.
// verify_jwt = true — only signed-in members can trigger it.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SITE = 'https://janyaa-bcp-hub.vercel.app'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

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

  let requestId: string | null = null
  try {
    const body = await req.json()
    requestId = body?.requestId ?? null
  } catch {
    /* ignore */
  }
  if (!requestId) return json({ ok: false, error: 'requestId is required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // The request + who made it.
  const { data: r } = await supabase
    .from('hours_requests')
    .select('id, activity, hours, contribution, status, requester:profiles!hours_requests_requester_id_fkey ( name, email )')
    .eq('id', requestId)
    .single()
  if (!r) return json({ ok: false, error: 'request not found' }, 404)

  // Email every current operations lead.
  const { data: leads } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('role', 'operations_lead')
  const recipients = (leads ?? []).filter((l) => l.email)
  if (recipients.length === 0) return json({ ok: true, sent: 0, note: 'no operations lead with email' })

  const requester = (r as { requester?: { name?: string } }).requester
  const who = escapeHtml(requester?.name ?? 'A member')
  const link = `${SITE}/requests`
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#374151">
    <h2 style="color:#15803d;margin:0 0 4px">New hours request</h2>
    <p style="margin:0 0 12px;color:#6b7280">${who} is requesting volunteer hours for your review.</p>
    <table style="border-collapse:collapse;margin:0 0 14px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Activity</td><td style="padding:4px 0;font-weight:600;color:#1f2937">${escapeHtml(r.activity)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Hours</td><td style="padding:4px 0;font-weight:600;color:#1f2937">${Number(r.hours)}</td></tr>
      ${r.contribution ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">Contribution</td><td style="padding:4px 0;color:#374151">${escapeHtml(r.contribution)}</td></tr>` : ''}
    </table>
    <a href="${link}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Review the request →</a>
    <p style="margin:18px 0 0;font-size:13px;color:#9ca3af">Janyaa BCP Hub</p>
  </div>`
  const text = `New hours request from ${requester?.name ?? 'a member'}
Activity: ${r.activity}
Hours: ${Number(r.hours)}${r.contribution ? `\nContribution: ${r.contribution}` : ''}

Review it: ${link}`

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
    for (const lead of recipients) {
      try {
        await client.send({
          from: from!,
          to: lead.email!,
          subject: `New hours request from ${requester?.name ?? 'a member'} (${Number(r.hours)}h)`,
          content: text,
          html,
        })
        sent++
      } catch (e) {
        failures.push(`${lead.email}: ${String((e as Error)?.message ?? e)}`)
      }
    }
  } finally {
    await client.close()
  }

  return json({ ok: true, sent, failures })
})
