import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { Users, CalendarDays, PiggyBank, Loader2, MailCheck } from 'lucide-react'
import { Logo, Modal, Button, inputClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { requestPasswordReset } from '../lib/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  useDocumentTitle('Sign in')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  // Already signed in? Skip the form.
  if (session) return <Navigate to="/" replace />

  // Sign-in only — accounts are created by club admins (invite-only).
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-800 to-green-800 p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.5) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <img src="/janyaa-logo.png" alt="" className="h-11 w-11" />
          <span className="font-display text-lg font-bold">Janyaa BCP Hub</span>
        </div>
        <div className="relative my-auto">
          <h1 className="max-w-md text-3xl font-bold leading-tight">The operational home for Janyaa BCP.</h1>
          <p className="mt-3 max-w-md text-white/75">
            Members, events, and fundraising in one place — so the club can scale its STEM impact
            without drowning in spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/75">
            <span className="flex items-center gap-2"><Users size={16} /> Member hours</span>
            <span className="flex items-center gap-2"><CalendarDays size={16} /> Event ops</span>
            <span className="flex items-center gap-2"><PiggyBank size={16} /> Fundraising</span>
          </div>
        </div>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Sign In</h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@bcp.org"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
            />

            {error && (
              <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-600">{error}</p>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-500 disabled:opacity-60"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="w-full rounded-xl border border-ink-200 bg-surface py-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-100"
              >
                Forgot password?
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-sm text-ink-500">
            Need an account? Ask a club lead to invite you.
          </p>

          <p className="mt-6 text-center text-xs text-ink-400">
            By signing in you agree to our{' '}
            <Link to="/terms" className="font-medium text-ink-500 hover:text-ink-700">Terms</Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-ink-500 hover:text-ink-700">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      {/* Mounted only while open, so it always opens fresh with whatever's typed. */}
      {forgotOpen && (
        <ForgotPasswordModal onClose={() => setForgotOpen(false)} initialEmail={email} />
      )}
    </div>
  )
}

// Self-service reset. The address can be the member's school login OR the
// personal "recovery email" they saved on their profile — school mailboxes
// quarantine our mail, so most members will want the link sent elsewhere.
function ForgotPasswordModal({ onClose, initialEmail }) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')

  async function submit(e) {
    e.preventDefault()
    const typed = email.trim()
    setBusy(true)
    const res = await requestPasswordReset(typed)
    setBusy(false)
    // The server only names a destination when it differs from what was typed
    // (i.e. the link went to a saved recovery address), and masks it there.
    setSentTo(res.data?.sentTo || typed)
  }

  return (
    <Modal open onClose={onClose} title="Reset your password">
      {sentTo ? (
        <div className="text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-green-50 text-green-600">
            <MailCheck size={20} />
          </span>
          <p className="text-sm text-ink-600">
            If you have an account, a reset link has been sent to{' '}
            <span className="font-medium text-ink-900">{sentTo}</span>. If you don&rsquo;t receive an
            email soon, ask an Admin for help.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-700">School / Recovery Email</span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@bcp.org"
              required
              autoFocus
            />
          </label>
          <Button type="submit" disabled={busy} className="w-full justify-center py-3">
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </Modal>
  )
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
      />
    </label>
  )
}
