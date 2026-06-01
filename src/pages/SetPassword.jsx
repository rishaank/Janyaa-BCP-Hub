import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo, Button, inputClass } from '../components/ui'

// Landing page for invite + password-reset email links. The link carries a token
// that supabase-js exchanges for a short-lived session on load; we then let the
// member set their password (auth.updateUser). Public route (outside the app shell).
export default function SetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying | ready | expired | done
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus('ready')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus('ready')
    })
    // If no session materializes from the link, treat it as invalid/expired.
    const t = setTimeout(() => setStatus((s) => (s === 'verifying' ? 'expired' : s)), 4000)
    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    setStatus('done')
    setTimeout(() => navigate('/'), 1400)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-surface p-7 shadow-sm">
        <div className="mb-5 flex justify-center">
          <Logo />
        </div>

        {status === 'verifying' && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-500">
            <Loader2 size={16} className="animate-spin" /> Verifying your link…
          </p>
        )}

        {status === 'expired' && (
          <div className="text-center">
            <h1 className="font-display text-h4 font-bold text-ink-900">Link expired</h1>
            <p className="mt-1 text-sm text-ink-500">
              This invite or reset link is no longer valid. Ask an admin to send a new one.
            </p>
            <button onClick={() => navigate('/login')} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">
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
          <form onSubmit={submit} className="space-y-3">
            <div className="mb-1 text-center">
              <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-green-50 text-green-600">
                <KeyRound size={18} />
              </span>
              <h1 className="font-display text-h4 font-bold text-ink-900">Set your password</h1>
              <p className="mt-1 text-sm text-ink-500">Choose a password to finish setting up your account.</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-800">New password</span>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-800">Confirm password</span>
              <input
                type="password"
                className={inputClass}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-coral-700">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy ? 'Saving…' : 'Set password & continue'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
