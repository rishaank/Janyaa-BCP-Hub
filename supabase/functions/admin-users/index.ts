// Supabase Edge Function: admin-users
// Admin-only account management that needs the service role (impossible from the
// browser): create accounts (with a set password OR an invite email), set a new
// password, send a reset email, and delete accounts.
// verify_jwt = true → caller must be signed in; we then confirm they're an admin
// (profiles.is_admin) before doing anything. Never trust the client's word for it.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS })

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

  // Are they an admin?
  const admin = createClient(url, serviceKey)
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return json({ error: 'Admins only' }, 403)

  const body = await req.json().catch(() => ({}))
  const { action, redirectTo } = body

  try {
    if (action === 'create') {
      const email = (body.email ?? '').trim()
      const name = (body.name ?? '').trim() || null
      const password = body.password
      if (!email) return json({ error: 'Email required' }, 400)

      if (password) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        })
        if (error) throw error
        if (name) await admin.from('profiles').update({ name }).eq('id', data.user.id)
        return json({ ok: true, id: data.user.id })
      }
      // No password → email them an invite with a set-password link.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        redirectTo,
      })
      if (error) throw error
      if (name && data?.user) await admin.from('profiles').update({ name }).eq('id', data.user.id)
      return json({ ok: true, id: data?.user?.id, invited: true })
    }

    if (action === 'setPassword') {
      const { id, password } = body
      if (!id || !password) return json({ error: 'id and password required' }, 400)
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'sendReset') {
      const email = (body.email ?? '').trim()
      if (!email) return json({ error: 'Email required' }, 400)
      // Anon client → Supabase sends the recovery email via the configured SMTP.
      const anon = createClient(url, anonKey)
      const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
      return json({ ok: true })
    }

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
