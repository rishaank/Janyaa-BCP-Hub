import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo, Button, inputClass } from '../components/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// Landing page for invite + password-reset links.
//
// THE ONE RULE HERE: the link's token is spent by a TAP, never by the page
// loading. A one-time token dies on whatever opens it first, and plenty of
// things open a link before its owner does — iMessage, Slack and WhatsApp all
// render a preview (Apple's runs the page's JavaScript, so "it's only static
// HTML" is not protection), a school mailbox runs every link through a scanner,
// and React StrictMode mounts this page twice in dev. So arriving here only
// shows a Continue button; verifyOtp() runs on the click.
//
// Link shapes that arrive:
//  1. ?token_hash=…&type=invite|recovery — what admin-users and
//     password-recovery hand out. Never hand out Supabase's /auth/v1/verify
//     URL: that one is spent by the first GET of it, before we see it at all.
//  2. #access_token=… — the implicit-grant callback older links produce;
//     supabase-js reads it on load, so there's nothing left to gate.
//  3. #error_code=otp_expired — a dead link. Honour it rather than falling
//     through to whatever session this browser already holds.
//
// Verifying a link SIGNS THAT MEMBER IN — that is what a recovery token is for,
// and it's why the link is worth guarding. So the page names the account it is
// about to act on, and signs it back out if you leave without setting a
// password (otherwise an admin who opened a member's link to test it walks away
// signed in as that member).
//
// Public route (outside the app shell).

// Auth params land in the query string (token_hash) or the hash (implicit
// grant + error callbacks), so read both.
function linkParams() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const get = (k) => search.get(k) || hash.get(k)
  return {
    tokenHash: get('token_hash'),
    type: get('type'),
    accessToken: get('access_token'),
    errorCode: get('error_code') || get('error'),
    errorDescription: get('error_description'),
  }
}

// Drop the one-time token from the address bar once it's been spent, so a
// refresh doesn't re-verify a dead token (and it stays out of history).
function stripLinkParams() {
  window.history.replaceState({}, '', window.location.pathname)
}

export default function SetPassword() {
  const navigate = useNavigate()
  // verifying | confirm | ready | expired | done
  const [status, setStatus] = useState('verifying')
  const [link, setLink] = useState(null) // the token waiting for a tap
  const [signedInAs, setSignedInAs] = useState('') // whoever holds this browser
  const [account, setAccount] = useState('') // the account the link is for
  const [linkError, setLinkError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useDocumentTitle('Set your password')

  // True while this page holds a session it opened with a link and no password
  // has been set yet — i.e. a session nobody has proven they own.
  const claimed = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer
    const { tokenHash, type, accessToken, errorCode, errorDescription } = linkParams()

    const fail = (msg) => {
      if (cancelled) return
      setLinkError(msg || '')
      setStatus('expired')
      stripLinkParams()
    }

    // The link itself says it's dead — don't fall through to whatever session
    // happens to be in this browser.
    if (errorCode) {
      fail(errorDescription ? errorDescription.replace(/\+/g, ' ') : '')
      return () => {
        cancelled = true
      }
    }

    // 1. Token link: hold it until the member taps Continue.
    if (tokenHash) {
      setLink({ tokenHash, type: type || 'invite' })
      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return
        setSignedInAs(data.session?.user?.email ?? '')
        setStatus('confirm')
      })
      return () => {
        cancelled = true
      }
    }

    // 2. Implicit-grant callback (older links) — already spent by the redirect,
    //    so just wait for supabase-js to surface the session. Only this path
    //    claims the session: a session that was already in the browser belongs
    //    to the member sitting there (they're changing their own password), and
    //    signing them out when they wander off would be its own bug.
    let sub
    if (accessToken) {
      sub = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session || event === 'INITIAL_SESSION') return
        claimed.current = true
        setAccount(session.user?.email ?? '')
        setStatus('ready')
        stripLinkParams()
      }).data
      timer = setTimeout(() => setStatus((s) => (s === 'verifying' ? 'expired' : s)), 15000)
    }
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) {
        setAccount(data.session.user?.email ?? '')
        setStatus('ready')
        return
      }
      // 3. No token, no session, nothing on the way — opened without a link.
      if (!accessToken) fail()
    })
    return () => {
      cancelled = true
      sub?.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  // Leaving with an unclaimed session (closed the tab, hit Back, opened someone
  // else's link to check it) must not leave this browser signed in as them.
  useEffect(() => {
    const drop = () => {
      if (claimed.current) supabase.auth.signOut({ scope: 'local' })
    }
    window.addEventListener('pagehide', drop)
    return () => {
      window.removeEventListener('pagehide', drop)
      drop()
    }
  }, [])

  // The tap that spends the token.
  async function verify() {
    if (!link) return
    setBusy(true)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: link.tokenHash,
      type: link.type,
    })
    setBusy(false)
    stripLinkParams()
    if (error) {
      setLinkError(error.message)
      return setStatus('expired')
    }
    claimed.current = true
    setAccount(data?.user?.email ?? '')
    setStatus('ready')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    claimed.current = false // the password proves the session is theirs to keep
    setStatus('done')
    setTimeout(() => navigate('/'), 1400)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {status === 'verifying' && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-500">
            <Loader2 size={16} className="animate-spin" /> Checking your link…
          </p>
        )}

        {status === 'confirm' && (
          <div className="text-center">
            <KeyRound size={26} className="mx-auto text-green-600" />
            <h1 className="mt-3 font-display text-h4 font-bold text-ink-900">
              {link?.type === 'recovery' ? 'Reset your password' : 'Welcome to the Hub'}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Tap continue to set your password. This link works once, so only use it on the device
              you want to sign in on.
            </p>
            {signedInAs && (
              <p className="mt-3 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-left text-xs text-gold-700">
                {signedInAs} is signed in on this browser. Continuing signs them out and signs in the
                member this link belongs to.
              </p>
            )}
            <Button onClick={verify} disabled={busy} className="mt-4 w-full justify-center py-3">
              {busy ? 'Checking…' : 'Continue'}
            </Button>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center">
            <h1 className="font-display text-h4 font-bold text-ink-900">Link expired</h1>
            <p className="mt-1 text-sm text-ink-500">
              This invite or reset link is no longer valid. Each link works once and lasts an hour —
              ask an admin to send a new one.
            </p>
            {linkError && <p className="mt-2 text-xs text-ink-400">{linkError}</p>}
            <button
              onClick={() => navigate('/login')}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Back to sign in
            </button>
          </div>
        )}

        {status === 'done' && (
          <p className="flex flex-col items-center gap-2 py-6 text-center text-sm font-medium text-green-700">
            <CheckCircle2 size={28} /> Password set — taking you in…
          </p>
        )}

        {status === 'ready' && (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-center text-2xl font-bold tracking-tight text-ink-900">
              Set your password
            </h1>
            {account && (
              <p className="text-center text-sm text-ink-500">
                for <span className="font-medium text-ink-700">{account}</span>
              </p>
            )}
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-700">New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-700">Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
            </div>
            {error && (
              <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-600">{error}</p>
            )}
            <Button type="submit" disabled={busy} className="w-full justify-center py-3">
              {busy ? 'Saving…' : 'Set password & continue'}
            </Button>
            <p className="text-center text-xs text-ink-400">
              You stay signed out until a password is set.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
