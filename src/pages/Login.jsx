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
          <img src="/janyaa-logo.png" alt="" className="h-11 w-11 rounded-lg bg-white p-0.5" />
          <span className="font-display text-lg font-bold">Janyaa BCP Hub</span>
        </div>
        <div className="relative">
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
        <p className="relative text-xs text-white/60">A Janyaa Foundation chapter · BCP</p>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Sign In</h2>
          <p className="mt-1 text-sm text-ink-500">Welcome back to the Janyaa Hub.</p>

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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-500 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Sign In
            </button>
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

          <p className="mt-4 text-center text-sm">
            <Link to="/" className="text-ink-400 transition-colors hover:text-ink-600">
              ← Back to the dashboard
            </Link>
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
// The server answers identically whether or not the address matched an account.
function ForgotPasswordModal({ onClose, initialEmail }) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const res = await requestPasswordReset(email.trim())
    setBusy(false)
    setSent(res.data?.message || 'If that address belongs to a Hub account, a reset link is on its way.')
  }

  return (
    <Modal open onClose={onClose} title="Reset your password">
      {sent ? (
        <div className="text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-green-50 text-green-600">
            <MailCheck size={20} />
          </span>
          <p className="text-sm text-ink-600">{sent}</p>
          <Button variant="soft" className="mt-4 w-full justify-center" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-ink-600">
            Enter your school email — or the recovery email you saved on your profile — and we'll
            send a link to choose a new password.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-800">Email</span>
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
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-ink-600">
            School inboxes often hold our mail for a while. If you haven't set a recovery email yet,
            ask a club lead — they can send you a link directly.
          </p>
          <Button type="submit" disabled={busy} className="w-full justify-center">
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
