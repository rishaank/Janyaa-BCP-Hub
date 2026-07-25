// Supabase Edge Function: password-recovery
// Password resets that don't depend on the member's school mailbox.
//
// Supabase's built-in resetPasswordForEmail() always mails the account's login
// address — for us that's a school Microsoft mailbox, which quarantines or badly
// delays our mail. So we generate the recovery link ourselves
// (auth.admin.generateLink, which returns the link instead of sending it) and
// deliver it over the club Gmail SMTP to the member's RECOVERY address when they
// have one (member_recovery), falling back to the login address.
//
// Actions:
//   request   — public "Forgot password" from the login screen. Accepts either
//               the login OR the recovery address, is rate-limited, and always
//               answers the same way so it can't be used to test who has an
//               account.
//   adminSend — an admin mails a member their reset link (no rate limit; returns
//               the masked destination so the admin can tell them where to look).
//   adminLink — an admin gets the raw link to copy and hand over out-of-band
//               (text, DM, in person) — no email involved at all.
//
// verify_jwt = false so the signed-OUT login screen can call `request`; the two
// admin actions verify the caller's JWT + profiles.is_admin in-function.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

// Same wording whether or not the address matched an account.
const GENERIC =
  "If that address belongs to a Hub account, a reset link is on its way. Check your recovery inbox if you've set one — otherwise your school email (it can take a few minutes to arrive)."

// r••••n@gmail.com — enough for "which inbox do I open?", not enough to leak it.
function mask(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return '•••'
  const head = user.slice(0, 1)
  const tail = user.length > 2 ? user.slice(-1) : ''
  return `${head}${'•'.repeat(Math.max(user.length - 2, 1))}${tail}@${domain}`
}

function resetHtml(name: string, link: string, viaRecovery: boolean) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#374151">
    <h2 style="color:#15803d;margin:0 0 4px">Reset your Hub password</h2>
    <p style="margin:0 0 16px;color:#6b7280">Hi ${name}, use the button below to choose a new password for the Janyaa BCP Hub. The link is good for one use and expires in about an hour.</p>
    <p style="margin:0 0 18px"><a href="${link}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:11px 20px;border-radius:12px;font-weight:600">Set a new password</a></p>
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280">Or paste this into your browser:</p>
    <p style="margin:0 0 18px;font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>
    ${viaRecovery ? '<p style="margin:0 0 6px;font-size:13px;color:#6b7280">You\'re getting this at your recovery address. You still sign in with your school email.</p>' : ''}
    <p style="margin:18px 0 0;font-size:13px;color:#9ca3af">Didn't ask for this? Ignore this email — your password won't change. — Janyaa BCP Hub</p>
  </div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, serviceKey)

  const body = await req.json().catch(() => ({}))
  const { action, redirectTo } = body

  // Generate a recovery link for a login email and (optionally) mail it to the
  // member's recovery address. Shared by all three actions.
  async function buildLink(loginEmail: string) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: loginEmail,
      options: { redirectTo },
    })
    if (error) throw error
    return data?.properties?.action_link as string
  }

  async function deliver(to: string, name: string, link: string, viaRecovery: boolean) {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    const from = Deno.env.get('FROM_EMAIL') ?? smtpUser
    if (!smtpUser || !smtpPass) throw new Error('SMTP secrets not set (SMTP_USER / SMTP_PASS)')

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com',
        port: Number(Deno.env.get('SMTP_PORT') ?? 465),
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    })
    try {
      await client.send({
        from: from!,
        to,
        subject: 'Reset your Janyaa BCP Hub password',
        content: `Hi ${name}, set a new password here (expires in about an hour):\n\n${link}\n\nDidn't ask for this? Ignore this email.`,
        html: resetHtml(name, link, viaRecovery),
      })
    } finally {
      await client.close()
    }
  }

  // Where should this member's reset link go? Recovery address if set.
  async function destinationFor(memberId: string, loginEmail: string) {
    const { data } = await admin
      .from('member_recovery')
      .select('email')
      .eq('member_id', memberId)
      .maybeSingle()
    const to = data?.email ?? loginEmail
    return { to, viaRecovery: !!data?.email }
  }

  try {
    // ---- public: forgot password from the login screen ----------------------
    if (action === 'request') {
      const typed = (body.email ?? '').trim().toLowerCase()
      if (!typed.includes('@')) return json({ ok: true, message: GENERIC })

      // Throttle before doing any work — this endpoint is public.
      const { data: allowed } = await admin.rpc('check_password_reset_rate', { p_email: typed })
      if (!allowed) return json({ ok: true, message: GENERIC })

      // The typed address may be either the login email or a recovery email.
      // Exact match on the lowercased input, never `ilike` — a typed `%` in a
      // pattern match would let a stranger match an arbitrary member's row.
      // Both columns are stored lowercase (auth lowercases; we lowercase ours).
      const [byLogin, byRecovery] = await Promise.all([
        admin.from('profiles').select('id,name,email').eq('email', typed).maybeSingle(),
        admin.from('member_recovery').select('member_id').eq('email', typed).maybeSingle(),
      ])
      let member = byLogin.data
      if (!member && byRecovery.data) {
        const { data } = await admin
          .from('profiles')
          .select('id,name,email')
          .eq('id', byRecovery.data.member_id)
          .maybeSingle()
        member = data
      }
      // No match — same answer as a match, so this can't enumerate accounts.
      if (!member?.email) return json({ ok: true, message: GENERIC })

      const link = await buildLink(member.email)
      const { to, viaRecovery } = await destinationFor(member.id, member.email)
      await deliver(to, member.name ?? 'there', link, viaRecovery)
      return json({ ok: true, message: GENERIC })
    }

    // ---- everything below is admin-only -------------------------------------
    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Not signed in' }, 401)
    const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return json({ error: 'Admins only' }, 403)

    const memberId = body.id
    if (!memberId) return json({ error: 'id required' }, 400)
    const { data: member } = await admin
      .from('profiles')
      .select('id,name,email')
      .eq('id', memberId)
      .single()
    if (!member?.email) return json({ error: 'That member has no email on file.' }, 400)

    const link = await buildLink(member.email)

    if (action === 'adminLink') return json({ ok: true, link })

    if (action === 'adminSend') {
      const { to, viaRecovery } = await destinationFor(member.id, member.email)
      await deliver(to, member.name ?? 'there', link, viaRecovery)
      return json({ ok: true, sentTo: mask(to), viaRecovery })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400)
  }
})
