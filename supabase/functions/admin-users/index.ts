// Supabase Edge Function: admin-users
// Admin-only account management that needs the service role (impossible from the
// browser): create accounts (with a set password, an emailed invite, OR a copied
// invite link), set a new password, change the login email, and delete accounts.
// Password RESETS live in the `password-recovery` function (they need the
// recovery-address routing).
// verify_jwt = true -> caller must be signed in; we then confirm they're an admin
// (profiles.is_admin) before doing anything. Never trust the client's word for it.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

// Turn a generateLink() result into a link that lands on OUR set-password page
// carrying the one-time token, instead of Supabase's /auth/v1/verify URL.
//
// Why: /auth/v1/verify CONSUMES the token on the very first GET. An invite link
// pasted into iMessage/Slack/WhatsApp, or mailed through a scanner that follows
// links (Outlook Safe Links), gets fetched by the unfurler before the member
// ever taps it — so their tap lands on "Email link is invalid or has expired".
// A link to our own page is inert to a prefetch (it is just the SPA's HTML);
// the token is only spent when the page runs verifyOtp() in the member's
// browser. Falls back to the raw action_link if anything is missing.
function appLink(props: Record<string, string> | undefined, redirectTo?: string) {
  const token = props?.hashed_token
  const type = props?.verification_type
  if (!token || !type || !redirectTo) return props?.action_link
  const u = new URL(redirectTo)
  u.searchParams.set('token_hash', token)
  u.searchParams.set('type', type)
  return u.toString()
}

// The app's own origin, taken from the redirect the client asked for (the same
// helper `password-recovery` uses), so the logo isn't a hardcoded host.
function siteOrigin(redirectTo: string | undefined) {
  try {
    return new URL(redirectTo!).origin
  } catch {
    return 'https://hub.janyaabcp.org'
  }
}

// NOTE: every line is emitted without trailing whitespace — denomailer encodes
// the body as quoted-printable, where a space before a line break is delivered
// as a literal "=20" (which is what an indentation-only line in a template
// literal produces).
function inviteHtml(link: string, name: string | null, origin: string) {
  const safeName = name?.replace(/[<>&"]/g, '') ?? null
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px 0;color:#374151;text-align:center">',
    `<p style="margin:0 0 22px"><img src="${origin}/janyaa-logo.png" width="34" height="34" alt="" style="vertical-align:middle;border:0"><span style="vertical-align:middle;margin-left:9px;font-size:18px;font-weight:700;color:#1f2937">Janyaa BCP Hub</span></p>`,
    `<h2 style="margin:0 0 20px;font-size:21px;color:#15803d">${safeName ? `Welcome, ${safeName}` : 'Welcome to the Hub'}</h2>`,
    '<p style="margin:0 0 22px;font-size:14px">An admin created your Janyaa BCP Hub account. Set a password to sign in.</p>',
    `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Set your password</a></p>`,
    '<p style="margin:0 0 6px;font-size:13px;color:#6b7280">Or paste this into your browser:</p>',
    `<p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#9ca3af">${link}</p>`,
    '<p style="margin:0;font-size:13px;color:#9ca3af">This link is single use and expires in 1 hour.</p>',
    '</div>',
  ].join('\n')
}

async function sendInvite(to: string, link: string, name: string | null, redirectTo?: string) {
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
      subject: 'Your Janyaa BCP Hub account',
      content: `An admin created your Janyaa BCP Hub account. Set a password to sign in:\n\n${link}\n\nThis link is single use and expires in 1 hour.`,
      html: inviteHtml(link, name, siteOrigin(redirectTo)),
    })
  } finally {
    await client.close()
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Who is calling?
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userErr } = await caller.auth.getUser()
  if (userErr || !user) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey)

  const body = await req.json().catch(() => ({}))
  const { action, redirectTo } = body

  // Self-service account deletion (any signed-in member may delete THEIR OWN
  // account + data - California SB 568 "eraser" right for minors). No admin
  // needed. Deleting the auth user cascades the profile + sign-ups/attendance.
  if (action === 'deleteSelf') {
    try {
      await admin.storage.from('avatars').remove([`${user.id}/avatar`])
    } catch (_) {
      /* no avatar or already gone - best effort */
    }
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return json({ error: String((error as Error)?.message ?? error) }, 400)
    return json({ ok: true })
  }

  // Everything below requires the caller to be an admin.
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return json({ error: 'Admins only' }, 403)

  try {
    if (action === 'create') {
      const email = (body.email ?? '').trim()
      const name = (body.name ?? '').trim() || null
      const password = body.password
      if (!email) return json({ error: 'Email required' }, 400)

      if (password) {
        // must_set_password marks a password the ADMIN chose: the app sends the
        // member straight to /set-password on their first sign-in and keeps
        // them there until they pick their own. It lives in user_metadata (the
        // member can write their own) rather than profiles, which is
        // admin-only to edit. It's a prompt, not a security boundary — what
        // protects the account is that only the admin and the member know the
        // temporary password.
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, must_set_password: true },
        })
        if (error) throw error
        if (name) await admin.from('profiles').update({ name }).eq('id', data.user.id)
        return json({ ok: true, id: data.user.id })
      }

      // `link: true` -> create the account but hand the set-password link BACK
      // instead of emailing it, so the admin can pass it on by text/DM/in person.
      // generateLink('invite') creates the user exactly like inviteUserByEmail
      // does, minus the send. Same escape hatch as "Copy reset link" on the
      // profile page, and the one that works when a school mailbox eats our mail.
      if (body.link) {
        const { data, error } = await admin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { data: { name }, redirectTo },
        })
        if (error) throw error
        const id = data?.user?.id
        if (name && id) await admin.from('profiles').update({ name }).eq('id', id)
        return json({
          ok: true,
          id,
          link: appLink(data?.properties as Record<string, string>, redirectTo),
        })
      }

      // No password -> email them an invite with a set-password link.
      //
      // We generate the link and send it over the club Gmail ourselves, rather
      // than letting inviteUserByEmail mail Supabase's own /auth/v1/verify URL:
      // that URL is spent by the first GET, and a school Microsoft mailbox runs
      // every link through Safe Links before the member sees it, so the invite
      // arrived already "expired". The link we send points at our own page and
      // is only spent when the member's browser verifies it. Same reason as the
      // copied link above and as `password-recovery`.
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { data: { name }, redirectTo },
      })
      if (error) throw error
      const newId = data?.user?.id
      if (name && newId) await admin.from('profiles').update({ name }).eq('id', newId)

      const link = appLink(data?.properties as Record<string, string>, redirectTo)
      try {
        await sendInvite(email, link!, name, redirectTo)
      } catch (mailErr) {
        // The account exists either way — hand the link back so the admin can
        // pass it on instead of leaving a member who can never sign in.
        return json({
          ok: true,
          id: newId,
          link,
          mailError: String((mailErr as Error)?.message ?? mailErr),
        })
      }
      return json({ ok: true, id: newId, invited: true })
    }

    if (action === 'setPassword') {
      const { id, password } = body
      if (!id || !password) return json({ error: 'id and password required' }, 400)
      // Same flag as create: a password an admin typed for SOMEONE ELSE is
      // temporary by definition, so that member is asked to replace it when
      // they sign in. An admin changing their own password already knows it.
      // Merge rather than assign — user_metadata also carries `name`.
      const { data: existing } = await admin.auth.admin.getUserById(id)
      const { error } = await admin.auth.admin.updateUserById(id, {
        password,
        user_metadata: {
          ...(existing?.user?.user_metadata ?? {}),
          must_set_password: id !== user.id,
        },
      })
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'setEmail') {
      const id = body.id
      const email = (body.email ?? '').trim().toLowerCase()
      if (!id || !email) return json({ error: 'id and email required' }, 400)
      // Update the auth email (confirmed, no verification step) + the profile copy.
      const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true })
      if (error) throw error
      await admin.from('profiles').update({ email }).eq('id', id)
      return json({ ok: true })
    }

    // Note: password resets moved to the `password-recovery` function, which
    // generates the link itself and delivers it to the member's recovery
    // address (Supabase's own reset mail can only go to the login email).

    if (action === 'delete') {
      const { id } = body
      if (!id) return json({ error: 'id required' }, 400)
      if (id === user.id) return json({ error: "You can't delete your own account" }, 400)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400)
  }
})
