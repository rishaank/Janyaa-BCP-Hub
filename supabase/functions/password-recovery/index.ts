// Supabase Edge Function: password-recovery
// Password resets that never touch the member's school mailbox.
//
// Supabase's built-in resetPasswordForEmail() always mails the account's login
// address — for us that's a school Microsoft mailbox, which quarantines or badly
// delays our mail. So we generate the recovery link ourselves
// (auth.admin.generateLink, which returns the link instead of sending it) and
// deliver it over the club Gmail SMTP to the member's RECOVERY address.
//
// Reset mail is sent ONLY to a saved `member_recovery` address — there is no
// fallback to the school login address, because a link sent there usually never
// arrives and the member is left assuming the reset itself failed. A member with
// no recovery address on file cannot receive a reset email at all; an admin
// hands them a copied link (adminLink) instead.
//
// Actions:
//   request   — public "Forgot password" from the login screen. Accepts either
//               the login OR the recovery address, and is rate-limited. It names
//               the masked destination only when mail actually went out; "no
//               account" and "no recovery address" answer identically, so it
//               can't be used to test who has an account.
//   adminSend — an admin mails a member their reset link (no rate limit). Fails
//               with a 400 when that member has no recovery address.
//   adminLink — an admin gets the raw link to copy and hand over out-of-band
//               (text, DM, in person) — no email involved at all, so this is the
//               path for anyone without a recovery address.
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

// r••••n@gmail.com — enough for "which inbox do I open?", not enough to leak it.
function mask(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return '•••'
  const head = user.slice(0, 1)
  const tail = user.length > 2 ? user.slice(-1) : ''
  return `${head}${'•'.repeat(Math.max(user.length - 2, 1))}${tail}@${domain}`
}

// The app's own origin, taken from the redirect the client asked for, so the
// logo URL isn't a hardcoded host. `redirectTo` is `<origin>/set-password`.
function siteOrigin(redirectTo: string | undefined) {
  try {
    return new URL(redirectTo!).origin
  } catch {
    return 'https://hub.janyaabcp.org'
  }
}

// NOTE: every line is emitted without trailing whitespace. denomailer encodes
// the body as quoted-printable, where a space before a line break becomes a
// literal "=20" in the delivered mail — which is exactly what a blank
// indentation-only line in a template literal produces.
function resetHtml(link: string, origin: string) {
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px 0;color:#374151;text-align:center">',
    `<p style="margin:0 0 22px"><img src="${origin}/janyaa-logo.png" width="34" height="34" alt="" style="vertical-align:middle;border:0"><span style="vertical-align:middle;margin-left:9px;font-size:18px;font-weight:700;color:#1f2937">Janyaa BCP Hub</span></p>`,
    '<h2 style="margin:0 0 20px;font-size:21px;color:#15803d">Reset your Hub password</h2>',
    `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Set a new password</a></p>`,
    '<p style="margin:0 0 6px;font-size:13px;color:#6b7280">Or paste this into your browser:</p>',
    `<p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>`,
    '<p style="margin:0 0 4px;font-size:13px;color:#9ca3af">If you didn\'t request this, you can safely ignore this email.</p>',
    '<p style="margin:0;font-size:13px;color:#9ca3af">This link is single use and expires in 1 hour.</p>',
    '</div>',
  ].join('\n')
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

  async function deliver(to: string, link: string) {
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
        content: `Janyaa BCP Hub — reset your password:\n\n${link}\n\nIf you didn't request this, you can safely ignore this email.\nThis link is single use and expires in 1 hour.`,
        html: resetHtml(link, siteOrigin(redirectTo)),
      })
    } finally {
      await client.close()
    }
  }

  // Where this member's reset link goes. Reset mail is ONLY ever sent to a
  // saved recovery address — never to the school login address, which the
  // district's mail tenant quarantines, so a link sent there mostly never
  // arrives and the member is left thinking the reset silently failed. No
  // recovery address on file => no email; the admin hands over a copied link.
  async function recoveryAddressFor(memberId: string) {
    const { data } = await admin
      .from('member_recovery')
      .select('email')
      .eq('member_id', memberId)
      .maybeSingle()
    return data?.email ?? null
  }

  try {
    // ---- public: forgot password from the login screen ----------------------
    if (action === 'request') {
      const typed = (body.email ?? '').trim().toLowerCase()
      // A masked `sentTo` comes back only when mail actually went out, which
      // requires a saved recovery address. "No account" and "account without a
      // recovery address" both return nothing and are indistinguishable.
      if (!typed.includes('@')) return json({ ok: true })

      // Throttle before doing any work — this endpoint is public.
      const { data: allowed } = await admin.rpc('check_password_reset_rate', { p_email: typed })
      if (!allowed) return json({ ok: true })

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
      // No account, or no recovery address to send to — answer identically.
      if (!member?.email) return json({ ok: true })
      const to = await recoveryAddressFor(member.id)
      if (!to) return json({ ok: true })

      await deliver(to, await buildLink(member.email))
      return json({ ok: true, sentTo: mask(to) })
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

    if (action === 'adminLink') return json({ ok: true, link: await buildLink(member.email) })

    if (action === 'adminSend') {
      const to = await recoveryAddressFor(member.id)
      if (!to) {
        return json(
          { error: 'That member has no recovery email set, and reset links are never emailed to school addresses. Add one above, or use Copy reset link.' },
          400,
        )
      }
      await deliver(to, await buildLink(member.email))
      return json({ ok: true, sentTo: mask(to) })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400)
  }
})
